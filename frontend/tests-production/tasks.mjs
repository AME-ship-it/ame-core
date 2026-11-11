import assert from 'node:assert/strict';
import {test} from 'node:test';
const origin=process.env.AME_QA_ORIGIN||'http://127.0.0.1:3000';
const post=(body,extra={})=>fetch(origin+'/api/tasks',{method:'POST',headers:{'content-type':'application/json',...extra},body:JSON.stringify(body)});
test('Tasks V1 route is discoverable, honest about disabled persistence and contains exactly three tasks',async()=>{
 const r=await fetch(origin+'/tasks');assert.equal(r.status,200);const html=await r.text();for(const text of ['Evidence becomes history.','Wallet Verification','Onchain Research','Transaction Analysis','XP recording is disabled.','SIGN &amp; SUBMIT TASK'])assert.ok(html.includes(text),text);const taskLink=[...html.matchAll(/<a\b([^>]*)>/g)].find(m=>m[1].includes('href="/tasks"'));assert.ok(taskLink);assert.match(taskLink[1],/aria-current="page"/);
 const api=await fetch(origin+'/api/tasks');assert.equal(api.status,200);const d=await api.json();assert.equal(d.writesEnabled,false);assert.equal(d.persistence,'not-configured');assert.deepEqual(d.tasks.map(t=>t.xp),[10,20,30]);assert.match(api.headers.get('cache-control'),/no-store/);assert.match(api.headers.get('server-timing'),/app;dur=/);
});
test('public Tasks API blocks score writes, replay payloads, unknown inputs and cross-origin requests',async()=>{
 assert.equal((await post({action:'start',agentId:'1',wallet:'0x1000000000000000000000000000000000000001',type:'wallet',submission:{}})).status,503);
 assert.equal((await post({action:'submit',challengeId:'00000000-0000-0000-0000-000000000000',signature:'0x'+'0'.repeat(130)})).status,503);
 assert.equal((await post({action:'award',xp:999})).status,400);assert.equal((await post({action:'reference'},{origin:'https://attacker.example'})).status,403);
 assert.equal((await post({action:'inspect',type:'research',submission:{target:'invalid',analysis:{}}})).status,400);
 assert.equal((await fetch(origin+'/api/tasks?registry=invalid')).status,400);
});
