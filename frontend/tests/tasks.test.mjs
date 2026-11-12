import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
import {verifyMessage,zeroAddress,getAddress} from 'viem';
import {createTasksService} from '../lib/tasks/service.ts';
import {TASKS,contentHash,canonical,submission,score} from '../lib/tasks/model.ts';
import {RedisTaskStore,FINISH_LUA} from '../lib/tasks/store.ts';
const origin='https://www.ame.guru',clock=1800000000000;
const owner=privateKeyToAccount(generatePrivateKey()),operator=privateKeyToAccount(generatePrivateKey()),outsider=privateKeyToAccount(generatePrivateKey());
const hash='0x'+'a'.repeat(64);
const research={blockNumber:'123',blockHash:hash,codeHash:hash,codeBytes:'50',balanceWei:'0'};
const transaction={blockNumber:'100',blockHash:hash,status:'success',gasUsed:'21000',effectiveGasPriceWei:'2',feeWei:'42000',logCount:'0',logsHash:hash};
class AtomicStore{
 challenges=new Map();used=new Set();records=[];rewards=new Map();resources=new Set();
 async putAcceptanceProof(id,value){this.challenges.set('receipt-'+id,structuredClone(value));}async getAcceptanceProof(id){return this.challenges.get('receipt-'+id);}
 async putChallenge(id,c){this.challenges.set(id,structuredClone(c));}async getChallenge(id){const c=this.challenges.get(id);if(!c)throw Error('missing');return c;}
 async claim(id){if(this.used.has(id))return false;this.used.add(id);return true;}async limit(){return true;}
 async finish(r,resource){const key=r.agentId+':'+r.epoch+':'+r.type;if(this.rewards.has(key))return 'DUPLICATE_TASK';if(r.status==='VERIFIED'&&this.resources.has(resource))return 'DUPLICATE_EVIDENCE';this.records.push(structuredClone(r));if(r.status==='VERIFIED'){this.rewards.set(key,r);this.resources.add(resource);}return 'OK';}
 async history(identity,epoch){const id=identity.split(':').at(-1);return {history:this.records.filter(r=>r.agentId===id).slice(-100).reverse(),completed:[...this.rewards.values()].filter(r=>r.agentId===id&&r.epoch===epoch)};}
}
function setup(){const store=new AtomicStore();let state={owner:owner.address,assignedWallet:operator.address,epoch:'epoch-a',blockNumber:'200',blockHash:hash,chainTime:clock};let rpcFail=false;
 const chain={authority:async()=>({...state}),signature:async(address,message,signature)=>verifyMessage({address,message,signature}),snapshot:async(type)=>{if(rpcFail)throw Error('RPC offline');return type==='research'?research:type==='transaction'?transaction:{};},reference:async()=>({chainId:4663,blockNumber:'123'})};
 const service=createTasksService({grant:()=>undefined,chain,store:()=>store,enabled:()=>true,now:()=>clock,uuid:randomUUID});return {store,chain,service,setState:s=>Object.assign(state,s),failRPC:()=>{rpcFail=true;}};
}
const payload=(type='wallet',agentId='1',wallet=owner.address,target='0x1000000000000000000000000000000000000001')=>({agentId,wallet,type,submission:type==='wallet'?{}:{target:type==='research'?target:hash,analysis:type==='research'?research:transaction}});
async function signed(env,p=payload(),signer=owner){const c=await env.service.start(p,origin,'client');const signature=await signer.signMessage({message:c.message});return {challengeId:c.challengeId,signature};}
test('exactly three deterministic task rewards, strict schemas and canonical content hashes',()=>{
 assert.deepEqual(TASKS.map(t=>t.xp),[10,20,30,20,25,35]);assert.equal(contentHash({b:2,a:1}),contentHash({a:1,b:2}));assert.equal(canonical({block:1n}),'{'+'"block":"1"}');
 for(const v of [{target:'0x123',analysis:research},{target:payload('research').submission.target,analysis:{...research,xp:'999'}},{target:payload('research').submission.target,analysis:{...research,codeBytes:'-1'}}])assert.throws(()=>submission('research',v));assert.throws(()=>submission('wallet',{xp:10}));
});
test('writes fail closed without durable storage or explicit enablement; XP stays unavailable',async()=>{
 for(const service of [createTasksService({grant:()=>undefined,store:()=>null,enabled:()=>true}),createTasksService({grant:()=>undefined,store:()=>new AtomicStore(),enabled:()=>false})]){assert.equal((await service.status()).writesEnabled,false);await assert.rejects(service.start(payload(),origin,'ip'),/TASK_WRITES_DISABLED/);}
});
test('wallet challenge binds origin, chain, registry, agent, purpose, epoch, submission and expiry',async()=>{
 const e=setup(),c=await e.service.start(payload(),origin,'ip');for(const text of [origin,'4663','Agent ID: 1','Epoch','Submission hash','Expires','complete wallet'])assert.ok(c.message.toLowerCase().includes(text.toLowerCase()));
 const sig=await owner.signMessage({message:c.message});await assert.rejects(e.service.submit({challengeId:c.challengeId,signature:sig},'https://attacker.example','ip'),/ORIGIN_MISMATCH/);
 const r=await e.service.submit({challengeId:c.challengeId,signature:sig},origin,'ip');assert.equal(r.xpAwarded,10);assert.equal(r.record.submitter,owner.address);assert.deepEqual(r.record.transitions.map(x=>x.status),['STARTED','SUBMITTED','VERIFYING','VERIFIED']);
 await assert.rejects(e.service.submit({challengeId:c.challengeId,signature:sig},origin,'ip'),/REPLAYED/);assert.equal(e.store.records.length,1);
});
test('valid assigned-wallet signature works; unauthorized wallets and forged signatures cannot award',async()=>{
 const e=setup();await assert.rejects(e.service.start(payload('wallet','1',outsider.address),origin,'ip'),/NOT_AUTHORIZED/);
 const c=await e.service.start(payload(),origin,'ip');await assert.rejects(e.service.submit({challengeId:c.challengeId,signature:await outsider.signMessage({message:c.message})},origin,'ip'),/INVALID_WALLET_SIGNATURE/);
 const result=await e.service.submit(await signed(e,payload('wallet','1',operator.address),operator),origin,'ip');assert.equal(result.xpAwarded,10);
});
test('ownership transfer, transfer back, wallet reassignment and expiry invalidate previous challenges',async()=>{
 for(const change of [{owner:outsider.address,assignedWallet:zeroAddress,epoch:'new'},{epoch:'transfer-away-and-back'},{assignedWallet:outsider.address},{chainTime:clock+300001}]){const e=setup(),s=await signed(e);e.setState(change);await assert.rejects(e.service.submit(s,origin,'ip'));assert.equal(e.store.records.length,0);}
});
test('all three tasks reach 60 XP once; historical ownership XP is excluded',async()=>{
 const e=setup();for(const type of ['wallet','research','transaction'])assert.ok((await e.service.submit(await signed(e,payload(type)),origin,'ip')).xpAwarded>0);
 const status=await e.service.status('1');assert.equal(status.xp,60);assert.equal(status.verifiedCount,3);assert.equal(score([...e.store.records,...e.store.records]),60);await assert.rejects(e.service.start(payload(),origin,'ip'),/ALREADY_COMPLETED/);
 e.setState({epoch:'new-owner',owner:outsider.address,assignedWallet:zeroAddress});const next=await e.service.status('1');assert.equal(next.xp,0);assert.equal(next.history.length,3);
});
test('incorrect analysis and RPC failure create immutable rejections with zero XP',async()=>{
 for(const offline of [false,true]){const e=setup();const p=payload('research');if(!offline)p.submission.analysis={...research,codeBytes:'51'};const s=await signed(e,p);if(offline)e.failRPC();const r=await e.service.submit(s,origin,'ip');assert.equal(r.record.status,'REJECTED');assert.equal(r.xpAwarded,0);assert.equal((await e.service.status('1')).xp,0);}
});
test('reused contract or transaction evidence cannot reward another agent',async()=>{
 for(const type of ['research','transaction']){const e=setup();await e.service.submit(await signed(e,payload(type)),origin,'ip');await assert.rejects(e.service.submit(await signed(e,payload(type,'2')),origin,'ip'),/DUPLICATE_EVIDENCE/);assert.equal((await e.service.status('2')).xp,0);}
});
test('concurrent valid submissions allocate exactly one reward and one completion',async()=>{
 const e=setup();const requests=await Promise.all(Array.from({length:15},()=>signed(e)));const results=await Promise.allSettled(requests.map(r=>e.service.submit(r,origin,'ip')));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(e.store.records.length,1);assert.equal((await e.service.status('1')).xp,10);
});
test('evidence observations and grading never award or persist tasks',async()=>{
 const e=setup();const p=payload('research');const a=await e.service.observe({type:'research',target:p.submission.target});assert.deepEqual(a.snapshot,research);assert.equal(a.awardedXP,0);assert.equal((await e.service.inspect({type:'research',submission:p.submission})).matches,true);assert.equal(e.store.records.length,0);
});
test('ownership changes during verification reject awards before persistence',async()=>{
 const e=setup();const s=await signed(e,payload('research'));const original=e.chain.snapshot;e.chain.snapshot=async(...args)=>{const d=await original(...args);e.setState({epoch:'changed',owner:outsider.address,assignedWallet:zeroAddress});return d;};const r=await e.service.submit(s,origin,'ip');assert.equal(r.xpAwarded,0);assert.equal(r.record.status,'REJECTED');
});
test('Redis REST adapter uses atomic same-slot Lua, expiring challenges and NX replay claims',async()=>{
 const requests=[];const fake=async(url,init)=>{const cmd=JSON.parse(init.body);requests.push(cmd);return Response.json({result:cmd[0]==='EVAL'?'OK':cmd[0]==='SET'?'OK':null});};const s=new RedisTaskStore('https://redis.example/','not-a-real-credential',fake);await s.putChallenge('id',{x:1});assert.deepEqual(requests[0].slice(-3),['NX','EX',300]);assert.equal(await s.claim('id'),true);
 const r={id:'id',registry:'0x1111111111111111111111111111111111111111',agentId:'1',epoch:'e',type:'wallet',status:'VERIFIED'};assert.equal(await s.finish(r,'resource'),'OK');const cmd=requests.at(-1);assert.equal(cmd[0],'EVAL');assert.equal(cmd[1],FINISH_LUA);assert.equal(cmd[2],8);assert.ok(cmd.slice(3,11).every(k=>k.startsWith('{ame-tasks-v1}:')));assert.match(FINISH_LUA,/DUPLICATE_EVIDENCE/);assert.match(FINISH_LUA,/HSET/);
 await assert.rejects(new RedisTaskStore('https://redis.example/','x',async()=>Response.json({error:'denied'})).claim('id'),/STORAGE_UNAVAILABLE/);
 assert.throws(()=>new RedisTaskStore('http://localhost/','x'));
});
import {createTasksChain,DEPLOYMENT_BLOCK} from '../lib/tasks/chain.ts';
import {agentRuntimeBytecode} from '../lib/generated/agent.ts';
test('actual RPC verifier pins research evidence and rejects empty code, stale blocks and wrong chains',async()=>{
 const head={number:DEPLOYMENT_BLOCK+100n,hash,timestamp:BigInt(Math.floor(Date.now()/1000))};let chainId=4663,code='0x6000',old=false;
 const client={getChainId:async()=>chainId,getBlock:async({blockNumber}={})=>({...head,number:blockNumber??head.number,timestamp:head.timestamp-(blockNumber?(old?1000n:10n):0n)}),getCode:async()=>code,getBalance:async()=>5n};const chain=createTasksChain(client);const input={target:payload('research').submission.target,analysis:{blockNumber:String(head.number-3n)}};
 const r=await chain.snapshot('research',input);assert.equal(r.codeBytes,'2');assert.equal(r.balanceWei,'5');
 code='0x';await assert.rejects(chain.snapshot('research',input),/NO_CONTRACT_CODE/);code='0x6000';old=true;await assert.rejects(chain.snapshot('research',input),/SNAPSHOT_EXPIRED/);old=false;chainId=1;await assert.rejects(chain.snapshot('research',input),/WRONG_NETWORK/);
});
test('actual transaction verifier calculates fees/log digest, deduplicates reads and checks reorgs on cache hits',async()=>{
 const now=BigInt(Math.floor(Date.now()/1000)),head={number:DEPLOYMENT_BLOCK+100n,hash,timestamp:now};let receiptReads=0,reorg=false;
 const receipt={blockNumber:head.number-10n,blockHash:hash,status:'success',gasUsed:21000n,effectiveGasPrice:3n,logs:[{address:owner.address,topics:[hash],data:'0x',logIndex:0}]};
 const client={getChainId:async()=>4663,getBlock:async({blockNumber}={})=>({...head,number:blockNumber??head.number,hash:reorg&&blockNumber?'0x'+'b'.repeat(64):hash}),getTransaction:async()=>({blockNumber:receipt.blockNumber,blockHash:hash,type:'eip1559'}),getTransactionReceipt:async()=>{receiptReads++;await new Promise(r=>setTimeout(r,5));return receipt;}};
 const chain=createTasksChain(client);const input={target:hash};const snapshots=await Promise.all(Array.from({length:8},()=>chain.snapshot('transaction',input)));assert.equal(receiptReads,1);assert.equal(chain.eventLogs(hash).length,1);assert.equal(snapshots[0].feeWei,'63000');assert.equal(snapshots[0].logCount,'1');await chain.snapshot('transaction',input);assert.equal(receiptReads,1);reorg=true;await assert.rejects(chain.snapshot('transaction',input),/CHAIN_REORGANIZED/);
});
test('actual transaction verifier rejects pending, unconfirmed and unsupported blob transactions',async()=>{
 for(const mode of ['pending','unconfirmed','blob']){const head={number:DEPLOYMENT_BLOCK+100n,hash,timestamp:BigInt(Math.floor(Date.now()/1000))};const receipt={blockNumber:head.number-1n,blockHash:hash};const chain=createTasksChain({getChainId:async()=>4663,getBlock:async()=>head,getTransaction:async()=>({blockNumber:mode==='pending'?null:receipt.blockNumber,blockHash:hash,type:mode==='blob'?'eip4844':'eip1559'}),getTransactionReceipt:async()=>receipt});await assert.rejects(chain.snapshot('transaction',{target:hash}),/NOT_CONFIRMED|UNSUPPORTED_BLOB/);}
});
test('actual identity authorization uses owner/assignment and a confirmed canonical Transfer epoch',async()=>{
 const head={number:DEPLOYMENT_BLOCK+100n,hash,timestamp:BigInt(Math.floor(Date.now()/1000))};let fresh=false,ownerNow=owner.address;
 const client={getChainId:async()=>4663,getBlock:async()=>head,getCode:async()=>agentRuntimeBytecode,readContract:async({functionName})=>functionName==='ownerOf'?ownerNow:operator.address,getContractEvents:async()=>[{transactionHash:hash,logIndex:0,blockNumber:fresh?head.number:DEPLOYMENT_BLOCK,blockHash:hash}]};const chain=createTasksChain(client);const a=await chain.authority('1');assert.equal(a.owner,owner.address);assert.equal(a.assignedWallet,operator.address);assert.match(a.epoch,/^0x/);fresh=true;await assert.rejects(chain.authority('1'),/CONFIRMATION_PENDING/);
});
import {taskRequestOrigin} from '../lib/tasks/origin.ts';
test('origin validation accepts approved public domains behind proxies and rejects forged cross-origin access',()=>{
 const req=origin=>new Request('http://localhost:3108/api/tasks',{headers:origin?{origin}:{}});assert.equal(taskRequestOrigin(req('http://127.0.0.1:3108'),{}),'http://127.0.0.1:3108');assert.equal(taskRequestOrigin(req('https://www.ame.guru'),{VERCEL:'1'}),'https://www.ame.guru');assert.equal(taskRequestOrigin(req(),{VERCEL:'1'}),'https://www.ame.guru');for(const origin of ['https://evil.example','null','https://ame.guru.evil.example'])assert.throws(()=>taskRequestOrigin(req(origin),{VERCEL:'1'}),/ORIGIN_MISMATCH/);
});
import {writeScope,requireWriteGrant} from '../lib/tasks/activation.ts';
import {taskRpcUrls} from '../lib/tasks/rpc.ts';
test('server scope needs kill switch, a bounded window and exact wallet/agent/task match',()=>{const scope={id:'acceptance-test',startsAt:new Date(clock-1000).toISOString(),expiresAt:new Date(clock+60000).toISOString(),maxAwards:1,agents:[{agentId:'1',wallet:owner.address,epoch:hash,tasks:['wallet']}]};const env={AME_TASKS_WRITES_ENABLED:'1',AME_TASKS_WRITE_SCOPE:JSON.stringify(scope)};assert.equal(writeScope({},clock),null);assert.equal(writeScope({...env,AME_TASKS_WRITES_ENABLED:'0'},clock),null);assert.equal(requireWriteGrant('1',owner.address,'wallet',hash,env,clock).limit,1);for(const args of [['2',owner.address,'wallet'],['1',outsider.address,'wallet'],['1',owner.address,'research']])assert.throws(()=>requireWriteGrant(...args,hash,env,clock),/SCOPE_DENIED/);assert.equal(writeScope(env,clock+60001),null);assert.equal(writeScope({...env,AME_TASKS_WRITE_SCOPE:JSON.stringify({...scope,expiresAt:new Date(clock+90000000).toISOString()})},clock),null);assert.equal(writeScope({...env,AME_TASKS_WRITE_SCOPE:'{"agents":[]}'},clock),null);assert.throws(()=>taskRpcUrls({AME_TASKS_RPC_URLS:'["http://localhost:8545"]'}));assert.equal(taskRpcUrls({AME_TASKS_RPC_URLS:'["https://primary.example","https://secondary.example"]'}).length,2);});
test('server acceptance of cryptographic test signatures uses nonce, task binding and authorization but cannot record XP',async()=>{const e=setup(),p=payload('research'),c=await e.service.start(p,origin,'acceptance',true),signature=await owner.signMessage({message:c.message});assert.match(c.message,/No completion or XP award is authorized/);assert.ok(c.message.includes(contentHash(p.submission)));await assert.rejects(e.service.submit({challengeId:c.challengeId,signature},origin,'acceptance',false),/MODE_MISMATCH/);const proof=await e.service.submit({challengeId:c.challengeId,signature},origin,'acceptance',true);assert.equal(proof.verified,true);assert.equal(proof.recorded,false);assert.equal(proof.xpAwarded,0);assert.equal(proof.receiptExpiresAt,new Date(clock+86400000).toISOString());assert.equal(proof.owner,owner.address);assert.equal(e.store.records.length,0);assert.equal((await e.store.getAcceptanceProof(c.challengeId)).submissionHash,contentHash(p.submission));await assert.rejects(e.service.submit({challengeId:c.challengeId,signature},origin,'acceptance',true),/REPLAYED/);});
test('acceptance fails closed for wrong wallets, incorrect analysis and transferred ownership',async()=>{for(const mode of ['wallet','analysis','ownership']){const e=setup(),p=payload('research');if(mode==='analysis')p.submission.analysis={...research,codeBytes:'999'};const c=await e.service.start(p,origin,'acceptance',true),signature=await (mode==='wallet'?outsider:owner).signMessage({message:c.message});if(mode==='ownership')e.setState({owner:outsider.address,assignedWallet:zeroAddress,epoch:'new'});await assert.rejects(e.service.submit({challengeId:c.challengeId,signature},origin,'acceptance',true),/SIGNATURE|ANALYSIS|AUTHORIZ/);assert.equal(e.store.records.length,0);}});
import {createPublicClient} from 'viem';
import {tasksTransport} from '../lib/tasks/rpc.ts';
test('configured RPC failover is bounded and never invents a successful response',async()=>{const calls=[];let offline=false;const client=createPublicClient({transport:tasksTransport({AME_TASKS_RPC_URLS:'["https://primary.example","https://secondary.example"]'},async(url,init)=>{calls.push(String(url));if(String(url).includes('primary')||offline)return new Response('unavailable',{status:503});const payload=JSON.parse(init.body);return Response.json({jsonrpc:'2.0',id:payload.id,result:'0x1237'});})});assert.equal(await client.getChainId(),4663);assert.ok(calls.length<=4);assert.ok(calls.some(v=>v.includes('secondary')));offline=true;calls.length=0;await assert.rejects(client.request({method:'eth_blockNumber'}));assert.ok(calls.length<=4);});
test('scope changes and the kill switch invalidate pending recording signatures',async()=>{for(const kill of [false,true]){const e=setup();let active=true,key='first';e.store.activationOpen=async()=>true;const service=createTasksService({chain:e.chain,store:()=>e.store,enabled:()=>active,grant:()=>({key,limit:1,expires:clock+300000}),now:()=>clock});const c=await service.start(payload(),origin,'scope'),signature=await owner.signMessage({message:c.message});if(kill)active=false;else key='second';await assert.rejects(service.submit({challengeId:c.challengeId,signature},origin,'scope'),/SCOPE_CHANGED|WRITES_DISABLED/);assert.equal(e.store.records.length,0);}});
import {transientTaskRpc} from '../lib/tasks/rpc.ts';
test('historical-state RPC errors get one bounded read retry; reverts and writes never do',async()=>{let calls=0;const client=createPublicClient({transport:tasksTransport({AME_TASKS_RPC_URLS:'["https://primary.example"]'},async(_,init)=>{calls++;const p=JSON.parse(init.body);return Response.json(calls===1?{jsonrpc:'2.0',id:p.id,error:{code:-32000,message:'historical state is not available'}}:{jsonrpc:'2.0',id:p.id,result:'0x1237'});})});assert.equal(await client.getChainId(),4663);assert.equal(calls,2);assert.equal(transientTaskRpc({code:-32000,message:'execution reverted: temporarily paused'}),false);assert.equal(transientTaskRpc({code:-32602,message:'invalid params'}),false);await assert.rejects(client.request({method:'eth_sendRawTransaction',params:['0x']}),/Unsupported task RPC method/);assert.equal(calls,2);});
test('completed categories cannot be rewarded again after NFT transfer to a new ownership epoch',async()=>{const e=setup();await e.service.submit(await signed(e),origin,'owner');e.setState({owner:outsider.address,assignedWallet:zeroAddress,epoch:'next-owner'});await assert.rejects(e.service.start(payload('wallet','1',outsider.address),origin,'next'),/ALREADY_COMPLETED/);assert.equal(e.store.records.length,1);assert.equal((await e.service.status('1')).xp,0);});
test('status exposes only exact scoped wallet/category permissions and drops them after an epoch change',async()=>{const previousFlag=process.env.AME_TASKS_WRITES_ENABLED,previousScope=process.env.AME_TASKS_WRITE_SCOPE;try{const e=setup();e.setState({epoch:hash});e.store.activationOpen=async()=>true;process.env.AME_TASKS_WRITES_ENABLED='1';process.env.AME_TASKS_WRITE_SCOPE=JSON.stringify({id:'status-acceptance',startsAt:new Date(clock-1000).toISOString(),expiresAt:new Date(clock+60000).toISOString(),maxAwards:1,agents:[{agentId:'1',wallet:owner.address,epoch:hash,tasks:['wallet']}]});const status=await e.service.status('1');assert.deepEqual(status.writePermissions,[{wallet:owner.address,tasks:['wallet']}]);assert.deepEqual(status.writableTasks,['wallet']);assert.equal(status.writesEnabled,true);e.setState({epoch:'0x'+'b'.repeat(64)});assert.deepEqual((await e.service.status('1')).writePermissions,[]);}finally{if(previousFlag===undefined)delete process.env.AME_TASKS_WRITES_ENABLED;else process.env.AME_TASKS_WRITES_ENABLED=previousFlag;if(previousScope===undefined)delete process.env.AME_TASKS_WRITE_SCOPE;else process.env.AME_TASKS_WRITE_SCOPE=previousScope;}});
