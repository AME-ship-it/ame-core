import {keccak256,toHex,isAddress,getAddress,zeroAddress} from 'viem';
export const TASK_VERSION='ame-tasks-v1.0';
export const TASKS=[{type:'wallet',title:'Identity Attestation',xp:10},{type:'research',title:'Onchain Research',xp:20},{type:'transaction',title:'Transaction Analysis',xp:30}] as const;
export type TaskType=typeof TASKS[number]['type'];
export type TaskPhase='AVAILABLE'|'STARTED'|'SUBMITTED'|'VERIFYING'|'VERIFIED'|'REJECTED';
export type TaskSubmission={target?:string;analysis?:Record<string,string>};
export type TaskRecord={id:string;chainId:4663;registry:string;agentId:string;epoch:string;type:TaskType;submitter:string;owner:string;assignedWallet:string;submission:TaskSubmission;status:'VERIFIED'|'REJECTED';xp:number;evidenceId:string;evidence:Record<string,unknown>;reason:string|null;timestamp:string;version:string;transitions:{status:TaskPhase;at:string}[]};
export function canonical(value:unknown):string{if(value===undefined||typeof value==='function'||typeof value==='symbol'||typeof value==='number'&&!Number.isFinite(value))throw new TaskError('INVALID_CANONICAL_VALUE');if(typeof value==='bigint')return JSON.stringify(String(value));if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';return '{'+Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';}
export function contentHash(value:unknown){return keccak256(toHex(canonical(value)));}
export class TaskError extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status;}}
export function object(value:unknown,keys:string[]):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))throw new TaskError('INVALID_SCHEMA');return value as Record<string,unknown>;}
export function taskType(value:unknown):TaskType{if(!TASKS.some(t=>t.type===value))throw new TaskError('INVALID_TASK');return value as TaskType;}
export function agentId(value:unknown):string{if(typeof value!=='string'||! /^[1-9]\d{0,77}$/.test(value)||BigInt(value)>=(1n<<256n))throw new TaskError('INVALID_AGENT');return value;}
export function walletAddress(value:unknown):`0x${string}`{if(typeof value!=='string'||!isAddress(value)||getAddress(value)===zeroAddress)throw new TaskError('INVALID_WALLET');return getAddress(value);}
export function submission(type:TaskType,value:unknown):TaskSubmission{
 const v=object(value,['target','analysis']);if(type==='wallet'){if(Object.keys(v).length)throw new TaskError('WALLET_TASK_HAS_NO_ANALYSIS');return {};}
 if(typeof v.target!=='string')throw new TaskError('TARGET_REQUIRED');const target=type==='research'?walletAddress(v.target).toLowerCase():v.target.toLowerCase();if(type==='transaction'&&!/^0x[0-9a-f]{64}$/.test(target))throw new TaskError('INVALID_TRANSACTION_HASH');
 const fields=type==='research'?['blockNumber','blockHash','codeHash','codeBytes','balanceWei']:['blockNumber','blockHash','status','gasUsed','effectiveGasPriceWei','feeWei','logCount','logsHash'];const a=object(v.analysis,fields);if(fields.some(k=>typeof a[k]!=='string'||(a[k] as string).length>90)||Object.keys(a).length!==fields.length)throw new TaskError('COMPLETE_ANALYSIS_REQUIRED');
 for(const k of fields){const s=a[k] as string;if(k.endsWith('Hash')){if(!/^0x[0-9a-fA-F]{64}$/.test(s))throw new TaskError('INVALID_ANALYSIS_HASH');}else if(k==='status'){if(!['success','reverted'].includes(s))throw new TaskError('INVALID_TRANSACTION_STATUS');}else if(!/^(0|[1-9]\d{0,77})$/.test(s))throw new TaskError('INVALID_ANALYSIS_NUMBER');}
 return {target,analysis:Object.fromEntries(fields.map(k=>[k,(a[k] as string).toLowerCase()]))};
}
export function score(records:TaskRecord[]){const seen=new Set<string>();return records.reduce((sum,r)=>{if(r.status!=='VERIFIED'||seen.has(r.type))return sum;seen.add(r.type);return sum+(TASKS.find(t=>t.type===r.type)?.xp||0);},0);}

/** External executors must use the same wallet authorization and grading; V1 has no autonomous worker. */
export interface TaskExecutor { mode:'user-assisted'; observe(type:Exclude<TaskType,'wallet'>,target:string):Promise<unknown>; start(agentId:string,wallet:string,type:TaskType,submission:TaskSubmission):Promise<{challengeId:string;message:string}>; submit(challengeId:string,signature:string):Promise<unknown>; }
