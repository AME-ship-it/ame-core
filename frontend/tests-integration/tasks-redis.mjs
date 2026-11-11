import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {RedisTaskStore} from '../lib/tasks/store.ts';
import {REGISTRY} from '../lib/tasks/chain.ts';
const enabled=process.env.AME_TASKS_TEST_REDIS_ISOLATED==='1'&&!!process.env.AME_TASKS_TEST_REDIS_URL&&!!process.env.AME_TASKS_TEST_REDIS_TOKEN;
test('real isolated Redis Lua allocation is atomic across concurrent clients',{skip:!enabled},async()=>{
 const stores=Array.from({length:8},()=>new RedisTaskStore(process.env.AME_TASKS_TEST_REDIS_URL,process.env.AME_TASKS_TEST_REDIS_TOKEN));const id=String(BigInt('0x'+randomUUID().replaceAll('-',''))),epoch=randomUUID(),resource=randomUUID();
 const record={id:randomUUID(),chainId:4663,registry:REGISTRY,agentId:id,epoch,type:'research',submitter:'0x1000000000000000000000000000000000000001',status:'VERIFIED',xp:20,evidenceId:resource,version:'ame-tasks-v1.0',timestamp:new Date().toISOString(),evidence:{integrationTest:true},submission:{},transitions:[]};
 const results=await Promise.all(stores.map(s=>s.finish({...record,id:randomUUID()},resource)));assert.equal(results.filter(v=>v==='OK').length,1);const state=await stores[0].history(`4663:${REGISTRY.toLowerCase()}:${id}`,epoch);assert.equal(state.completed.length,1);assert.equal(state.history.length,1);
 const nonce=randomUUID();await stores[0].putChallenge(nonce,{test:true});assert.equal((await stores[0].getChallenge(nonce)).test,true);assert.equal((await Promise.all(stores.map(s=>s.claim(nonce)))).filter(Boolean).length,1);
});
