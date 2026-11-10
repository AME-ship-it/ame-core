'use client';
import {useId,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {formatUnits,type Address,type Hash} from 'viem';
import type {readLendingMarket} from '@/lib/lending';
import {readLendingHistory,readMainnetOverview,type LendingHistoryPoint} from '@/lib/lending-history';
import {actionIssue,actionMaximum,parseTokenAmount,type LendingAction,type TransactionPhase} from '@/lib/lending-terminal';
import {developmentChain,robinhoodMainnet} from '@/lib/chains';
import styles from './LendingWorkspace.module.css';
import {MainnetMarkets} from './MainnetMarkets';
type Market=Awaited<ReturnType<typeof readLendingMarket>>;
const fmt=(v:bigint|undefined,d:number,s='')=>v===undefined?'—':`${v>0n&&d>6&&v<10n**BigInt(d-6)?'<0.000001':Number(formatUnits(v,d)).toLocaleString('en-US',{maximumFractionDigits:6})}${s?' '+s:''}`;
const labels:Record<LendingAction,string>={deposit:'Supply',borrow:'Borrow',repay:'Repay',withdraw:'Withdraw',addCollateral:'Add collateral',removeCollateral:'Remove collateral'};
const actions=Object.keys(labels) as LendingAction[];
function HistoryChart({data,enabled}:{data?:Market;enabled:boolean}){
  const [window,setWindow]=useState(5000n);
  const [metric,setMetric]=useState<'cash'|'principal'>('cash');
  const [hover,setHover]=useState<number>();const gradient=useId().replaceAll(':','');
  const history=useQuery({queryKey:['lending-history',developmentChain.id,data?.address,String(window)],queryFn:()=>readLendingHistory(window),enabled:enabled&&!!data,staleTime:60000,retry:false,refetchOnWindowFocus:false});
  const points=history.data?.points??[];const decimals=data?.loanDecimals??6;
  const values=points.map(p=>Number(formatUnits(p[metric],decimals)));
  const low=Math.min(...values),high=Math.max(...values);const pad=points.length?Math.max((high-low)*.15,Math.abs(high)*.01,high===0?1:.000001):1;
  const min=points.length?Math.max(0,low-pad):0,max=points.length?high+pad:1;
  const left=14,right=668,top=24,bottom=232;
  const from=points[0]?.timestamp??0,to=points.at(-1)?.timestamp??1;
  const x=(p:LendingHistoryPoint)=>left+(p.timestamp-from)/Math.max(1,to-from)*(right-left);
  const y=(v:number)=>bottom-(v-min)/Math.max(.000001,max-min)*(bottom-top);
  const path=points.map((p,i)=>`${i?'L':'M'}${x(p)},${y(values[i])}`).join(' ');
  const active=points[hover??points.length-1];
  return <section className={styles.card} aria-labelledby="market-chart-title">
    <div className={styles.cardHead}><div><p className={styles.eyebrow}>ONCHAIN ANALYTICS</p><h2 id="market-chart-title">Market history</h2></div><div className={styles.segment} aria-label="Historical block window">{[5000n,50000n].map(w=><button key={String(w)} onClick={()=>{setWindow(w);setHover(undefined);}} aria-pressed={window===w}>{w===5000n?'Recent':'Extended'}</button>)}</div></div>
    <div className={styles.chartToolbar}><div className={styles.segment} aria-label="Chart metric"><button aria-pressed={metric==='cash'} onClick={()=>setMetric('cash')}>Liquidity</button><button aria-pressed={metric==='principal'} onClick={()=>setMetric('principal')}>Borrowed principal</button></div><span className={styles.mono}>{active?fmt(active[metric],decimals,data?.loanSymbol):'Awaiting historical reads'}</span></div>
    <div className={styles.chart}>
      {points.length>=2?<svg viewBox="0 0 790 285" role="img" aria-label={`${metric==='cash'?'Liquidity':'Borrowed principal'} history from actual onchain block snapshots`} onPointerMove={event=>{
        const rect=event.currentTarget.getBoundingClientRect();const px=(event.clientX-rect.left)/rect.width*790;
        let nearest=0;for(let i=1;i<points.length;i++)if(Math.abs(x(points[i])-px)<Math.abs(x(points[nearest])-px))nearest=i;setHover(nearest);
      }} onPointerLeave={()=>setHover(undefined)}>
        <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b8a3e4" stopOpacity=".18"/><stop offset="100%" stopColor="#b8a3e4" stopOpacity="0"/></linearGradient></defs>
        {[0,1,2,3,4].map(i=>{const row=top+(bottom-top)*i/4;return <g key={i}><line x1={left} x2={right} y1={row} y2={row} stroke="#24212b" strokeDasharray="2 5"/><text x="685" y={row+4} fill="#918a9f" fontSize="10" fontFamily="monospace">{(max-(max-min)*i/4).toLocaleString('en-US',{maximumFractionDigits:5})}</text></g>;})}
        <path d={`${path} L${x(points.at(-1)!)},${bottom} L${x(points[0])},${bottom} Z`} fill={`url(#${gradient})`}/><path d={path} fill="none" stroke="#c0afe7" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
        {active&&<g><line x1={x(active)} x2={x(active)} y1={top} y2={bottom} stroke="#958aa9" strokeDasharray="3 4"/><circle cx={x(active)} cy={y(Number(formatUnits(active[metric],decimals)))} r="4" fill="#e0d4fb" stroke="#09080c" strokeWidth="2"/></g>}
        {[points[0],points[Math.floor(points.length/2)],points.at(-1)!].map((p,i)=><text key={`${p.block}-${i}`} x={i===0?left:i===1?(left+right)/2:right} y="266" textAnchor={i===0?'start':i===1?'middle':'end'} fill="#918a9f" fontSize="10" fontFamily="monospace">{new Date(p.timestamp*1000).toISOString().slice(5,16).replace('T',' ')}</text>)}
      </svg>:<div className={styles.empty}>{history.isFetching?'Reading historical block snapshots…':history.isError?'History RPC unavailable. Current metrics remain available.':'Historical data unavailable. No synthetic series is shown.'}</div>}
    </div>
    <div className={styles.chartFoot}><span>{active?`Block ${active.block} · ${new Date(active.timestamp*1000).toISOString().replace('T',' ').slice(0,19)} UTC`:'Actual observations only · UTC'}</span><button onClick={()=>void history.refetch()} disabled={!enabled||!data||history.isFetching}>Refresh chart ↻</button></div>
    <p className={styles.hint}>{history.data?`${history.data.points.length}/${history.data.requested} block snapshots · ${history.data.unavailable} unavailable. `:''}Lines connect observed values; they are not a price feed. Archive support depends on the RPC.</p>
  </section>;
}
function Portfolio({data}:{data?:Market}){
  const available=data?.loanBalance!==undefined&&data.supplyBalance!==undefined;
  const wallet=available?data.loanBalance!:0n,supplied=available?data.supplyBalance!:0n,total=wallet+supplied;
  const ratio=total>0n?Number(wallet*10000n/total)/100:0;
  return <section className={styles.card} aria-labelledby="portfolio-title"><div className={styles.cardHead}><div><p className={styles.eyebrow}>YOUR PORTFOLIO</p><h2 id="portfolio-title">Asset allocation</h2></div><span className={styles.tag}>{data?.loanSymbol??'—'}</span></div>
    <div className={styles.portfolio}><svg viewBox="0 0 150 150" role="img" aria-label={available&&total>0n?`Wallet ${ratio}% and supplied ${(100-ratio).toFixed(2)}% of loan-token holdings`:'No wallet allocation available'}><circle cx="75" cy="75" r="55" fill="none" stroke="#24212b" strokeWidth="13"/>{available&&total>0n&&<><circle cx="75" cy="75" r="55" fill="none" stroke="#a58bc9" strokeWidth="13"/><circle cx="75" cy="75" r="55" fill="none" stroke="#d5e8df" strokeWidth="13" pathLength="100" strokeDasharray={`${ratio} ${100-ratio}`} transform="rotate(-90 75 75)"/></>}<text x="75" y="72" textAnchor="middle" fill="#c8bed7" fontSize="10">{available?'HOLDINGS':'CONNECT'}</text><text x="75" y="91" textAnchor="middle" fill="#f0ecf5" fontSize="14">{data?.loanSymbol??'WALLET'}</text></svg>
    <dl className={styles.allocations}><div><dt><i/>Wallet</dt><dd>{available?fmt(wallet,data!.loanDecimals):'—'}</dd></div><div><dt><i/>Supplied claim</dt><dd>{available?fmt(supplied,data!.loanDecimals):'—'}</dd></div><div><dt>Gross holdings</dt><dd>{available?fmt(total,data!.loanDecimals):'—'}</dd></div></dl></div>
    <p className={styles.hint}>One token, one unit. Collateral and debt are reported separately; no invented USD valuation or net-worth estimate.</p>
  </section>;
}
export function LendingWorkspace({data,configured,ready,busy,account,amount,setAmount,onAction,phase,message,hash}:{data?:Market;configured:boolean;ready:boolean;busy:boolean;account?:Address;amount:string;setAmount:(v:string)=>void;onAction:(a:LendingAction)=>void;phase:TransactionPhase;message:string;hash?:Hash}){
  const [action,setAction]=useState<LendingAction>('deposit');
  const collateral=action==='addCollateral'||action==='removeCollateral';const decimals=collateral?data?.collateralDecimals:data?.loanDecimals;const symbol=collateral?data?.collateralSymbol:data?.loanSymbol;
  let issue:string|null=null;
  if(data&&account){try{issue=actionIssue(action,parseTokenAmount(amount,decimals!),data,account);}catch(error){issue=amount?(error as Error).message:'Enter an amount to preview this action.';}}
  const maximum=data?actionMaximum(action,data):undefined;
  const explorer=developmentChain.blockExplorers?.default.url;
  return <div className={styles.workspace}><div className={styles.analytics}><HistoryChart data={data} enabled={configured}/><Portfolio data={data}/></div>
    <section className={`${styles.card} ${styles.trade}`} aria-labelledby="transaction-title"><div className={styles.cardHead}><div><p className={styles.eyebrow}>TRANSACTION TERMINAL</p><h2 id="transaction-title">Manage capital</h2></div><span className={styles.tag}>TEST ASSETS</span></div>
      <div className={styles.actionTabs} role="tablist" aria-label="Lending action">{actions.map(a=><button key={a} id={`action-${a}`} role="tab" aria-selected={a===action} aria-controls="action-panel" tabIndex={a===action?0:-1} disabled={busy} onClick={()=>{setAction(a);setAmount('');}} onKeyDown={event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();const next=actions[(actions.indexOf(a)+(event.key==='ArrowRight'?1:actions.length-1))%actions.length];setAction(next);setAmount('');document.getElementById(`action-${next}`)?.focus();}}}>{labels[a]}</button>)}</div>
      <div id="action-panel" role="tabpanel" aria-labelledby={`action-${action}`}>
        <div className={styles.amountHead}><label htmlFor="terminal-amount">{labels[action]} amount</label><button disabled={!ready||maximum===undefined||maximum===0n} onClick={()=>maximum!==undefined&&setAmount(formatUnits(maximum,decimals!))}>MAX</button></div>
        <div className={styles.amount}><input id="terminal-amount" value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" autoComplete="off" placeholder="0.00" disabled={!configured||busy} aria-describedby="action-feedback"/><span>{symbol??'—'}</span></div>
        <dl className={styles.quote}><div><dt>Wallet balance</dt><dd>{data?fmt(collateral?data.collateralBalance:data.loanBalance,decimals!,symbol):'—'}</dd></div><div><dt>{collateral?'Deposited collateral':action==='withdraw'?'Withdrawable now':action==='borrow'?'Borrowable now':action==='repay'?'Outstanding debt':'Supplied claim'}</dt><dd>{data?fmt(collateral?data.credit?.position.collateral:action==='withdraw'?data.withdrawable:action==='borrow'?data.credit?.borrowable??undefined:action==='repay'?data.credit?.debt:data.supplyBalance,decimals!,symbol):'—'}</dd></div><div><dt>Health factor</dt><dd>{data?.credit?(data.credit.debt===0n?'NO DEBT':data.credit.health===null?'UNAVAILABLE':fmt(data.credit.health,18)):'Select position'}</dd></div></dl>
        <p id="action-feedback" className={styles.feedback}>{!account?'Connect your wallet using the header controls.':!ready&&!busy?'Use the configured test network and wait for current onchain reads.':issue??(action==='repay'?'This is a maximum: only current debt is collected.':'Contract simulation checks authorization and solvency before signing.')}</p>
        <button className={styles.submit} disabled={!ready||!!issue||!amount} onClick={()=>onAction(action)}>{busy?'Transaction in progress…':labels[action]} <span>↗</span></button>
        <p className={styles.hint}>Approvals are finite and separate from the action. Supply and withdrawal enforce a 0.5% share-quote tolerance. <a href="#credit-title">Open or load a credit position below ↓</a></p>
      </div>
      <div className={styles.transaction} data-phase={phase} role="status" aria-live="polite"><span className={styles.phase}>{phase==='idle'?'READY FOR INPUT':phase.toUpperCase()}</span><p>{message||'No transaction submitted. Your wallet confirms every action.'}</p>{hash&&(explorer?<a href={`${explorer}/tx/${hash}`} target="_blank" rel="noopener noreferrer">View latest transaction ↗</a>:<code>{hash}</code>)}</div>
    </section>
  </div>;
}
export function MainnetOverview({account}:{account?:Address}){
  const query=useQuery({queryKey:['mainnet-overview',account],queryFn:()=>readMainnetOverview(account),retry:false,refetchInterval:30000});const data=query.data;
  return <><section className={styles.card}><div className={styles.cardHead}><div><p className={styles.eyebrow}>ROBINHOOD CHAIN / 4663</p><h2>Mainnet overview</h2></div><span className={styles.tag}>READ ONLY</span></div><p className={styles.mainnetNotice}>AME CUSTOM MAINNET LENDING NOT DEPLOYED — canonical Morpho candidates are available below for verified reads and simulation only. All mainnet signing remains disabled. No testnet address is reused on mainnet.</p>
    <dl className={styles.mainnetMetrics}><div><dt>RPC network</dt><dd>{data?'Chain 4663 verified':query.isPending?'Connecting…':'Unavailable'}</dd></div><div><dt>Latest block</dt><dd>{data?String(data.block):'—'}</dd></div><div><dt>Wallet native balance</dt><dd>{data?.balance!==undefined?fmt(data.balance,18,'ETH'):account?'Unavailable':'Connect wallet to read'}</dd></div><div><dt>Gas price</dt><dd>{data?fmt(data.gasPrice,9,'gwei'):'—'}</dd></div></dl>
    {query.error&&<p className={styles.feedback} role="alert">Mainnet RPC unavailable. No balances are inferred. <button onClick={()=>void query.refetch()}>Retry reads</button></p>}
    <p className={styles.hint}>This view only reads public chain state and the connected address’s native balance; it never switches your wallet or requests a signature. Return to the testnet terminal for valueless-asset lending.</p><a className="text-link" href={robinhoodMainnet.blockExplorers!.default.url} target="_blank" rel="noopener noreferrer">Open Robinhood mainnet explorer ↗</a>
  </section><MainnetMarkets account={account}/></>;
}
