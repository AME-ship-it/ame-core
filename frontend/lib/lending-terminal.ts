import {getAddress,parseUnits,type Address} from 'viem';
export type LendingAction = 'deposit'|'borrow'|'repay'|'withdraw'|'addCollateral'|'removeCollateral';
export type TransactionPhase = 'idle'|'simulating'|'wallet'|'pending'|'confirmed'|'error';
export function parseTokenAmount(input:string,decimals:number):bigint {
  if (!/^\d+(\.\d+)?$/.test(input) || (input.split('.')[1]?.length || 0)>decimals) throw new Error('Enter a positive amount within the token’s precision.');
  const value=parseUnits(input,decimals);
  if(value<=0n || value>(1n<<128n)-1n)throw new Error('Amount outside supported range.');
  return value;
}
export type ActionSnapshot = {
  loanBalance?:bigint;collateralBalance?:bigint;withdrawable?:bigint;paused:boolean;minimumBorrow:bigint;
  credit:{debt:bigint;borrowable:bigint|null;health:bigint|null;currentOwner:Address;wallet:Address;position:{borrower:Address;operator:Address;collateral:bigint;principal:bigint;closed:boolean}}|null;
};
const same=(a?:Address,b?:Address)=>!!a && !!b && getAddress(a)===getAddress(b);
export function actionIssue(action:LendingAction,value:bigint,state:ActionSnapshot,account:Address):string|null {
  if(value<=0n)return 'Enter a positive amount.';
  if(action==='deposit')return value>(state.loanBalance??0n)?'Amount exceeds your wallet balance.':null;
  if(action==='withdraw')return value>(state.withdrawable??0n)?'Amount exceeds your currently withdrawable liquidity.':null;
  const c=state.credit;if(!c)return 'Open or load a credit position below.';
  if(action==='repay'){
    if(c.debt===0n)return 'This position has no debt.';
    return (value<c.debt?value:c.debt)>(state.loanBalance??0n)?'Insufficient repayment asset in your wallet.':null;
  }
  if(action==='borrow'){
    if(state.paused)return 'BORROWING PAUSED — repayment and available withdrawals remain open.';
    if(c.position.closed)return 'This position is closed. Open a new position to borrow.';
    if(!same(c.position.borrower,c.currentOwner) || (!same(account,c.position.borrower) && !(same(account,c.position.operator)&&same(account,c.wallet))))return 'Only the original owner or its currently assigned, authorized operator can borrow.';
    if(c.borrowable===null)return 'Oracle invalid or stale. Refresh mock test quotes before borrowing.';
    if(c.position.principal===0n && value<state.minimumBorrow)return 'Amount is below the market’s minimum opening borrow.';
    return value>c.borrowable?'Amount exceeds collateral, cash or market borrowing limits.':null;
  }
  if(!same(account,c.position.borrower))return 'Only the original borrower can manage this collateral.';
  if(action==='addCollateral')return c.position.closed?'This position is closed.':value>(state.collateralBalance??0n)?'Amount exceeds your collateral token balance.':null;
  if(value>c.position.collateral)return 'Amount exceeds deposited collateral.';
  if(c.debt>0n && c.health===null)return 'Oracle invalid or stale. Debt-bearing collateral withdrawals require valid quotes.';
  return null; // The contract simulation verifies remaining collateral health before any signature.
}
export function actionMaximum(action:LendingAction,s:ActionSnapshot):bigint|undefined {
  if(action==='deposit')return s.loanBalance;
  if(action==='withdraw')return s.withdrawable;
  if(action==='borrow')return s.credit?.borrowable??undefined;
  if(action==='addCollateral')return s.collateralBalance;
  if(action==='removeCollateral')return s.credit?.debt===0n?s.credit.position.collateral:undefined;
  if(!s.credit || s.loanBalance===undefined)return undefined;
  if(s.credit.debt===0n)return 0n;
  const buffer=s.credit.debt/1000n || 1n;
  const quote=s.credit.debt+buffer;
  return s.loanBalance<quote?s.loanBalance:quote;
}
export function sampleBlocks(first:bigint,last:bigint,count=16):bigint[] {
  if(first<0n || last<first || count<2)throw new Error('Invalid history range');
  return [...new Set(Array.from({length:count},(_,i)=>first+(last-first)*BigInt(i)/BigInt(count-1)))];
}
export function lendingError(error:unknown):string {
  const raw=error instanceof Error?error.message:'Transaction failed. Check your wallet history before retrying.';
  if(/user rejected|user denied|4001/i.test(raw))return 'Request declined in your wallet. No success is claimed; you can try again.';
  if(/insufficient funds/i.test(raw))return 'Insufficient native ETH for gas on the selected network.';
  if(/BorrowingDisabled/i.test(raw))return 'Borrowing is paused or the position term has expired.';
  if(/InvalidPrice/i.test(raw))return 'Oracle invalid or stale. Refresh mock test quotes and retry.';
  if(/Unhealthy/i.test(raw))return 'This action would violate the collateral requirement.';
  if(/Unauthorized/i.test(raw))return 'This wallet is not authorized for the selected position.';
  if(/Slippage/i.test(raw))return 'The share quote changed beyond your slippage bound. Refresh and retry.';
  if(/fetch failed|HTTP request failed|timeout|network request/i.test(raw))return 'RPC unavailable. Refresh reads; check your wallet history before resubmitting a pending transaction.';
  const short=(error as {shortMessage?:string})?.shortMessage;
  return short || raw.split('\n')[0].slice(0,320);
}
