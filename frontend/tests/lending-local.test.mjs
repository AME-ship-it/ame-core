import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { getAddress } from 'viem';
import { lendingConfiguration, readLendingMarket } from '../lib/lending.ts';
import {readLendingHistory} from '../lib/lending-history.ts';
const enabled=!!lendingConfiguration.address;
let manifest;
if(enabled) manifest=JSON.parse(await readFile(new URL('../../contracts/deployments/lending-localhost.json',import.meta.url),'utf8'));
test('configured local lending SDK reads the real market and confirmed closed lifecycle position',{skip:!enabled},async()=>{
  const state=await readLendingMarket(undefined,1n);
  assert.equal(state.address,getAddress(manifest.contracts.market.address));
  assert.equal(state.credit.position.closed,true);assert.equal(state.credit.debt,0n);
  assert.equal(state.credit.position.collateral,0n);assert.equal(state.loanSymbol,'tUSD');assert.equal(state.collateralSymbol,'tCOL');
  assert.equal(state.supplyBalance,undefined);assert.equal(state.apr,500n);
});
test('local credit history is generated from actual engine receipt logs, without imported self-attestations',{skip:!enabled},async()=>{
  const state=await readLendingMarket(undefined,1n);
  assert.equal(state.credit.historyUnavailable,false);
  assert.deepEqual(state.credit.receipts.map(event=>event.args.kind),[0,1]);
  assert.equal(state.credit.history[0],1n);assert.equal(state.credit.history[4],0n);assert.equal(state.credit.reputation,0n);
});
test('invalid lending position is an actual contract failure, not fabricated empty state',{skip:!enabled},async()=>{
  await assert.rejects(readLendingMarket(undefined,999999n),/InvalidPosition/);
});
test('chart history reads actual archived market snapshots with block timestamps',{skip:!enabled},async()=>{
  const history=await readLendingHistory();assert.ok(history.points.length>=2);assert.equal(history.unavailable,0);
  for(const p of history.points){assert.ok(p.block>=lendingConfiguration.deploymentBlock);assert.ok(p.timestamp>0);assert.ok(p.cash>=0n);assert.ok(p.principal>=0n);}
  const current=await readLendingMarket();assert.equal(history.points.at(-1).cash,current.cash);
});
