import {createPublicClient,http,type Address} from 'viem';
import {agentClient} from './lending-client.ts';
import {lendingABI} from './generated/lending.ts';
import {lendingConfiguration} from './lending.ts';
import {robinhoodMainnet,developmentChain} from './chains.ts';
import {sampleBlocks} from './lending-terminal.ts';
export type LendingHistoryPoint={block:bigint;timestamp:number;cash:bigint;principal:bigint};
export async function readLendingHistory(window:bigint=5000n) {
  if(!lendingConfiguration.address || lendingConfiguration.issue)throw new Error('Verified market configuration required.');
  if(await agentClient.getChainId()!==developmentChain.id)throw new Error('History RPC wrong network.');
  const last=await agentClient.getBlockNumber();
  const start=last>window?last-window:0n;
  const first=start>lendingConfiguration.deploymentBlock!?start:lendingConfiguration.deploymentBlock!;
  const blocks=sampleBlocks(first,last);
  const points:LendingHistoryPoint[]=[];let unavailable=0;
  // Bounded batches keep the public RPC load low. Failed reads never become zero balances.
  for(let i=0;i<blocks.length;i+=3){
    const batch=await Promise.all(blocks.slice(i,i+3).map(async blockNumber=>{
      try {
        const contract={address:lendingConfiguration.address!,abi:lendingABI,blockNumber} as const;
        const [block,cash,principal]=await Promise.all([agentClient.getBlock({blockNumber}),agentClient.readContract({...contract,functionName:'availableLiquidity'}),agentClient.readContract({...contract,functionName:'totalPrincipal'})]);
        return {block:blockNumber,timestamp:Number(block.timestamp),cash,principal};
      } catch {return null;}
    }));
    for(const point of batch)if(point)points.push(point);else unavailable++;
  }
  return {points,unavailable,requested:blocks.length};
}
export const mainnetReadClient=createPublicClient({chain:robinhoodMainnet,transport:http(robinhoodMainnet.rpcUrls.default.http[0],{retryCount:0,timeout:12000})});
export async function readMainnetOverview(account?:Address){
  const chainId=await mainnetReadClient.getChainId();
  if(chainId!==4663)throw new Error('Mainnet RPC returned the wrong chain.');
  const block=await mainnetReadClient.getBlock();
  const [gasPrice,balance]=await Promise.all([mainnetReadClient.getGasPrice(),account?mainnetReadClient.getBalance({address:account,blockNumber:block.number}):undefined]);
  return {chainId,block:block.number,timestamp:block.timestamp,gasPrice,balance};
}
