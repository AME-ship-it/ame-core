import {decodeEventLog,encodeAbiParameters,erc721Abi,keccak256,parseAbi,type Address,type Hex} from 'viem';
import {agentABI} from '../generated/agent.ts';
import {MAINNET_CANDIDATES,MORPHO_ADDRESS,MORPHO_RUNTIME_HASH,morphoABI} from '../morpho-config.ts';
import {TaskError,canonical,type TaskSubmission,type TaskType} from './model.ts';
import type {TasksChain} from './chain.ts';
const interfaces=parseAbi(['function supportsInterface(bytes4) view returns(bool)']);
export async function extendedSnapshot(client:Parameters<typeof import('./chain.ts').createTasksChain>[0],type:TaskType,input:TaskSubmission,head:{number:bigint;timestamp:bigint},base:Pick<TasksChain,'snapshot'|'eventLogs'>):Promise<Record<string,string>>{
 if(!client)throw new TaskError('RPC_UNAVAILABLE',503);
 const number=BigInt(input.analysis!.blockNumber);if(number>head.number-2n)throw new TaskError('SNAPSHOT_MUST_BE_RECENT_AND_CONFIRMED');
 const block=await client.getBlock({blockNumber:number});if(head.timestamp<block.timestamp||head.timestamp-block.timestamp>900n)throw new TaskError('SNAPSHOT_EXPIRED');let facts:Record<string,string>;
 if(type==='classification'){
  const address=input.target as Address,code=await client.getCode({address,blockNumber:number});if(!code||code==='0x')throw new TaskError('TARGET_HAS_NO_CONTRACT_CODE');
  const supports=async(id:Hex)=>{try{return await client.readContract({address,abi:interfaces,functionName:'supportsInterface',args:[id],blockNumber:number});}catch{return null;}};
  const [erc165,invalid,nft]=await Promise.all([supports('0x01ffc9a7'),supports('0xffffffff'),supports('0x80ac58cd')]);
  // Positive claim only when the ERC-165 validity probes and ERC-721 interface all agree.
  const status=erc165===true&&invalid===false&&nft===true?'ERC-721 interface advertised':'Not established';
  const slot='0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as Hex;
  const storage=await client.getStorageAt({address,slot,blockNumber:number});
  facts={codeHash:keccak256(code),erc165Probe:String(erc165),invalidProbe:String(invalid),erc721Probe:String(nft),interface:status,implementationSlot:storage||'0x',proxyConclusion:'A storage slot alone does not establish proxy behavior or safety.'};
 }else if(type==='events'){
  const tx=await base.snapshot('transaction',{target:input.target,analysis:{}}),logs=base.eventLogs(input.target!);
  const event=logs.find(l=>l.address.toLowerCase()==='0x3e5d2c59fc968dae8fc58ab1b46f3b3eb03d969c'&&(()=>{try{return decodeEventLog({abi:agentABI,data:l.data,topics:l.topics as [Hex,...Hex[]],strict:true}).eventName==='Transfer';}catch{return false;}})());
  if(!event)throw new TaskError('NO_SUPPORTED_EVENT',400);
  const decoded=decodeEventLog({abi:erc721Abi,data:event.data,topics:event.topics as [Hex,...Hex[]],strict:true});if(decoded.eventName!=='Transfer')throw new TaskError('NO_SUPPORTED_EVENT');
  const code=await client.getCode({address:event.address as Address,blockNumber:number});
  const {agentRuntimeBytecode}=await import('../generated/agent.ts');if(!code||keccak256(code)!==keccak256(agentRuntimeBytecode))throw new TaskError('IDENTITY_RUNTIME_MISMATCH');
  facts={event:'Transfer',emitter:event.address,from:decoded.args.from,to:decoded.args.to,tokenId:String(decoded.args.tokenId),logIndex:String(event.logIndex),topic:event.topics[0],transactionBlock:tx.blockNumber,transactionBlockHash:tx.blockHash,logsHash:tx.logsHash,abi:'AMEAgent reviewed ERC-721 ABI',interpretation:decoded.args.from==='0x0000000000000000000000000000000000000000'?'A new NFT identity was minted.':'The NFT identity changed owner.'};
 }else{
  const candidate=MAINNET_CANDIDATES.find(c=>c.id.toLowerCase()===input.target?.toLowerCase());if(!candidate)throw new TaskError('UNSUPPORTED_MARKET');
  const code=await client.getCode({address:MORPHO_ADDRESS,blockNumber:number});if(!code||keccak256(code)!==MORPHO_RUNTIME_HASH)throw new TaskError('MORPHO_RUNTIME_MISMATCH');
  const core={address:MORPHO_ADDRESS,abi:morphoABI,blockNumber:number} as const;
  const [p,m]=await Promise.all([client.readContract({...core,functionName:'idToMarketParams',args:[candidate.id]}),client.readContract({...core,functionName:'market',args:[candidate.id]})]);
  const id=keccak256(encodeAbiParameters([{type:'address'},{type:'address'},{type:'address'},{type:'address'},{type:'uint256'}],p));if(id!==candidate.id||p.some((v,i)=>String(v).toLowerCase()!==String(Object.values(candidate.params)[i]).toLowerCase())||m[4]===0n)throw new TaskError('MARKET_PARAMETERS_CHANGED');
  const oracle=await client.getCode({address:p[2],blockNumber:number});if(!oracle||oracle==='0x')throw new TaskError('ORACLE_UNAVAILABLE');
  facts={loanToken:p[0],collateralToken:p[1],oracle:p[2],oracleCodeHash:keccak256(oracle),lltv:String(p[4]),supplyAssets:String(m[0]),borrowAssets:String(m[2]),utilizationBps:m[0]===0n?'0':String(m[2]*10000n/m[0]),criterion:'Debt above LLTV × collateral value may be liquidatable; observed configuration does not prove oracle safety.'};
 }
 if((await client.getBlock({blockNumber:number})).hash!==block.hash)throw new TaskError('CHAIN_REORGANIZED',409);
 return {blockNumber:String(number),blockHash:block.hash,facts:canonical(facts)};
}
