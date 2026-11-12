import assert from 'node:assert/strict';import {test} from 'node:test';
const origin=process.env.AME_QA_ORIGIN||'http://127.0.0.1:3000';
const post=async body=>{const r=await fetch(origin+'/api/tasks',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
test('public production eligibility derives independent owner permissions and prepares real bound challenges without awarding unsigned XP',{skip:process.env.AME_QA_PUBLIC_XP_ACTIVE!=='1'},async()=>{
 const agents=[];for(const id of ['2','3']){const r=await fetch(origin+'/api/tasks?agentId='+id);assert.equal(r.status,200);const d=await r.json();assert.equal(d.eligibilityMode,'eligible-nft');assert.equal(d.writesEnabled,true);assert.equal(d.recordingWindow,null);assert.equal(d.writableTasks.length,6);assert.ok(d.writePermissions.some(p=>p.wallet.toLowerCase()===d.owner.toLowerCase()&&p.tasks.length===6));agents.push(d);}
 assert.notEqual(agents[0].owner.toLowerCase(),agents[1].owner.toLowerCase());
 const wrong=await post({action:'start',agentId:'2',wallet:agents[1].owner,type:'wallet',submission:{}});assert.equal(wrong.status,403);
 for(const a of agents){
  // A completed category must stay locked. No test fabricates a real signature.
  if(a.history.some(r=>r.type==='wallet'&&r.status==='VERIFIED'))continue;
  const c=await post({action:'start',agentId:a.agentId,wallet:a.owner,type:'wallet',submission:{}});assert.equal(c.status,200);assert.match(c.data.message,new RegExp('Agent ID: '+a.agentId));assert.match(c.data.message,/Maximum XP: 10/);assert.ok(c.data.message.includes(a.owner));
  const invalid=await post({action:'submit',challengeId:c.data.challengeId,signature:'0x'+'0'.repeat(130)});assert.equal(invalid.status,401);
  const fresh=await fetch(origin+'/api/tasks?agentId='+a.agentId).then(r=>r.json());assert.ok(!fresh.history.some(r=>r.id===c.data.challengeId));
 }
});
