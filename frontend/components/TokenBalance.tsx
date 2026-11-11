'use client';
import {useQuery} from '@tanstack/react-query';
import {formatUnits,type Address} from 'viem';
import type {TokenSnapshot} from '@/lib/token-state';
export function TokenBalance({wallet,chainId}:{wallet:Address;chainId?:number}){
  const query=useQuery<TokenSnapshot>({queryKey:['ame-token-state',wallet,chainId],enabled:chainId===4663,retry:false,staleTime:10_000,gcTime:0,refetchInterval:q=>q.state.data?.status==='synchronized'?15_000:false,refetchIntervalInBackground:false,queryFn:async({signal})=>{
    const response=await fetch('/api/token-state',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({walletAddress:wallet}),cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(12_000)])});
    if(!response.ok)throw new Error('Token service unavailable');const result=await response.json() as TokenSnapshot;
    if(result.wallet.toLowerCase()!==wallet.toLowerCase()||result.chainId!==4663)throw new Error('Wallet state mismatch');return result;
  }});
  const data=query.data;
  return <div className="wallet-notice" style={{overflowWrap:'anywhere'}} aria-label="AME token balance" role="status">
    {chainId!==4663?'Select Robinhood Chain to read $AME balances.':query.isError?'Token service unavailable.':query.isPending?'Reading token configuration…':data?.status==='disabled'?'$AME recognition is not activated.':data?.status==='synchronized'&&data.decimals!==null&&data.balance!==null?<>
      <p>{data.holderStatus==='HOLDER'?'HOLDER':'NON-HOLDER'} · {formatUnits(BigInt(data.balance),data.decimals)} {data.symbol}</p>
      <p>Total supply: {data.totalSupply?formatUnits(BigInt(data.totalSupply),data.decimals):'Unavailable'} {data.symbol} · {data.decimals} decimals</p>
      {data.token&&<a href={`https://robin.etherscan.io/token/${data.token}`} target="_blank" rel="noopener noreferrer">Token contract ↗</a>}
      <small>{query.isError||query.dataUpdatedAt+30_000<Date.now()?'STALE SNAPSHOT':'SYNCHRONIZED SNAPSHOT'} · Block {data.block} · {data.blockTimestamp?new Date(data.blockTimestamp*1000).toISOString():''}</small>
      {data.transferCount!==null&&<p>Recent indexed transfers: {data.transferCount} · bounded window</p>}
      {data.allowance!==null&&<p>Approved allowance: {formatUnits(BigInt(data.allowance),data.decimals)} {data.symbol} · {data.spender}</p>}
    </>:'Token verification unavailable.'}
    {chainId===4663&&<button className="wallet" disabled={query.isFetching} onClick={()=>void query.refetch()}>REFRESH TOKEN STATE</button>}
  </div>;
}
