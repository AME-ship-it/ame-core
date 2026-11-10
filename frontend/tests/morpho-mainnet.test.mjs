import assert from 'node:assert/strict';
import {test} from 'node:test';
import {decodeFunctionData,encodeFunctionData,erc20Abi} from 'viem';
import {MAINNET_CANDIDATES,MORPHO_ADDRESS,morphoABI} from '../lib/morpho-config.ts';
import {candidateFor,marketId,assertParams} from '../lib/morpho-mainnet.ts';
import {accrueMarket,annualizedRates,assetsDown,assetsUp,positionRisk,WAD} from '../lib/morpho-math.ts';
import {prepareMainnetAction,assertMainnetSigningApproved,validateMainnetDraft,simulationLevel,simulateMainnetAction} from '../lib/morpho-adapter.ts';
const user='0x1111111111111111111111111111111111111111',other='0x2222222222222222222222222222222222222222';
const U=10n**6n,C=10n**18n;
function snapshot(){const market={totalSupplyAssets:1000n*U,totalSupplyShares:1000n*U*1000000n,totalBorrowAssets:100n*U,totalBorrowShares:100n*U*1000000n,lastUpdate:1000n,fee:0n};return {candidate:MAINNET_CANDIDATES[0],timestamp:1000n,market,liquidity:900n*U,price:10n**24n,position:{account:user,loanBalance:1000n*U,collateralBalance:1000n*C,loanAllowance:0n,collateralAllowance:0n,supplyShares:500n*U*1000000n,borrowShares:10n*U*1000000n,supplied:500n*U,debt:10n*U,collateral:100n*C,capacity:81n*U}};}
test('only allowlisted market IDs with exact onchain parameters are accepted',()=>{
  for(const c of MAINNET_CANDIDATES){assert.equal(marketId(c.params),c.id);assert.equal(candidateFor(c.id),c);assertParams(c.params,[c.params.loanToken,c.params.collateralToken,c.params.oracle,c.params.irm,c.params.lltv]);}
  assert.throws(()=>candidateFor('0x'+'00'.repeat(32)));const c=MAINNET_CANDIDATES[0];assert.throws(()=>assertParams(c.params,[other,c.params.collateralToken,c.params.oracle,c.params.irm,c.params.lltv]));
});
test('integer accrual conserves supply/borrow interest and virtual-share rounding directions',()=>{
  const s=snapshot().market;const m=accrueMarket(s,1585489599n,87400n);assert.ok(m.totalBorrowAssets>s.totalBorrowAssets);
  assert.equal(m.totalSupplyAssets-s.totalSupplyAssets,m.totalBorrowAssets-s.totalBorrowAssets);
  const shares=123456789n;assert.ok(assetsUp(shares,m.totalBorrowAssets,m.totalBorrowShares)>=assetsDown(shares,m.totalBorrowAssets,m.totalBorrowShares));
  assert.deepEqual(accrueMarket(s,0n,1000n),s);assert.throws(()=>accrueMarket(s,1n,999n));
  const rates=annualizedRates(1585489599n,m);assert.ok(rates.borrowApr>0);assert.ok(rates.supplyApy>0);assert.ok(rates.utilization<WAD);
});
test('capacity and health use oracle base-unit scale; missing price is never zero value',()=>{
  const r=positionRisk(100n*C,10n*U,10n**24n,915000000000000000n,900n*U);assert.equal(r.collateralValue,100n*U);assert.equal(r.capacity,81500000n);
  assert.equal(r.health,9150000000000000000n);assert.deepEqual(positionRisk(C,1n,null,WAD,U),{collateralValue:null,capacity:null,health:null});
});
test('all six unsigned actions target canonical mainnet core and retain the connected wallet as owner/receiver',()=>{
  const s=snapshot();for(const action of ['supply','borrow','repay','withdraw','addCollateral','removeCollateral']){
    const draft=prepareMainnetAction(s,action,action==='addCollateral'||action==='removeCollateral'?C:U,user,4663);
    assert.equal(draft.call.to,MORPHO_ADDRESS);assert.equal(draft.call.chainId,4663);assert.equal(draft.call.value,0n);assert.equal(draft.signingEnabled,false);
    const decoded=decodeFunctionData({abi:morphoABI,data:draft.call.data});assert.ok(decoded.args.includes(user));
    for(const approval of draft.approvals){const a=decodeFunctionData({abi:erc20Abi,data:approval.data});assert.equal(a.functionName,'approve');assert.equal(a.args[0],MORPHO_ADDRESS);assert.ok(a.args[1]<(1n<<128n));}
  }
});
test('full repayment uses shares, finite ceilings reset prior allowances and no payload redirects funds',()=>{
  const s=snapshot();s.position.loanAllowance=100n*U;const d=prepareMainnetAction(s,'repay',11n*U,user,4663);const decoded=decodeFunctionData({abi:morphoABI,data:d.call.data});
  assert.equal(decoded.args[1],0n);assert.equal(decoded.args[2],s.position.borrowShares);assert.equal(d.approvals.length,2);
  assert.equal(decodeFunctionData({abi:erc20Abi,data:d.approvals[0].data}).args[1],0n);
  assert.equal(decodeFunctionData({abi:erc20Abi,data:d.approvals[1].data}).args[1],10050000n);
});

test('withdrawal caps actual share burn; minimum proceeds remain explicitly unenforced',()=>{
  const s=snapshot(),d=prepareMainnetAction(s,'withdraw',U,user,4663);const decoded=decodeFunctionData({abi:morphoABI,data:d.call.data});
  assert.equal(decoded.args[1],0n);assert.equal(decoded.args[2],d.maxShares);assert.ok(d.maxShares<=s.position.supplyShares);assert.equal(d.minAssets,995000n);assert.equal(d.minAssetsEnforced,false);
  validateMainnetDraft(d,1001n);
});
test('simulation validation rejects stale quotes, redirected receivers, substituted markets and oversized approvals',()=>{
  const s=snapshot();let d=prepareMainnetAction(s,'borrow',U,user,4663);validateMainnetDraft(d,1000n);
  assert.throws(()=>validateMainnetDraft(d,1061n),/expired/);assert.throws(()=>validateMainnetDraft(d,999n),/invalid/);
  const c=s.candidate;d.call.data=encodeFunctionData({abi:morphoABI,functionName:'borrow',args:[c.params,U,0n,user,other]});assert.throws(()=>validateMainnetDraft(d,1001n),/receiver/);
  d=prepareMainnetAction(s,'borrow',U,user,4663);d.call.data=encodeFunctionData({abi:morphoABI,functionName:'borrow',args:[{...c.params,oracle:other},U,0n,user,user]});assert.throws(()=>validateMainnetDraft(d,1001n),/market/);
  d=prepareMainnetAction(s,'supply',U,user,4663);d.approvals[0].data=encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[MORPHO_ADDRESS,(1n<<256n)-1n]});assert.throws(()=>validateMainnetDraft(d,1001n),/finite/);
});
test('only a successful eth_call produces LIVE_SIMULATION, never SIGNING_ENABLED',async()=>{
  assert.equal(simulationLevel(),'READ_ONLY');assert.equal(simulationLevel('APPROVAL_REQUIRED'),'READ_ONLY');assert.equal(simulationLevel('SIMULATED_ONLY'),'LIVE_SIMULATION');
  const {MORPHO_RUNTIME_HASH}=await import('../lib/morpho-config.ts');
  // Actual runtime code is verified in fork tests; pure state tests must not forge that proof.
  const client={getChainId:async()=>46630,getCode:async()=>{throw Error('must not read wrong chain');}};
  await assert.rejects(simulateMainnetAction(prepareMainnetAction(snapshot(),'borrow',U,user,4663),client),/chain mismatch/);assert.ok(MORPHO_RUNTIME_HASH);
});
test('wrong chain, wrong owner, excessive borrowing, unsafe collateral release and mainnet signing fail closed',()=>{
  const s=snapshot();assert.throws(()=>prepareMainnetAction(s,'supply',U,user,46630),/Mainnet/);assert.throws(()=>prepareMainnetAction(s,'supply',U,other,4663),/own position/);
  assert.throws(()=>prepareMainnetAction(s,'borrow',100n*U,user,4663),/capacity/);assert.throws(()=>prepareMainnetAction(s,'removeCollateral',100n*C,user,4663),/unhealthy/);
  assert.throws(()=>prepareMainnetAction(s,'withdraw',1000n*U,user,4663));assert.throws(()=>assertMainnetSigningApproved(),/DISABLED/);
});
