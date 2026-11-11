'use client';
import dynamic from 'next/dynamic';
import {useEffect,useRef,useState} from 'react';
import {useConnection} from 'wagmi';
import {useQuery} from '@tanstack/react-query';
import {getAddress} from 'viem';
import {holderPresentation,requestHolderAccess} from '@/lib/holder-access';
import {ProductShell} from './ProductShell';
import {HolderAccessBoundary} from './HolderAccessBoundary';
import styles from './HolderLending.module.css';
const Lending=dynamic(()=>import('./Lending').then(m=>m.Lending),{ssr:false,loading:()=> <p className="product-copy" role="status">Opening the credit layer…</p>});
export function HolderLending(){
  const connection=useConnection();const [mounted,setMounted]=useState(false),[clock,setClock]=useState(()=>Date.now());
  const forceRefresh=useRef(false);
  useEffect(()=>setMounted(true),[]);
  const wallet=mounted&&connection.isConnected&&connection.address?getAddress(connection.address):undefined;
  const query=useQuery({queryKey:['ame-holder-access',wallet],queryFn:({signal})=>{const refresh=forceRefresh.current;forceRefresh.current=false;return requestHolderAccess(wallet!,{signal,refresh});},enabled:!!wallet,retry:false,staleTime:0,gcTime:0,refetchInterval:15_000,refetchOnWindowFocus:'always'});
  useEffect(()=>{if(!query.data)return;const timer=setTimeout(()=>setClock(Date.now()),Math.max(0,query.data.expiresAt-Date.now()+1));return()=>clearTimeout(timer);},[query.data]);
  const state=holderPresentation({connected:!!wallet,wallet,data:query.data,pending:query.isPending,failed:query.isError,now:Math.max(clock,Date.now())});
  if(state==='unlocked')return <HolderAccessBoundary state={state}><Lending holderWallet={wallet!}/></HolderAccessBoundary>;
  return <ProductShell><p className="eyebrow">AME CREDIT</p><h1 className="product-title">Lending_</h1><p className="product-copy">Holder-gated lending for autonomous agents.</p><HolderAccessBoundary state={state} classes={styles} canRefresh={!!wallet} refreshing={query.isFetching} onRefresh={()=>{forceRefresh.current=true;void query.refetch();}} tokenURL={query.data?.tokenURL}/></ProductShell>;
}
