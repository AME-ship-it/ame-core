import {createPublicClient} from 'viem';
import {mainnetTasksChain,DEPLOYMENT_BLOCK,type Authority} from '../tasks/chain.ts';
import {tasksService} from '../tasks/service.ts';
import {tasksTransport} from '../tasks/rpc.ts';
import {agentABI} from '../generated/agent.ts';
import {parseIdentityMetadata} from '../agent-metadata.ts';
import {logRanges} from '../log-ranges.ts';
import {createPassportReader,PASSPORT_REGISTRY} from './service.ts';
if(typeof window!=='undefined')throw Error('Server-only Passport reads');
const client=createPublicClient({transport:tasksTransport()});
const mintCache=new Map<string,{transaction:string;block:string;timestamp:string;hash:string}>();
async function details(id:string,a:Authority){
 const issues:string[]=[],blockNumber=BigInt(a.blockNumber);
 const metadataURI=await client.readContract({address:PASSPORT_REGISTRY,abi:agentABI,functionName:'tokenURI',args:[BigInt(id)],blockNumber}).catch(()=>{issues.push('Metadata pointer unavailable.');return null;});
 const meta=metadataURI?parseIdentityMetadata(metadataURI):null;
 let mint=mintCache.get(id)||null;
 try{
  if(!mint){for(const range of logRanges(DEPLOYMENT_BLOCK,blockNumber,100000n)){
   const logs=await client.getContractEvents({address:PASSPORT_REGISTRY,abi:agentABI,eventName:'AgentMinted',args:{agentId:BigInt(id)},...range,strict:true});
   if(logs[0]){const l=logs[0],b=await client.getBlock({blockNumber:l.blockNumber});if(b.hash!==l.blockHash)throw Error('Reorganized');mint={transaction:l.transactionHash,block:String(l.blockNumber),timestamp:new Date(Number(b.timestamp)*1000).toISOString(),hash:l.blockHash};break;}
  }}
  if(mint){if((await client.getBlock({blockNumber:BigInt(mint.block)})).hash!==mint.hash)throw Error('Reorganized');if(mintCache.size>=128)mintCache.delete(mintCache.keys().next().value!);mintCache.set(id,mint);}
 }catch{mint=null;mintCache.delete(id);issues.push('Mint event history unavailable.');}
 if(meta?.issue)issues.push(meta.issue);
 return {metadataURI,name:meta?.name??null,description:meta?.description??null,mint:mint?{transaction:mint.transaction,block:mint.block,timestamp:mint.timestamp}:null,issues};
}
const read=createPassportReader({authority:id=>mainnetTasksChain.authority(id),activity:async id=>{const d=await tasksService.status(id);if(!('history' in d))throw Error('Missing history');return d;},details});
const pending=new Map<string,ReturnType<typeof read>>();
export async function readPassport(id:string){const existing=pending.get(id);if(existing)return existing;if(pending.size>=32)throw Error('Passport read capacity');const p=read(id);pending.set(id,p);try{return await p;}finally{pending.delete(id);}}
