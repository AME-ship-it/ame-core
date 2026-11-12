import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {RedisTaskStore} from '../lib/tasks/store.ts';
import {createCreditLedger,CREDIT_POLICY} from '../lib/tasks/credits.ts';
import {REGISTRY} from '../lib/tasks/chain.ts';
const url=process.env.AME_TASKS_TEST_REDIS_URL,token=process.env.AME_TASKS_TEST_REDIS_TOKEN;
test('real Redis credit ledger: atomic spending, idempotency, replay, epoch isolation and recovery',{skip:!url||!token},async()=>{
 const namespace='ame-credits-qa-'+randomUUID(),prefix='{'+namespace+'}:',s=new RedisTaskStore(url,token),epoch='0x'+'a'.repeat(64),wallet='0x1000000000000000000000000000000000000001';
 const make=(approved=true,authorize=async()=>true)=>createCreditLedger({store:new RedisTaskStore(url,token),registry:REGISTRY,namespace,policy:approved?{version:'fixture-only',grantPurposes:['fixture'],spendPurposes:['fixture'],maxUnits:100}:null,authorize});
 const intent=(operation,units)=>({id:randomUUID(),authorizationId:randomUUID(),agentId:'999998',wallet,epoch,operation,units,purpose:'fixture'});
 try{
  assert.equal(CREDIT_POLICY.issuanceEnabled,false);assert.equal(CREDIT_POLICY.spendingEnabled,false);
  await assert.rejects(make(false).transact(intent('grant',10)),/POLICY_NOT_APPROVED/);
  await assert.rejects(make(true,async()=>false).transact(intent('grant',10)),/AUTHORIZATION_INVALID/);
  const grant=intent('grant',100),same=await Promise.all(Array.from({length:12},()=>make().transact(grant)));
  assert.ok(same.every(r=>r.id===grant.id&&r.balance===100));assert.equal(await make().balance('999998',wallet,epoch),100);
  await assert.rejects(make().transact({...grant,units:99}),/IDEMPOTENCY_CONFLICT/);
  await assert.rejects(make().transact({...grant,id:randomUUID()}),/AUTHORIZATION_REPLAYED/);
  const spend=await Promise.allSettled(Array.from({length:20},()=>make().transact(intent('spend',10))));
  assert.equal(spend.filter(r=>r.status==='fulfilled').length,10);assert.equal(await make().balance('999998',wallet,epoch),0);
  assert.equal((await make().history('999998',wallet,epoch)).length,11);
  assert.equal(await make().balance('999998',wallet,'0x'+'b'.repeat(64)),0);
  assert.equal(await make().balance('999999',wallet,epoch),0);
  await assert.rejects(make().transact({...intent('grant',1),purpose:'unapproved'}),/PURPOSE_NOT_APPROVED/);
  await assert.rejects(make().transact(intent('grant',1.5)),/INVALID_CREDIT_INTENT/);
  // A new process proves this is Redis authority, not an in-process cache.
  const {execFileSync}=await import('node:child_process');const recovered=execFileSync(process.execPath,['--input-type=module','-e',`import {RedisTaskStore} from './lib/tasks/store.ts';const s=new RedisTaskStore(process.env.AME_TASKS_TEST_REDIS_URL,process.env.AME_TASKS_TEST_REDIS_TOKEN);console.log(await s.command(['LLEN',process.env.CREDIT_HISTORY_KEY]));`],{encoding:'utf8',env:{...process.env,CREDIT_HISTORY_KEY:(await s.command(['KEYS',prefix+'history:*']))[0]}});assert.equal(Number(recovered.trim()),11);
 }finally{let cursor='0';do{const [next,keys]=await s.command(['SCAN',cursor,'MATCH',prefix+'*','COUNT',100]);cursor=next;if(keys.length){assert.ok(keys.every(k=>k.startsWith(prefix)));await s.command(['DEL',...keys]);}}while(cursor!=='0');}
});
