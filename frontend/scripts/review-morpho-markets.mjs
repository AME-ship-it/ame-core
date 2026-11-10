import {writeFile} from 'node:fs/promises';
import {parseAbi,keccak256,getAddress} from 'viem';
import {mainnetReadClient as client} from '../lib/lending-history.ts';
import {MAINNET_CANDIDATES,MORPHO_ADDRESS} from '../lib/morpho-config.ts';
import {readMorphoMarket} from '../lib/morpho-mainnet.ts';
const block=await client.getBlock();
const records=new Map();
const getters={primaryOracle:'address',backupOracle:'address',currentOracle:'address',primaryPrice:'uint256',backupPrice:'uint256',deviationThreshold:'uint256',challengeTimelockDuration:'uint256',healingTimelockDuration:'uint256',challengeExpiresAt:'uint256',healingExpiresAt:'uint256',BASE_FEED_1:'address',BASE_FEED_2:'address',QUOTE_FEED_1:'address',QUOTE_FEED_2:'address',BASE_VAULT:'address',QUOTE_VAULT:'address',SCALE_FACTOR:'uint256',owner:'address',pendingOwner:'address',aggregator:'address',description:'string',decimals:'uint8',paused:'bool',implementation:'address'};
async function inspect(address,depth=0){
  address=getAddress(address);if(records.has(address)||/^0x0{40}$/i.test(address))return;
  const code=await client.getCode({address,blockNumber:block.number});if(!code||code==='0x')return;
  const record={address,bytes:(code.length-2)/2,runtimeHash:keccak256(code),getters:{},source:{status:'UNAVAILABLE'}};records.set(address,record);
  const clone=/^0x363d3d373d3d3d363d73([a-f0-9]{40})5af43d82803e903d91602b57fd5bf3$/i.exec(code);
  if(clone)record.implementation=getAddress('0x'+clone[1]);
  // EIP-1967 implementation slot; zero is an observation, not proof of immutability.
  record.eip1967ImplementationSlot=await client.getStorageAt({address,slot:'0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',blockNumber:block.number});
  await Promise.all(Object.entries(getters).map(async([name,type])=>{try{record.getters[name]=await client.readContract({address,abi:parseAbi([`function ${name}() view returns(${type})`]),functionName:name,blockNumber:block.number});}catch{}}));
  try{const round=await client.readContract({address,abi:parseAbi(['function latestRoundData() view returns(uint80,int256,uint256,uint256,uint80)']),functionName:'latestRoundData',blockNumber:block.number});record.round={roundId:round[0],answer:round[1],updatedAt:round[3],answeredInRound:round[4],ageSeconds:block.timestamp-round[3]};}catch{}
  try{const r=await fetch(`https://sourcify.dev/server/v2/contract/4663/${address}?fields=all`,{signal:AbortSignal.timeout(15000)});const s=await r.json();const onchain=s.runtimeBytecode?.onchainBytecode;record.source={status:r.ok&&s.runtimeMatch==='match'&&onchain&&keccak256(onchain)===record.runtimeHash?'SOURCIFY_RUNTIME_MATCH':'NOT_MATCHED',url:r.url,compilation:s.compilation,verifiedAt:s.verifiedAt,files:s.sources?Object.keys(s.sources):[]};}catch{}
  if(depth<2){for(const a of [record.implementation,...Object.entries(record.getters).filter(([name,v])=>typeof v==='string'&&/^0x[a-f0-9]{40}$/i.test(v)&&/Oracle|FEED|aggregator/.test(name)).map(([,v])=>v)])if(a)await inspect(a,depth+1);}
}
const markets=[];
for(const c of MAINNET_CANDIDATES){const m=await readMorphoMarket(c.id);markets.push({id:c.id,label:c.label,params:c.params,block:m.block,timestamp:m.timestamp,decimals:{loan:m.loanDecimals,collateral:m.collateralDecimals},liquidity:m.liquidity,utilization:m.utilization,price:m.price,feeds:m.feeds,owner:m.owner,feeRecipient:m.feeRecipient,signingApproved:false});await inspect(c.params.oracle);}
for(const address of [MORPHO_ADDRESS,...new Set(MAINNET_CANDIDATES.flatMap(c=>[c.params.loanToken,c.params.collateralToken,c.params.irm]))])await inspect(address,2);
const report={chainId:4663,observedBlock:block.number,observedTimestamp:block.timestamp,mainnetSigning:false,publicBroadcasts:0,markets,contracts:[...records.values()],limitations:['Source service runtime matches are independent attestations, not a local reproduction or security approval.','Feed heartbeat/deviation/provider policies and token governance require market-specific approval.','No actual MetaMask acceptance or real-value transaction authorized.'],sources:['https://docs.paxos.com/guides/stablecoin/usdg/mainnet','https://docs.ethena.fi/technical-design/key-addresses.md','https://docs.maple.finance/integrate/crosschain/syrupusd-crosschain.md','https://docs.morpho.org/developers/contracts/addresses/']};
await writeFile(new URL('../../contracts/deployments/morpho-activation-review.json',import.meta.url),JSON.stringify(report,(_,v)=>typeof v==='bigint'?String(v):v,2)+'\n');
console.log(JSON.stringify({status:'REVIEW_RECORDED_SIGNING_DISABLED',contracts:records.size,sourceMatches:[...records.values()].filter(r=>r.source.status==='SOURCIFY_RUNTIME_MATCH').length,markets:markets.map(m=>({label:m.label,block:String(m.block)}))}));
