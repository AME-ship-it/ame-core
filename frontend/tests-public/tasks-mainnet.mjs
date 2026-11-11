import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mainnetTasksChain,REGISTRY} from '../lib/tasks/chain.ts';
import {createTasksService} from '../lib/tasks/service.ts';
import {agentRuntimeBytecode} from '../lib/generated/agent.ts';
import {keccak256} from 'viem';
const service=createTasksService({store:()=>null,enabled:()=>false});
test('live mainnet research reads confirmed deployed bytecode and deterministic grading without writes',async()=>{
 const start=performance.now();const result=await service.observe({type:'research',target:REGISTRY});assert.equal(result.snapshot.codeHash,keccak256(agentRuntimeBytecode));assert.ok(BigInt(result.snapshot.codeBytes)>0n);assert.equal(result.awardedXP,0);assert.equal(result.persisted,false);
 const grade=await service.inspect({type:'research',submission:{target:REGISTRY,analysis:result.snapshot}});assert.equal(grade.matches,true);console.log(JSON.stringify({check:'mainnet-research',durationMs:Math.round(performance.now()-start),block:result.snapshot.blockNumber}));
});
test('live mainnet transaction analysis uses actual creation receipt fees and log digest',async()=>{
 const result=await service.observe({type:'transaction',target:'0xfba21e075fb63d817188fa18e2b93d16e812f205c36f71a3bbdf7ae64046f649'});assert.equal(result.snapshot.blockNumber,'112023846');assert.equal(result.snapshot.status,'success');assert.equal(BigInt(result.snapshot.feeWei),BigInt(result.snapshot.gasUsed)*BigInt(result.snapshot.effectiveGasPriceWei));assert.equal(result.awardedXP,0);assert.equal((await service.inspect({type:'transaction',submission:{target:'0xfba21e075fb63d817188fa18e2b93d16e812f205c36f71a3bbdf7ae64046f649',analysis:result.snapshot}})).matches,true);
});
test('live reader rejects no-code and nonexistent evidence; disabled writes stay closed',async()=>{
 await assert.rejects(service.observe({type:'research',target:'0x1000000000000000000000000000000000000001'}),/NO_CONTRACT_CODE/);await assert.rejects(service.observe({type:'transaction',target:'0x'+'0'.repeat(64)}));assert.equal((await service.status()).writesEnabled,false);
});
