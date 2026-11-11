import {getAddress,isAddress,isHash} from 'viem';
/** Event provenance is a deduplication key, never a reputation score or proof of an external outcome. */
export function uniqueEvidence<T extends {address:string;blockHash:string;transactionHash:string;logIndex:number;removed?:boolean}>(events:readonly T[],chainId:number,source:string):T[]{
  if(!Number.isSafeInteger(chainId)||chainId<=0||!isAddress(source))throw new Error('Invalid evidence source');
  const seen=new Map<string,T>(),transactions=new Map<string,string>();
  for(const event of events){
    if(event.removed)continue;
    if(!isAddress(event.address)||getAddress(event.address)!==getAddress(source)||!isHash(event.blockHash)||!isHash(event.transactionHash)||!Number.isSafeInteger(event.logIndex)||event.logIndex<0)throw new Error('Invalid evidence provenance');
    const identity=`${chainId}:${getAddress(source)}:${event.transactionHash}:${event.logIndex}`;
    if(transactions.has(identity)&&transactions.get(identity)!==event.blockHash)throw new Error('Conflicting evidence; refresh after reorg');
    transactions.set(identity,event.blockHash);seen.set(`${identity}:${event.blockHash}`,event);
  }
  return [...seen.values()];
}
