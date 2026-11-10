import assert from 'node:assert/strict';
import { test } from 'node:test';
import { logRanges, readLogPages } from '../lib/log-ranges.ts';
test('regression: an 11,268,088-block history is split under the RPC limit without gaps or overlap',()=>{
  const from=136170413n,to=147438500n,pages=[...logRanges(from,to)];
  assert.equal(pages.length,2);assert.equal(pages[0].fromBlock,from);assert.equal(pages[1].toBlock,to);
  assert.equal(pages[0].toBlock+1n,pages[1].fromBlock);
  for(const page of pages) assert.ok(page.toBlock-page.fromBlock+1n<=10000000n);
});
test('inclusive page boundaries retain genesis, single blocks and exact size windows',()=>{
  assert.deepEqual([...logRanges(0n,0n)],[{fromBlock:0n,toBlock:0n}]);
  assert.equal([...logRanges(5n,10000004n)].length,1);
  assert.equal([...logRanges(5n,10000005n)].length,2);
});
test('page aggregation preserves records and propagates RPC errors instead of false empty ownership',async()=>{
  const records=await readLogPages(0n,10000000n,async range=>[range.fromBlock]);assert.deepEqual(records,[0n,10000000n]);
  await assert.rejects(readLogPages(0n,0n,async()=>{throw new Error('RPC unavailable')}),/RPC unavailable/);
  for(const args of [[1n,0n,1n],[0n,1n,0n],[-1n,1n,1n]]) assert.throws(()=>[...logRanges(...args)]);
});
