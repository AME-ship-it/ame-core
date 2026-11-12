import {randomUUID} from 'node:crypto';
import type {Address,Hex} from 'viem';
import {TASKS,TASK_VERSION,TaskError,contentHash,canonical,object,taskType,agentId,walletAddress,submission,score,reputation,REWARD_POLICY,type TaskSubmission,type TaskType,type TaskRecord} from './model.ts';
import {mainnetTasksChain,REGISTRY,authorized,type Authority,type TasksChain} from './chain.ts';
import {configuredStore,type TaskStore} from './store.ts';
if(typeof window!=='undefined')throw new Error('Server-only Tasks service');
type Challenge={id:string;agentId:string;wallet:Address;type:TaskType;submission:TaskSubmission;authority:Authority;message:string;expires:number;created:string;origin:string;reward?:number;policy?:string};
export function createTasksService({chain=mainnetTasksChain,store=configuredStore,enabled=()=>process.env.AME_TASKS_WRITES_ENABLED==='1',now=Date.now,uuid=randomUUID}:{chain?:TasksChain;store?:()=>TaskStore|null;enabled?:()=>boolean;now?:()=>number;uuid?:()=>string}={}){
 const storage=()=>{const s=store();if(!s||!enabled())throw new TaskError('TASK_WRITES_DISABLED_DURABLE_STORAGE_REQUIRED',503);return s;};
 const time=(a:Authority)=>Math.max(now(),a.chainTime);
 return {
 async status(id?:string){const s=store();if(!id)return {tasks:TASKS,version:TASK_VERSION,writesEnabled:!!s&&enabled(),persistence:s?'durable-configured':'not-configured'};
  const token=agentId(id),a=await chain.authority(token);const data=s?await s.history(`4663:${REGISTRY.toLowerCase()}:${token}`,a.epoch):null;
  return {tasks:TASKS,version:TASK_VERSION,agentId:token,owner:a.owner,assignedWallet:a.assignedWallet,epoch:a.epoch,writesEnabled:!!s&&enabled(),persistence:s?'durable-configured':'not-configured',xp:data?score(data.completed):null,verifiedCount:data?.completed.length??null,history:data?.history??null,historyLimit:null,reputation:data?reputation(data.history,a.epoch):null,rewardPolicy:REWARD_POLICY};
 },
 async reference(){return chain.reference();},
 async observe(input:unknown){const b=object(input,['type','target']);const type=taskType(b.type);if(type==='wallet')throw new TaskError('WALLET_REQUIRES_SIGNATURE');let target:string;if(['research','classification'].includes(type))target=walletAddress(b.target).toLowerCase();else{if(typeof b.target!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(b.target))throw new TaskError('INVALID_TRANSACTION_HASH');target=b.target.toLowerCase();}const reference=await chain.reference();const snapshot=await chain.snapshot(type,{target,analysis:{blockNumber:reference.blockNumber}});return {snapshot,eventLogs:type==='transaction'?chain.eventLogs?.(target):undefined,awardedXP:0,persisted:false,version:TASK_VERSION};},
 async inspect(input:unknown){const b=object(input,['type','submission']);const type=taskType(b.type);if(type==='wallet')throw new TaskError('WALLET_REQUIRES_SIGNATURE');const report=submission(type,b.submission);const actual=await chain.snapshot(type,report);return {matches:canonical(actual)===canonical(report.analysis),verifiedSnapshot:actual,version:TASK_VERSION,awardedXP:0,persisted:false};},
 async start(input:unknown,origin:string,rateKey:string){
  const s=storage();if(!await s.limit(rateKey))throw new TaskError('RATE_LIMITED',429);
  const b=object(input,['agentId','wallet','type','submission']);const id=agentId(b.agentId),wallet=walletAddress(b.wallet),type=taskType(b.type),report=submission(type,b.submission);const a=await chain.authority(id);authorized(a,wallet);
  const {completed}=await s.history(`4663:${REGISTRY.toLowerCase()}:${id}`,a.epoch);if(completed.some(r=>r.type===type))throw new TaskError('TASK_ALREADY_COMPLETED_THIS_OWNERSHIP_EPOCH',409);
  const challengeId=uuid(),created=time(a),expires=created+300000;const message=`AME Tasks authorization\nOrigin: ${origin}\nChain ID: 4663\nRegistry: ${REGISTRY}\nAgent ID: ${id}\nOwner: ${a.owner}\nAssigned wallet: ${a.assignedWallet}\nOwnership epoch: ${a.epoch}\nWallet: ${wallet}\nPurpose: complete ${type} / ${TASK_VERSION}\nSubmission hash: ${contentHash(report)}\nNonce: ${challengeId}\nExpires: ${new Date(expires).toISOString()}\nThis signature authorizes a user-assisted task submission only. No financial permissions.`;
  const c:Challenge={id:challengeId,agentId:id,wallet,type,submission:report,authority:a,message,expires,created:new Date(created).toISOString(),origin,reward:TASKS.find(t=>t.type===type)!.xp,policy:TASK_VERSION};await s.putChallenge(challengeId,c);return {challengeId,message,expiresAt:new Date(expires).toISOString(),status:'STARTED'};
 },
 async submit(input:unknown,origin:string,rateKey:string){
  const s=storage();if(!await s.limit(rateKey))throw new TaskError('RATE_LIMITED',429);const b=object(input,['challengeId','signature']);if(typeof b.challengeId!=='string'||! /^[0-9a-f-]{36}$/.test(b.challengeId)||typeof b.signature!=='string'||!/^0x[0-9a-fA-F]{130,4096}$/.test(b.signature))throw new TaskError('INVALID_SIGNATURE_INPUT');
  const c=await s.getChallenge(b.challengeId) as Challenge;if(c.origin!==origin)throw new TaskError('SIGNATURE_ORIGIN_MISMATCH',403);const a=await chain.authority(c.agentId);authorized(a,c.wallet);if(time(a)>c.expires)throw new TaskError('CHALLENGE_EXPIRED',409);if(a.epoch!==c.authority.epoch||a.owner!==c.authority.owner||a.assignedWallet!==c.authority.assignedWallet)throw new TaskError('AGENT_AUTHORIZATION_CHANGED',409);
  if(!await chain.signature(c.wallet,c.message,b.signature as Hex))throw new TaskError('INVALID_WALLET_SIGNATURE',401);if(!await s.claim(c.id))throw new TaskError('CHALLENGE_REPLAYED',409);
  const submitted=new Date(time(a)).toISOString();let status:'VERIFIED'|'REJECTED'='VERIFIED',reason:string|null=null,evidence:Record<string,unknown>={chainId:4663,registry:REGISTRY,agentId:c.agentId,epoch:a.epoch,task:c.type,target:c.submission.target??c.wallet,submissionHash:contentHash(c.submission),authorizationBlock:a.blockNumber,authorizationBlockHash:a.blockHash,version:TASK_VERSION};
  try{const actual=await chain.snapshot(c.type,c.submission);evidence={...evidence,snapshot:actual,...(['transaction','events'].includes(c.type)?{eventLogs:chain.eventLogs?.(c.submission.target!)??[]}:{})};if(c.type!=='wallet'&&canonical(actual)!==canonical(c.submission.analysis))throw new TaskError('ANALYSIS_DOES_NOT_MATCH_CHAIN');const current=await chain.authority(c.agentId);authorized(current,c.wallet);if(current.epoch!==a.epoch||current.owner!==a.owner||current.assignedWallet!==a.assignedWallet)throw new TaskError('AGENT_AUTHORIZATION_CHANGED',409);
  }catch(error){status='REJECTED';reason=error instanceof TaskError?error.message:'RPC_VERIFICATION_UNAVAILABLE';}
  const record:TaskRecord={id:c.id,chainId:4663,registry:REGISTRY,agentId:c.agentId,epoch:a.epoch,type:c.type,submitter:c.wallet,owner:a.owner,assignedWallet:a.assignedWallet,submission:c.submission,status,xp:status==='VERIFIED'?(c.reward??({wallet:10,research:20,transaction:30} as Record<string,number>)[c.type]??0):0,evidenceId:contentHash(evidence),evidence,reason,timestamp:new Date(time(a)).toISOString(),version:c.policy||'ame-tasks-v1.0',transitions:[{status:'STARTED',at:c.created},{status:'SUBMITTED',at:submitted},{status:'VERIFYING',at:submitted},{status,at:new Date(time(a)).toISOString()}]};
  const resource=contentHash({chainId:4663,type:c.type,target:c.type==='wallet'?`${c.agentId}:${a.epoch}:${c.wallet}`:c.submission.target});const result=await s.finish(record,resource);if(result!=='OK')throw new TaskError(result,409);return {record,xpAwarded:record.xp};
 },
 };
}
export const tasksService=createTasksService();
