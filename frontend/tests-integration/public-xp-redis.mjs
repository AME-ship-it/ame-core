import assert from 'node:assert/strict';import {test} from 'node:test';import {randomUUID} from 'node:crypto';
import {privateKeyToAccount,generatePrivateKey} from 'viem/accounts';import {verifyMessage} from 'viem';
import {RedisTaskStore} from '../lib/tasks/store.ts';import {createTasksService} from '../lib/tasks/service.ts';import {NFT_WRITE_GRANT} from '../lib/tasks/activation.ts';import {REGISTRY} from '../lib/tasks/chain.ts';
const url=process.env.AME_TASKS_TEST_REDIS_URL,token=process.env.AME_TASKS_TEST_REDIS_TOKEN;
test('NFT eligibility supports independent fixture owners beyond five awards, with atomic rewards and a live kill switch',{skip:!url||!token},async()=>{
 const ns='ame-public-xp-qa-'+randomUUID(),prefix='{'+ns+'}:',s=new RedisTaskStore(url,token,fetch,ns),at=await s.clock(),epoch='0x'+'a'.repeat(64),owners=Array.from({length:9},()=>privateKeyToAccount(generatePrivateKey()));let changed=false;
 process.env.AME_TASKS_WRITES_ENABLED='1';process.env.AME_TASKS_ACCESS_MODE='eligible-nft';
 const chain={authority:async id=>{const owner=owners[Number(id)-990001];if(!owner)throw Error('AGENT_NOT_FOUND');return {owner:owner.address,assignedWallet:owner.address,epoch:changed&&id==='990009'?'0x'+'b'.repeat(64):epoch,blockNumber:'1',blockHash:'0x'+'c'.repeat(64),chainTime:at};},signature:async(address,message,signature)=>verifyMessage({address,message,signature}),snapshot:async()=>({})};
 const make=()=>createTasksService({chain,store:()=>new RedisTaskStore(url,token,fetch,ns)});
 try{
  assert.equal((await make().status()).writesEnabled,false);
  await s.command(['SET',prefix+'activation-state:'+NFT_WRITE_GRANT.key,'enabled']);
  assert.equal((await make().status()).writesEnabled,true);
  await assert.rejects(make().start({agentId:'990002',wallet:owners[0].address,type:'wallet',submission:{}},'https://www.ame.guru','bad-owner'),/NOT_AUTHORIZED/);
  for(let i=0;i<8;i++){
   const id=String(990001+i),wallet=owners[i],service=make(),c=await service.start({agentId:id,wallet:wallet.address,type:'wallet',submission:{}},'https://www.ame.guru',id);
   assert.match(c.message,/Maximum XP: 10/);const signature=await wallet.signMessage({message:c.message});
   const attempts=await Promise.allSettled(Array.from({length:3},()=>make().submit({challengeId:c.challengeId,signature},'https://www.ame.guru',id)));assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
   const state=await make().status(id);assert.equal(state.xp,10);assert.equal(state.reputation.index,17);assert.equal(state.history.length,1);assert.equal(state.recordingWindow,null);assert.equal(state.eligibilityMode,'eligible-nft');assert.ok(state.writePermissions.some(p=>p.wallet===wallet.address&&p.tasks.length===6));
   await assert.rejects(make().start({agentId:id,wallet:wallet.address,type:'wallet',submission:{}},'https://www.ame.guru',id),/ALREADY_COMPLETED/);
  }
  const c=await make().start({agentId:'990009',wallet:owners[8].address,type:'wallet',submission:{}},'https://www.ame.guru','transfer');const signature=await owners[8].signMessage({message:c.message});changed=true;await assert.rejects(make().submit({challengeId:c.challengeId,signature},'https://www.ame.guru','transfer'),/AUTHORIZATION_CHANGED/);assert.equal((await make().status('990009')).xp,0);
  await s.command(['SET',prefix+'activation-state:'+NFT_WRITE_GRANT.key,'disabled']);assert.equal((await make().status()).writesEnabled,false);assert.equal(await s.activationOpen(NFT_WRITE_GRANT),false);
  const r={id:randomUUID(),agentId:'990009',registry:REGISTRY,epoch,type:'wallet',status:'VERIFIED',xp:10};assert.equal(await s.finish(r,'closed-fixture',NFT_WRITE_GRANT),'WRITE_SCOPE_CLOSED');
  assert.equal((await make().status('990002')).xp,10);
 }finally{let cursor='0';do{const [next,keys]=await s.command(['SCAN',cursor,'MATCH',prefix+'*','COUNT',100]);cursor=next;if(keys.length){assert.ok(keys.every(k=>k.startsWith(prefix)));await s.command(['DEL',...keys]);}}while(cursor!=='0');}
});
