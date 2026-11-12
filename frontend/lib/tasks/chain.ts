import {extendedSnapshot} from './extended.ts';
import {createPublicClient,http,getAddress,keccak256,zeroAddress,type Address,type Hex} from 'viem';
import {agentABI,agentRuntimeBytecode} from '../generated/agent.ts';
import {logRanges} from '../log-ranges.ts';
import {robinhoodMainnet} from '../chains.ts';
import {contentHash,TaskError,type TaskType,type TaskSubmission} from './model.ts';
export const REGISTRY='0x3E5D2c59fc968DAE8Fc58AB1B46F3b3eB03d969c' as const;
export const DEPLOYMENT_BLOCK=112023846n;
function freshHead(head:{timestamp:bigint}){const drift=Date.now()-Number(head.timestamp)*1000;if(drift>120000||drift< -1200000)throw new TaskError('RPC_HEAD_STALE_OR_CLOCK_SKEW',503);}
export type Authority={owner:Address;assignedWallet:Address;epoch:string;blockNumber:string;blockHash:string;chainTime:number};
const defaultClient=createPublicClient({chain:robinhoodMainnet,transport:http(undefined,{timeout:8000,retryCount:1})});
export function createTasksChain(client=defaultClient){
 async function readSnapshot(type:TaskType,input:TaskSubmission):Promise<Record<string,string>>{
  if(await client.getChainId()!==4663)throw new TaskError('RPC_WRONG_NETWORK',503);
  const head=await client.getBlock();freshHead(head);if(head.number<2n)throw new TaskError('RPC_UNAVAILABLE',503);
  if(type==='wallet')return {};
  if(['classification','events','risk'].includes(type))return extendedSnapshot(client,type,input,head,{snapshot:(t,i)=>readSnapshot(t,i),eventLogs:target=>details.get(target)||[]});
  if(type==='research'){
   const blockNumber=BigInt(input.analysis!.blockNumber);if(blockNumber>head.number-2n)throw new TaskError('SNAPSHOT_MUST_BE_RECENT_AND_CONFIRMED');
   const block=await client.getBlock({blockNumber});if(head.timestamp<block.timestamp||head.timestamp-block.timestamp>900n)throw new TaskError('SNAPSHOT_EXPIRED');const address=getAddress(input.target!);const [code,balance]=await Promise.all([client.getCode({address,blockNumber}),client.getBalance({address,blockNumber})]);if(!code||code==='0x')throw new TaskError('TARGET_HAS_NO_CONTRACT_CODE');
   if((await client.getBlock({blockNumber})).hash!==block.hash)throw new TaskError('CHAIN_REORGANIZED',409);
   return {blockNumber:String(blockNumber),blockHash:block.hash,codeHash:keccak256(code),codeBytes:String((code.length-2)/2),balanceWei:String(balance)};
  }
  const prior=cached.get(input.target!);if(prior){if(BigInt(prior.blockNumber)>head.number-2n)throw new TaskError('TRANSACTION_NOT_CONFIRMED');if((await client.getBlock({blockNumber:BigInt(prior.blockNumber)})).hash!==prior.blockHash){cached.delete(input.target!);details.delete(input.target!);throw new TaskError('CHAIN_REORGANIZED',409);}return prior;}
  const hash=input.target as Hex;const [tx,receipt]=await Promise.all([client.getTransaction({hash}),client.getTransactionReceipt({hash})]);if(tx.type==='eip4844')throw new TaskError('UNSUPPORTED_BLOB_TRANSACTION');if(!tx.blockNumber||tx.blockHash!==receipt.blockHash||tx.blockNumber!==receipt.blockNumber||receipt.blockNumber>head.number-2n)throw new TaskError('TRANSACTION_NOT_CONFIRMED');
  const block=await client.getBlock({blockNumber:receipt.blockNumber});if(block.hash!==receipt.blockHash)throw new TaskError('CHAIN_REORGANIZED',409);
  if(receipt.logs.length>256)throw new TaskError('TRANSACTION_LOG_LIMIT_EXCEEDED');
  const logs=receipt.logs.map(l=>({address:l.address.toLowerCase(),topics:l.topics,data:l.data,logIndex:l.logIndex}));
  if(JSON.stringify(logs).length>16384)throw new TaskError('TRANSACTION_LOG_LIMIT_EXCEEDED');details.set(input.target!,logs);
  const result={blockNumber:String(receipt.blockNumber),blockHash:receipt.blockHash,status:receipt.status,gasUsed:String(receipt.gasUsed),effectiveGasPriceWei:String(receipt.effectiveGasPrice),feeWei:String(receipt.gasUsed*receipt.effectiveGasPrice),logCount:String(logs.length),logsHash:contentHash(logs)};if(cached.size>=128){const oldest=cached.keys().next().value!;cached.delete(oldest);details.delete(oldest);}cached.set(input.target!,result);return result;
 }

 const details=new Map<string,{address:string;topics:readonly Hex[];data:Hex;logIndex:number}[]>();
 const cached=new Map<string,Record<string,string>>(),pending=new Map<string,Promise<Record<string,string>>>();
 return {
 eventLogs(target:string){return details.get(target)||[];},
 async authority(id:string):Promise<Authority>{
  if(await client.getChainId()!==4663)throw new TaskError('RPC_WRONG_NETWORK',503);
  const head=await client.getBlock();freshHead(head);if(head.number<DEPLOYMENT_BLOCK+2n)throw new TaskError('IDENTITY_NOT_CONFIRMED',409);
  const code=await client.getCode({address:REGISTRY,blockNumber:head.number});if(!code||keccak256(code)!==keccak256(agentRuntimeBytecode))throw new TaskError('IDENTITY_RUNTIME_MISMATCH',503);
  const args={address:REGISTRY,abi:agentABI,blockNumber:head.number} as const;const tokenId=BigInt(id);
  let owner:Address,assignedWallet:Address;
  try{[owner,assignedWallet]=await Promise.all([client.readContract({...args,functionName:'ownerOf',args:[tokenId]}),client.readContract({...args,functionName:'agentWalletOf',args:[tokenId]})]);}catch(error){let cause=error as {data?:{errorName?:string};cause?:unknown}|undefined;while(cause){if(cause.data?.errorName==='ERC721NonexistentToken')throw new TaskError('AGENT_NOT_FOUND',404);cause=cause.cause as typeof cause;}throw new TaskError('IDENTITY_RPC_UNAVAILABLE',503);}
  // Bounded RPC pages; fail closed if the deployment outgrows this window rather than dropping transfer history.
  if(head.number-DEPLOYMENT_BLOCK>10_000_000n)throw new TaskError('IDENTITY_INDEX_RANGE_REQUIRES_UPDATE',503);
  let latest:{transactionHash:Hex;logIndex:number;blockNumber:bigint;blockHash:Hex}|undefined;
  for(const range of logRanges(DEPLOYMENT_BLOCK,head.number,100_000n)){const logs=await client.getContractEvents({address:REGISTRY,abi:agentABI,eventName:'Transfer',args:{tokenId},...range,strict:true});for(const log of logs)if(!latest||log.blockNumber>latest.blockNumber||log.blockNumber===latest.blockNumber&&log.logIndex>latest.logIndex)latest=log;}
  if(!latest||latest.blockNumber>head.number-2n)throw new TaskError('OWNERSHIP_CONFIRMATION_PENDING',409);
  if((await client.getBlock({blockNumber:latest.blockNumber})).hash!==latest.blockHash||(await client.getBlock({blockNumber:head.number})).hash!==head.hash)throw new TaskError('CHAIN_REORGANIZED',409);
  return {owner:getAddress(owner),assignedWallet:getAddress(assignedWallet),epoch:contentHash({chain:4663,registry:REGISTRY,id,transfer:{transactionHash:latest.transactionHash,logIndex:latest.logIndex,blockNumber:String(latest.blockNumber),blockHash:latest.blockHash}}),blockNumber:String(head.number),blockHash:head.hash,chainTime:Number(head.timestamp)*1000};
 },
 async signature(wallet:Address,message:string,signature:Hex){return client.verifyMessage({address:wallet,message,signature});},
 snapshot(type:TaskType,input:TaskSubmission){const key=contentHash({type,target:input.target??null,block:['research','classification','events','risk'].includes(type)?input.analysis?.blockNumber??null:null});const hit=pending.get(key);if(hit)return hit;if(pending.size>=32)throw new TaskError('RPC_CAPACITY_UNAVAILABLE',503);const work=readSnapshot(type,input);pending.set(key,work);void work.finally(()=>pending.delete(key)).catch(()=>{});return work;},
 async reference(){if(await client.getChainId()!==4663)throw new TaskError('RPC_WRONG_NETWORK',503);const block=await client.getBlock();freshHead(block);return {blockNumber:String(block.number-2n),chainId:4663};},
};
}
export const mainnetTasksChain=createTasksChain();
export type TasksChain=typeof mainnetTasksChain;
export function authorized(a:Authority,wallet:Address){if(wallet.toLowerCase()!==a.owner.toLowerCase()&&(a.assignedWallet===zeroAddress||wallet.toLowerCase()!==a.assignedWallet.toLowerCase()))throw new TaskError('WALLET_NOT_AUTHORIZED_FOR_AGENT',403);}
