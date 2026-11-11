import assert from 'node:assert/strict';
import {test} from 'node:test';
import {keccak256} from 'viem';
import {readTokenConfig,createTokenReader} from '../lib/server/token-state.ts';
import {readHolderConfig,tokenHolderAccess,handleHolderAccess} from '../lib/server/holder-access.ts';
import {boundedJSON,createRateLimiter} from '../lib/server/api-guard.ts';
import {holderPresentation,isUnlockedForWallet} from '../lib/holder-access.ts';
import {uniqueEvidence} from '../lib/evidence.ts';
const token='0x3000000000000000000000000000000000000003',wallet='0x1000000000000000000000000000000000000001',other='0x2000000000000000000000000000000000000002',hash='0x'+'1'.repeat(64);
const env={AME_TOKEN_VERIFIED:'1',AME_TOKEN_CHAIN_ID:'4663',AME_TOKEN_ADDRESS:token,AME_TOKEN_RUNTIME_HASH:keccak256('0x6000'),AME_TOKEN_SYMBOL:'AME',AME_TOKEN_DECIMALS:'6',AME_TOKEN_MAX_SUPPLY:'100000000000000000000',AME_TOKEN_DEPLOYMENT_BLOCK:'1'};
function setup(){let time=1_000_000,head=101n,reads=0;const cfg=readTokenConfig(env);
  const rpc={getChainId:async()=>4663,getBlock:async(args)=>({number:args?.blockNumber??head,timestamp:1000n,hash}),getCode:async()=> '0x6000',getLogs:async()=>[],readContract:async({functionName,args})=>{reads++;return {decimals:6,symbol:'AME',totalSupply:100000000000000000000n,balanceOf:args?.[0]===other?0n:9007199254740993000000n/1000n,allowance:5n}[functionName];}};
  const reader=createTokenReader({config:()=>cfg,client:()=>rpc,now:()=>time});return {cfg,rpc,reader,reads:()=>reads,tick:()=>{time+=11000;},advance:()=>{head++;}};
}
test('token activation is explicit, independent of the header CA and holder threshold',()=>{
  assert.equal(readTokenConfig({}),null);assert.equal(readTokenConfig({AME_TOKEN_ADDRESS:token}),null);
  assert.equal(readTokenConfig(env).chainId,4663);
  for(const patch of [{AME_TOKEN_CHAIN_ID:'1'},{AME_TOKEN_RUNTIME_HASH:'0x'},{AME_TOKEN_SYMBOL:''},{AME_TOKEN_DECIMALS:'256'},{AME_TOKEN_MAX_SUPPLY:'0'},{AME_TOKEN_RPC_URL:'http://localhost:8545'},{AME_TOKEN_DEPLOYMENT_BLOCK:'0'}])assert.throws(()=>readTokenConfig({...env,...patch}));
  assert.throws(()=>readHolderConfig({NODE_ENV:'production',AME_TOKEN_ADDRESS:token,AME_TOKEN_CHAIN_ID:'4663',AME_HOLDER_THRESHOLD:'1'}));
  assert.equal(readHolderConfig({...env,NODE_ENV:'production',AME_HOLDER_THRESHOLD:'1'}).chainId,4663);
});
test('unactivated token makes no RPC requests or holder grants',async()=>{
  const reader=createTokenReader({config:()=>null,client:()=>{throw Error('no calls');}});const data=await reader(wallet);assert.equal(data.status,'disabled');assert.equal(data.token,null);assert.equal(data.balance,null);assert.ok(!('access'in data));
});
test('token reads are block-pinned, bigint-safe, wallet-isolated and deduplicated',async()=>{
  const s=setup(),blocks=[];const read=s.rpc.readContract;s.rpc.readContract=async a=>{blocks.push(a.blockNumber);return read(a);};
  const results=await Promise.all(Array.from({length:10},()=>s.reader(wallet)));
  assert.equal(s.reads(),4);assert.equal(results[0].status,'synchronized');assert.equal(results[0].block,'99');assert.deepEqual(new Set(blocks),new Set([99n]));assert.equal(results[0].balance,'9007199254740993000');
  assert.equal((await s.reader(other)).balance,'0');s.tick();const before=s.reads();assert.equal((await s.reader(wallet)).status,'synchronized');assert.equal(s.reads(),before);
});
test('whole-snapshot RPC failover rejects a wrong-chain primary',async()=>{
  const s=setup();s.cfg.rpc=['https://bad.example','https://good.example'];let badReads=0;
  const reader=createTokenReader({config:()=>s.cfg,now:()=>1_000_000,client:url=>url.includes('bad')?{getChainId:async()=>1,readContract:async()=>{badReads++;}}:s.rpc});
  assert.equal((await reader(wallet)).status,'synchronized');assert.equal(badReads,0);
});
test('metadata mismatch, runtime mismatch, stale blocks and reorgs fail closed',async()=>{
  for(const patch of ['symbol','code','stale','future','reorg']){const s=setup();if(patch==='symbol'){const read=s.rpc.readContract;s.rpc.readContract=async a=>a.functionName==='symbol'?'OTHER':read(a);}if(patch==='code')s.rpc.getCode=async()=> '0x6001';if(patch==='stale')s.rpc.getBlock=async()=>({number:101n,timestamp:1n,hash});if(patch==='future')s.rpc.getBlock=async()=>({number:101n,timestamp:1100n,hash});if(patch==='reorg'){let n=0;const b=s.rpc.getBlock;s.rpc.getBlock=async a=>({...await b(a),hash:++n===3?'0x'+'2'.repeat(64):hash});}assert.equal((await s.reader(wallet)).status,'unavailable',patch);}
});
test('failed refresh clears cached success; allowance reads require an approved spender',async()=>{
  const s=setup();s.cfg.spender=other;assert.equal((await s.reader(wallet)).allowance,'5');s.advance();s.rpc.getCode=async()=> '0x';assert.equal((await s.reader(wallet,true)).status,'unavailable');
  s.tick();assert.equal((await s.reader(wallet)).status,'unavailable');
});
test('bounded Transfer monitoring reports only the recent indexed interval',async()=>{
  const s=setup();await s.reader(wallet);s.advance();let windows=[];s.rpc.getLogs=async args=>{windows.push([args.fromBlock,args.toBlock]);return [{blockHash:hash,transactionHash:hash,logIndex:0}];};const d=await s.reader(wallet,true);assert.equal(d.transferCount,1);assert.equal(d.recentWindowComplete,true);assert.equal(windows.length,2);assert.equal(windows[0][1]-windows[0][0]<=2048n,true);
});
test('body byte limit applies to chunked requests and limiter recovers after its window',async()=>{
  await assert.rejects(boundedJSON(new Request('https://example.com',{method:'POST',body:'x'.repeat(2049)})),/BODY_TOO_LARGE/);
  assert.deepEqual(await boundedJSON(new Request('https://example.com',{method:'POST',body:'{"ok":true}'})),{ok:true});
  let now=0;const allow=createRateLimiter(2,100,()=>now);assert.equal(allow('a'),true);assert.equal(allow('a'),true);assert.equal(allow('a'),false);assert.equal(allow('b'),true);now=101;assert.equal(allow('a'),true);
});
test('evidence processing is idempotent, source-bound and reorg-sensitive',()=>{
  const e={address:token,blockHash:hash,transactionHash:hash,logIndex:1};assert.equal(uniqueEvidence([e,e,{...e,removed:true}],4663,token).length,1);
  assert.throws(()=>uniqueEvidence([{...e,address:other}],4663,token),/provenance/);
  assert.throws(()=>uniqueEvidence([e,{...e,blockHash:'0x'+'2'.repeat(64)}],4663,token),/reorg/);
});

test('positive token balance recognizes a holder without granting any unapproved entitlement',async()=>{
  const s=setup(),snapshot=await s.reader(wallet);assert.equal(snapshot.holderStatus,'HOLDER');const d=tokenHolderAccess(snapshot);assert.equal(d.isHolder,true);assert.equal(d.access,'locked');assert.equal(d.threshold,null);assert.equal(d.reason,'ENTITLEMENTS_DISABLED');assert.equal(isUnlockedForWallet(d,wallet,1000001),false);assert.equal(holderPresentation({connected:true,wallet,data:d,now:1000001}),'holder-no-entitlements');
  const r=await handleHolderAccess(new Request('https://example.com',{method:'POST',body:JSON.stringify({walletAddress:wallet,intent:'action'})}),async()=>d);assert.equal(r.status,403);
  const zero=tokenHolderAccess(await s.reader(other));assert.equal(zero.isHolder,false);assert.equal(zero.access,'locked');assert.equal(zero.reason,'NOT_HOLDER');
});

test('initial high-block indexing is bounded and large observation gaps never claim complete history',async()=>{
  const s=setup();let head=100000n,windows=[];
  s.rpc.getBlock=async args=>({number:args?.blockNumber??head,timestamp:1000n,hash});
  s.rpc.getLogs=async args=>{windows.push(args);return [];};
  const first=await s.reader(wallet);assert.equal(first.recentWindowComplete,true);assert.equal(windows.length,2);assert.equal(windows[0].toBlock-windows[0].fromBlock,2047n);
  head+=10000n;windows=[];const next=await s.reader(wallet,true);assert.equal(next.status,'synchronized');assert.equal(next.recentWindowComplete,false);assert.equal(next.transferCount,null);assert.equal(windows.length,0);
});
