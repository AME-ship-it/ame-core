import {taskRequestOrigin} from '@/lib/tasks/origin';
import {guidedTasks} from '@/lib/tasks/guided';
import {tasksService} from '@/lib/tasks/service';
import {TaskError,contentHash,object} from '@/lib/tasks/model';
import {allowRequest,boundedJSON,withApiMetrics} from '@/lib/server/api-guard';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handle(request:Request){
 if(!allowRequest(request))return Response.json({error:'RATE_LIMITED'},{status:429});
 try{
  const url=new URL(request.url);if(request.method==='GET'){
   if(url.searchParams.size>1||[...url.searchParams.keys()].some(k=>k!=='agentId'))throw new TaskError('INVALID_QUERY');
   return Response.json(await tasksService.status(url.searchParams.get('agentId')||undefined));
  }
  const origin=taskRequestOrigin(request);
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new TaskError('JSON_REQUIRED');
  let raw:unknown;try{raw=await boundedJSON(request,12000);}catch(error){throw new TaskError(error instanceof Error&&error.message==='BODY_TOO_LARGE'?'BODY_TOO_LARGE':'INVALID_JSON',error instanceof Error&&error.message==='BODY_TOO_LARGE'?413:400);}
  const body=object(raw,['action','agentId','wallet','type','submission','challengeId','signature','target','ticket','answers']);const {action,...input}=body;
  const ip=process.env.VERCEL==='1'?request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()||'unknown':'local';const rate=contentHash(ip);
  if(action==='guide')return Response.json(await guidedTasks.prepare(input,origin));
  if(action==='grade')return Response.json(await guidedTasks.grade(input,origin));
  if(action==='identity-proof')return Response.json(await guidedTasks.identity(input,origin));
  if(action==='record-guided'||action==='acceptance-guided'){const b=object(input,['ticket','answers','wallet']);const prepared=await guidedTasks.record({ticket:b.ticket,answers:b.answers},origin);return Response.json(await tasksService.start({...prepared,wallet:b.wallet},origin,rate,action==='acceptance-guided'));}
  if(action==='reference'){object(input,[]);return Response.json(await tasksService.reference());}
  if(action==='observe')return Response.json(await tasksService.observe(input));
  if(action==='inspect')return Response.json(await tasksService.inspect(input));
  if(action==='start'||action==='acceptance-start'){if(input.type!=='wallet')throw new TaskError('GUIDED_ANALYSIS_REQUIRED');return Response.json(await tasksService.start(input,origin,rate,action==='acceptance-start'));}
  if(action==='submit'||action==='acceptance-submit')return Response.json(await tasksService.submit(input,origin,rate,action==='acceptance-submit'));
  throw new TaskError('INVALID_ACTION');
 }catch(error){if(!(error instanceof TaskError)){let cause=error as {name?:string;code?:unknown;cause?:unknown}|undefined;const categories=[];for(let i=0;cause&&i<4;i++,cause=cause.cause as typeof cause)categories.push({name:typeof cause.name==='string'?cause.name.slice(0,60):'Unknown',code:typeof cause.code==='number'?cause.code:null});console.warn(JSON.stringify({event:'ame_tasks_verification_failure',categories}));}return Response.json({error:error instanceof TaskError?error.message:'VERIFICATION_UNAVAILABLE',awardedXP:0},{status:error instanceof TaskError?error.status:503});}
}
export const GET=withApiMetrics('tasks',handle);
export const POST=withApiMetrics('tasks',handle);
