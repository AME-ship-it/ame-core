import assert from 'node:assert/strict';
import {test} from 'node:test';
import {actionIssue,actionMaximum,parseTokenAmount,sampleBlocks,lendingError} from '../lib/lending-terminal.ts';
const owner='0x1111111111111111111111111111111111111111';
const operator='0x2222222222222222222222222222222222222222';
const buyer='0x3333333333333333333333333333333333333333';
const state=()=>({loanBalance:1000n,collateralBalance:100n,withdrawable:500n,paused:false,minimumBorrow:10n,credit:{debt:20n,borrowable:50n,health:3n*10n**18n,currentOwner:owner,wallet:operator,position:{borrower:owner,operator,collateral:100n,principal:20n,closed:false}}});
test('terminal rejects lossy precision, exponent amounts, zero and uint128 overflow',()=>{
  for(const input of ['1e3','-1','0','1.0000001','Infinity',String(1n<<128n)])assert.throws(()=>parseTokenAmount(input,6));
  assert.equal(parseTokenAmount('1.000001',6),1000001n);
});
test('wallet and actual cash limits constrain supply and withdrawals',()=>{
  const s=state();assert.equal(actionIssue('deposit',1000n,s,owner),null);
  assert.match(actionIssue('deposit',1001n,s,owner),/wallet balance/);
  assert.equal(actionIssue('withdraw',500n,s,owner),null);
  assert.match(actionIssue('withdraw',501n,s,owner),/withdrawable/);
});
test('paused or stale-oracle positions can still be repaid by another wallet',()=>{
  const s=state();s.paused=true;s.credit.health=null;s.credit.borrowable=null;
  assert.equal(actionIssue('repay',100n,s,buyer),null);
  assert.match(actionIssue('borrow',10n,s,owner),/PAUSED/);
  s.paused=false;assert.match(actionIssue('borrow',10n,s,owner),/Oracle/);
});
test('borrow guards follow NFT ownership and currently assigned operator without redirecting authority',()=>{
  const s=state();assert.equal(actionIssue('borrow',10n,s,operator),null);
  s.credit.wallet=buyer;assert.match(actionIssue('borrow',10n,s,operator),/authorized/);
  s.credit.currentOwner=buyer;assert.match(actionIssue('borrow',10n,s,owner),/original owner/);
  s.credit.currentOwner=owner;s.credit.position.principal=0n;
  assert.match(actionIssue('borrow',9n,s,owner),/minimum/);
  assert.match(actionIssue('borrow',51n,s,owner),/limits/);
});
test('collateral stays bound to original borrower and MAX never infers a debt-bearing withdrawal limit',()=>{
  const s=state();assert.match(actionIssue('addCollateral',1n,s,buyer),/original borrower/);
  assert.equal(actionMaximum('removeCollateral',s),undefined);
  s.credit.debt=0n;s.credit.health=null;s.credit.currentOwner=buyer;
  assert.equal(actionIssue('removeCollateral',100n,s,owner),null);
  assert.equal(actionMaximum('removeCollateral',s),100n);
  assert.match(actionIssue('removeCollateral',101n,s,owner),/exceeds/);
});
test('history sampling is bounded, ordered, unique and anchored to actual block endpoints',()=>{
  assert.deepEqual(sampleBlocks(10n,12n),[10n,11n,12n]);
  const blocks=sampleBlocks(100n,100000n);assert.equal(blocks.length,16);assert.equal(blocks[0],100n);assert.equal(blocks.at(-1),100000n);
  assert.equal(new Set(blocks).size,blocks.length);assert.throws(()=>sampleBlocks(11n,10n));
});
test('wallet rejection, stale oracle and unsafe actions get actionable transaction errors',()=>{
  assert.match(lendingError(new Error('User rejected request: 4001')),/declined/);
  assert.match(lendingError(new Error('InvalidPrice')),/refresh/i);
  assert.match(lendingError(new Error('Unhealthy')),/collateral/);
  assert.match(lendingError(new Error('HTTP request failed')),/RPC unavailable/);
});
