import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveLendingConfiguration, positiveId } from '../lib/lending-config.ts';
const address = '0xAC214EeDeA040f247962C87eF779dEBdBc86727c';
test('lending is unavailable without explicit configuration, including production testnet', () => {
  for (const chain of [31337, 46630]) assert.match(resolveLendingConfiguration(chain).issue, /UNAVAILABLE/);
});
test('mainnet lending is always disabled even with an address and block', () => {
  assert.match(resolveLendingConfiguration(4663, address, '1').issue, /Mainnet lending is disabled/);
});
test('lending addresses and event blocks are strict and isolated', () => {
  for (const [a, b] of [['0x0000000000000000000000000000000000000000','1'],[address,'0'],[address,'-1'],[address,'wat'],[address,'9007199254740992'],['invalid','1']]) assert.ok(resolveLendingConfiguration(46630, a, b).issue);
  assert.deepEqual(resolveLendingConfiguration(46630,address,'123'), {address, deploymentBlock:123n, issue:null});
});
test('IDs reject hexadecimal, negatives, decimals, zero and uint256 overflow', () => {
  for (const id of ['0','-1','0x1','1.2','',String(1n<<256n)]) assert.throws(()=>positiveId(id));
  assert.equal(positiveId('42'),42n);
});
test('production rejects local lending configuration while accepting an explicit testnet market', () => {
  const previous=process.env.NODE_ENV;
  try { process.env.NODE_ENV='production'; assert.ok(resolveLendingConfiguration(31337,address,'1').issue); assert.equal(resolveLendingConfiguration(46630,address,'1').issue,null); }
  finally { if(previous===undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV=previous; }
});
