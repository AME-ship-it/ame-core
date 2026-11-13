import {agentId,contentHash,TaskError,TASKS,type TaskRecord,reputation} from '../tasks/model.ts';
import type {Authority} from '../tasks/chain.ts';
import type {Passport} from './types.ts';
export const PASSPORT_ORIGIN='https://www.ame.guru';
export const PASSPORT_REGISTRY='0x3E5D2c59fc968DAE8Fc58AB1B46F3b3eB03d969c';
export function passportId(id:unknown){return agentId(id);}
export function passportURL(id:string){return PASSPORT_ORIGIN+'/passport/'+passportId(id);}
export function consistentRecords(records:TaskRecord[],id:string){
 try{return new Set(records.map(r=>r.id)).size===records.length&&records.every(r=>TASKS.some(t=>t.type===r.type)&&r.chainId===4663&&r.registry.toLowerCase()===PASSPORT_REGISTRY.toLowerCase()&&r.agentId===id&&['ame-tasks-v1.0','ame-tasks-v2.0'].includes(r.version)&&['VERIFIED','REJECTED'].includes(r.status)&&Number.isSafeInteger(r.xp)&&r.xp===(r.status==='VERIFIED'?TASKS.find(t=>t.type===r.type)?.xp:0)&&r.evidenceId===contentHash(r.evidence)&&r.evidence.agentId===id&&r.evidence.epoch===r.epoch&&r.evidence.submissionHash===contentHash(r.submission));}catch{return false;}
}
type Activity={owner?:string;assignedWallet?:string;epoch?:string;xp?:number|null;verifiedCount?:number|null;history?:TaskRecord[]|null;reputation?:ReturnType<typeof reputation>|null};
type Details={name:string|null;description:string|null;metadataURI:string|null;mint:Passport['identity']['mint'];issues:string[]};
export function createPassportReader({authority,activity,details,now=Date.now}:{authority:(id:string)=>Promise<Authority>;activity:(id:string)=>Promise<Activity>;details:(id:string,a:Authority)=>Promise<Details>;now?:()=>number}){
 return async(id:string):Promise<Passport>=>{
  passportId(id);const [authorityResult,activityResult]=await Promise.allSettled([authority(id),activity(id)]);
  if(authorityResult.status==='rejected')throw authorityResult.reason;const a=authorityResult.value;
  const [detailResult]=await Promise.allSettled([details(id,a)]);
  const detail=detailResult.status==='fulfilled'?detailResult.value:{name:null,description:null,metadataURI:null,mint:null,issues:['Metadata and mint history are temporarily unavailable.']};
  let data:Passport['activity']={status:'unavailable',xp:null,verifiedCount:null,history:null,reputation:null,issue:'Persistent task history could not be verified. No activity metrics are claimed.'};
  if(activityResult.status==='fulfilled'){
   const h=activityResult.value;
   if(h.history&&h.reputation&&h.xp!==null&&h.xp!==undefined&&h.verifiedCount!==null&&h.verifiedCount!==undefined){
    const same=h.owner?.toLowerCase()===a.owner.toLowerCase()&&h.assignedWallet?.toLowerCase()===a.assignedWallet.toLowerCase()&&h.epoch===a.epoch;
    if(!same)throw new TaskError('PASSPORT_OWNERSHIP_CHANGED',409);
    if(consistentRecords(h.history,id))data={status:'available',xp:h.xp,verifiedCount:h.verifiedCount,history:h.history,reputation:h.reputation,issue:null};
    else data={...data,status:'inconsistent',issue:same?'Activity record integrity checks failed. Metrics are withheld.':'Ownership changed during verification. Verify again to read the new ownership epoch.'};
   }
  }
  return {schema:'ame-passport-v3',agentId:id,chainId:4663,registry:PASSPORT_REGISTRY,url:passportURL(id),checkedAt:new Date(now()).toISOString(),identity:{...a,...detail},activity:data,verification:{ownership:'onchain',activity:data.status==='available'?'server-attested':'unavailable',signatures:'checked-at-submission-not-publicly-retained',financialUseApproved:false}};
 };
}
export function passportError(error:unknown){const e=error instanceof TaskError?error:null;return {status:e?.message==='INVALID_AGENT'?400:e?.message==='AGENT_NOT_FOUND'?404:503,message:e?.message==='INVALID_AGENT'?'Enter a positive AME agent ID.':e?.message==='AGENT_NOT_FOUND'?'This AME NFT does not exist on Robinhood Mainnet.':'Passport verification is temporarily unavailable. No fresh ownership or activity verification is claimed.'};}
