import {decodeFunctionData,encodeFunctionData,erc20Abi,getAddress,type Address,type Hex} from 'viem';
import {MORPHO_ADDRESS,MORPHO_CHAIN_ID,MAINNET_WRITES_APPROVED,morphoABI} from './morpho-config.ts';
import {candidateFor,verifyMainnetCore,type MorphoSnapshot} from './morpho-mainnet.ts';
import {ceilDiv,ORACLE_SCALE,WAD} from './morpho-math.ts';
import {mainnetReadClient} from './lending-history.ts';
export type MainnetAction='supply'|'borrow'|'repay'|'withdraw'|'addCollateral'|'removeCollateral';
export type UnsignedMainnetCall={chainId:4663;to:Address;data:Hex;value:0n;label:string};
export function assertMainnetSigningApproved():never {if(!MAINNET_WRITES_APPROVED)throw new Error('MAINNET SIGNING DISABLED — market, oracle, identity and transaction controls require approval.');throw new Error('No mainnet signing implementation is installed.');}
export function prepareMainnetAction(snapshot:MorphoSnapshot,action:MainnetAction,value:bigint,account:Address,chainId:number,slippageBps=50){
  if(chainId!==MORPHO_CHAIN_ID)throw new Error('Switch to Robinhood Mainnet before preparing a mainnet action.');
  if(value<=0n||value>(1n<<128n)-1n||!Number.isInteger(slippageBps)||slippageBps<0||slippageBps>100)throw new Error('Invalid amount or slippage budget.');
  const c=candidateFor(snapshot.candidate.id),p=snapshot.position;
  if(!p||getAddress(p.account)!==getAddress(account))throw new Error('Only the connected wallet’s own position can be prepared.');
  let fn: 'supply'|'borrow'|'repay'|'withdraw'|'supplyCollateral'|'withdrawCollateral';let args:readonly unknown[];
  let token:Address|undefined,maxSpend=0n,allowance=0n;
  const withBudget=()=>ceilDiv(value*BigInt(10000+slippageBps),10000n);
  let maxShares=0n,minAssets=0n;
  if(action==='supply'){
    const shares=value*(snapshot.market.totalSupplyShares+1000000n)/(snapshot.market.totalSupplyAssets+1n);if(shares===0n)throw new Error('Supply would mint zero shares.');
    fn='supply';args=[c.params,0n,shares,account,'0x'];token=c.params.loanToken;maxSpend=withBudget();allowance=p.loanAllowance;
  }else if(action==='withdraw'){
    if(value>p.supplied||value>snapshot.liquidity)throw new Error('Amount exceeds the wallet claim or available liquidity.');
    // Exact shares bound the burn in the core itself. Core has no minimum-assets argument.
    maxShares=value*(snapshot.market.totalSupplyShares+1000000n)/(snapshot.market.totalSupplyAssets+1n);
    if(maxShares===0n||maxShares>p.supplyShares)throw new Error('Withdrawal share budget is invalid.');
    minAssets=value*BigInt(10000-slippageBps)/10000n;
    fn='withdraw';args=[c.params,0n,maxShares,account,account];
  }else if(action==='borrow'){
    if(p.capacity===null||value>p.capacity)throw new Error('Oracle unavailable or borrowing capacity exceeded.');
    fn='borrow';args=[c.params,value,0n,account,account];
  }else if(action==='repay'){
    if(p.debt===0n)throw new Error('This wallet has no debt in this market.');
    fn='repay';args=[c.params,value>=p.debt?0n:value,value>=p.debt?p.borrowShares:0n,account,'0x'];token=c.params.loanToken;maxSpend=ceilDiv((value>=p.debt?p.debt:value)*BigInt(10000+slippageBps),10000n);allowance=p.loanAllowance;
  }else if(action==='addCollateral'){
    fn='supplyCollateral';args=[c.params,value,account,'0x'];token=c.params.collateralToken;maxSpend=value;allowance=p.collateralAllowance;
  }else{
    if(value>p.collateral)throw new Error('Amount exceeds deposited collateral.');
    if(p.debt>0n && (snapshot.price===null||(p.collateral-value)*snapshot.price/ORACLE_SCALE*c.params.lltv/WAD<p.debt))throw new Error('Remaining collateral would be unhealthy or oracle is unavailable.');
    fn='withdrawCollateral';args=[c.params,value,account,account];
  }
  if(token&&maxSpend>(getAddress(token)===getAddress(c.params.loanToken)?p.loanBalance:p.collateralBalance))throw new Error('Wallet token balance is below the finite spend budget.');
  const approvals:UnsignedMainnetCall[]=[];
  // Always replace a different allowance with the exact finite ceiling; no unlimited grants.
  if(token&&allowance!==maxSpend){
    if(allowance>0n)approvals.push({chainId:4663,to:token,data:encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[MORPHO_ADDRESS,0n]}),value:0n,label:'Reset allowance'});
    approvals.push({chainId:4663,to:token,data:encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[MORPHO_ADDRESS,maxSpend]}),value:0n,label:'Finite approval'});
  }
  const data=encodeFunctionData({abi:morphoABI,functionName:fn,args:args as never});
  return {action,candidate:c.id,account,approvals,call:{chainId:4663,to:MORPHO_ADDRESS,data,value:0n,label:action} as UnsignedMainnetCall,maxSpend,maxShares,minAssets,minAssetsEnforced:false as const,quotedAt:snapshot.timestamp,expiresAt:snapshot.timestamp+60n,requiresApproval:approvals.length>0,signingEnabled:false as const,
    constraints:{supply:'Fixed shares; exact allowance caps asset spend.',repay:'Full repayment uses borrow shares to avoid interest dust; finite approval caps collection.',withdraw:'Exact shares cap the burn onchain. Minimum-assets enforcement is not available in the core; signing remains blocked.'}};
}
export type ActivationLevel='READ_ONLY'|'LIVE_SIMULATION'|'SIGNING_ENABLED';
export function simulationLevel(status?:string):ActivationLevel{return status==='SIMULATED_ONLY'?'LIVE_SIMULATION':'READ_ONLY';}
export function validateMainnetDraft(draft:ReturnType<typeof prepareMainnetAction>,timestamp:bigint){
  const c=candidateFor(draft.candidate);
  if(draft.call.chainId!==4663||getAddress(draft.call.to)!==MORPHO_ADDRESS||draft.call.value!==0n)throw new Error('Invalid simulation target.');
  if(timestamp<draft.quotedAt||timestamp>draft.expiresAt||draft.expiresAt-draft.quotedAt!==60n)throw new Error('Quote expired or invalid; refresh the market snapshot.');
  const decoded=decodeFunctionData({abi:morphoABI,data:draft.call.data});
  const expected={supply:'supply',borrow:'borrow',repay:'repay',withdraw:'withdraw',addCollateral:'supplyCollateral',removeCollateral:'withdrawCollateral'}[draft.action];
  if(decoded.functionName!==expected)throw new Error('Action/calldata mismatch.');
  const args=decoded.args as unknown as readonly unknown[];
  const params=args[0] as typeof c.params;
  for(const key of ['loanToken','collateralToken','oracle','irm'] as const)if(getAddress(params[key])!==getAddress(c.params[key]))throw new Error('Calldata market mismatch.');
  if(params.lltv!==c.params.lltv)throw new Error('Calldata LLTV mismatch.');
  const collateral=draft.action==='addCollateral'||draft.action==='removeCollateral';
  const ownerIndex=collateral?2:3;
  if(getAddress(args[ownerIndex] as Address)!==getAddress(draft.account))throw new Error('Calldata owner mismatch.');
  if(['borrow','withdraw','removeCollateral'].includes(draft.action)&&getAddress(args[ownerIndex+1] as Address)!==getAddress(draft.account))throw new Error('Calldata receiver mismatch.');
  if(draft.action==='withdraw'&&(args[1]!==0n||args[2]!==draft.maxShares||draft.maxShares<=0n))throw new Error('Withdrawal share bound missing.');
  const token=collateral?c.params.collateralToken:c.params.loanToken;
  if(draft.requiresApproval!==!!draft.approvals.length||draft.approvals.length>2)throw new Error('Invalid approval plan.');
  for(const [i,a] of draft.approvals.entries()){
    if(getAddress(a.to)!==getAddress(token)||a.chainId!==4663||a.value!==0n)throw new Error('Invalid approval token.');
    const approval=decodeFunctionData({abi:erc20Abi,data:a.data});
    if(approval.functionName!=='approve'||getAddress(approval.args[0])!==MORPHO_ADDRESS||approval.args[1]!==((i===0&&draft.approvals.length===2)?0n:draft.maxSpend)||draft.maxSpend<=0n)throw new Error('Invalid finite approval.');
  }
}
// Read-only eth_call only. This module never accepts a signer or sends a transaction.
export async function simulateMainnetAction(draft:ReturnType<typeof prepareMainnetAction>,client=mainnetReadClient){
  await verifyMainnetCore(client);
  const block=await client.getBlock();validateMainnetDraft(draft,block.timestamp);
  if(draft.requiresApproval)return {status:'APPROVAL_REQUIRED' as const,reason:'Sequential approvals cannot persist across public eth_call requests. No transaction was broadcast.'};
  const result=await client.call({account:draft.account,to:draft.call.to,data:draft.call.data,blockNumber:block.number});
  return {status:'SIMULATED_ONLY' as const,result:result.data??'0x',block:block.number,broadcast:false};
}
