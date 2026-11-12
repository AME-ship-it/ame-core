import assert from 'node:assert/strict';
import {test} from 'node:test';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
import {verifyMessage} from 'viem';
import {createGuidedTasks} from '../lib/tasks/guided.ts';
const owner=privateKeyToAccount(generatePrivateKey()),other=privateKeyToAccount(generatePrivateKey());const hash='0x'+'a'.repeat(64),origin='https://www.ame.guru',clock=1800000000000;
const research={blockNumber:'100',blockHash:hash,codeHash:hash,codeBytes:'5265',balanceWei:'0'};
const tx={blockNumber:'100',blockHash:hash,status:'success',gasUsed:'21000',effectiveGasPriceWei:'2000000000',feeWei:'42000000000000',logCount:'0',logsHash:hash};
function setup(){let state={owner:owner.address,assignedWallet:owner.address,epoch:'epoch-one',blockNumber:'200',blockHash:hash,chainTime:clock};let offline=false;const chain={authority:async()=>({...state}),signature:async(address,message,signature)=>verifyMessage({address,message,signature}),reference:async()=>({chainId:4663,blockNumber:'100'}),snapshot:async(type)=>{if(offline)throw Error('RPC unavailable');return type==='research'?research:tx;}};const guide=createGuidedTasks({chain,key:()=> '1'.repeat(64),now:()=>clock});return {guide,change:s=>Object.assign(state,s),offline:()=>{offline=true;}};}
const find=(g,id,label)=>g.questions.find(q=>q.id===id).options.find(o=>o.label===label).id;
test('research guide returns readable properties and encrypted evidence, not expected answer keys',async()=>{
 const {guide}=setup();const g=await guide.prepare({agentId:'1',type:'research',target:owner.address},origin);assert.equal(g.questions.length,2);assert.ok(g.properties.some(p=>p.value==='5,265 bytes'));assert.ok(!('snapshot'in g));assert.ok(!('answers'in g));assert.ok(!Buffer.from(g.ticket,'base64url').toString().includes('5265'));assert.equal(g.questions[0].kind,'number');
 const answers={blocks:'6',conclusion:find(g,'conclusion','It confirms deployed code at this snapshot, not contract safety.')};const result=await guide.grade({ticket:g.ticket,answers},origin);assert.equal(result.verified,true);assert.equal(result.recorded,false);assert.equal(result.xpAwarded,0);assert.deepEqual((await guide.record({ticket:g.ticket,answers},origin)).submission.analysis,research);
});
test('incorrect or incomplete ordinary answers cannot become a recorded completion',async()=>{
 const {guide}=setup(),g=await guide.prepare({agentId:'1',type:'research',target:owner.address},origin);const answers={blocks:'5',conclusion:'not-an-option'};const result=await guide.grade({ticket:g.ticket,answers},origin);assert.equal(result.verified,false);assert.equal(result.xpAwarded,0);await assert.rejects(guide.record({ticket:g.ticket,answers},origin),/NOT_CORRECT/);await assert.rejects(guide.grade({ticket:g.ticket,answers:{}},origin),/ANSWER_EVERY_QUESTION/);await assert.rejects(guide.grade({ticket:g.ticket,answers:{...answers,xp:999}},origin),/INVALID_SCHEMA/);
});
test('transaction questions grade actual fees and attribution without revealing a chosen answer',async()=>{
 const {guide}=setup(),g=await guide.prepare({agentId:'1',type:'transaction',target:hash},origin);assert.equal(g.questions.length,2);assert.ok(!g.properties.some(p=>p.label==='Network fee'));const answers={fee:find(g,'fee','0.000042 ETH'),attribution:find(g,'attribution','No. Investigating a transaction does not prove the agent executed it.')};const result=await guide.grade({ticket:g.ticket,answers},origin);assert.equal(result.verified,true);assert.equal(result.xpAwarded,0);
});
test('sealed sessions reject tampering, wrong origin, expiry and ownership changes',async()=>{
 for(const variant of ['tamper','origin','expired','transfer']){const e=setup(),g=await e.guide.prepare({agentId:'1',type:'research',target:owner.address},origin);const answers={blocks:'6',conclusion:'0'};if(variant==='expired')e.change({chainTime:clock+300001});if(variant==='transfer')e.change({epoch:'epoch-two'});await assert.rejects(e.guide.grade({ticket:variant==='tamper'?(g.ticket[0]==='A'?'B':'A')+g.ticket.slice(1):g.ticket,answers},variant==='origin'?'https://evil.example':origin));}
});
test('identity read verifies ownership but wallet control requires the actual authorized signature',async()=>{
 const {guide}=setup();const read=await guide.prepare({agentId:'1',type:'wallet'},origin);assert.equal(read.walletAuthorized,false);assert.ok(!read.signatureMessage);
 const g=await guide.prepare({agentId:'1',type:'wallet',wallet:owner.address},origin);assert.ok(g.signatureMessage.includes('No login session, task completion, XP'));const signature=await owner.signMessage({message:g.signatureMessage});const result=await guide.identity({ticket:g.ticket,signature},origin);assert.equal(result.verified,true);assert.equal(result.recorded,false);assert.equal(result.xpAwarded,0);await assert.rejects(guide.identity({ticket:g.ticket,signature:await other.signMessage({message:g.signatureMessage})},origin),/INVALID_WALLET_SIGNATURE/);
});
test('wallet reassignment and unauthorized connected wallets cannot prove control',async()=>{
 const e=setup(),bad=await e.guide.prepare({agentId:'1',type:'wallet',wallet:other.address},origin);assert.equal(bad.walletAuthorized,false);const g=await e.guide.prepare({agentId:'1',type:'wallet',wallet:owner.address},origin);e.change({assignedWallet:other.address});await assert.rejects(e.guide.identity({ticket:g.ticket,signature:await owner.signMessage({message:g.signatureMessage})},origin),/AUTHORIZATION_CHANGED/);
});
test('RPC errors and missing server encryption configuration never return fabricated results',async()=>{
 const e=setup();e.offline();await assert.rejects(e.guide.prepare({agentId:'1',type:'research',target:owner.address},origin));await assert.rejects(createGuidedTasks({key:()=>undefined,chain:{authority:async()=>({owner:owner.address,assignedWallet:owner.address,epoch:'x',blockNumber:'1',blockHash:hash,chainTime:clock})}}).prepare({agentId:'1',type:'wallet'},origin),/UNAVAILABLE/);
});
