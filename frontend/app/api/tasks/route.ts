import {taskRequestOrigin} from '@/lib/tasks/origin';
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
  const body=object(raw,['action','agentId','wallet','type','submission','challengeId','signature','target']);const {action,...input}=body;
  const ip=process.env.VERCEL==='1'?request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()||'unknown':'local';const rate=contentHash(ip);
  if(action==='reference'){object(input,[]);return Response.json(await tasksService.reference());}
  if(action==='observe')return Response.json(await tasksService.observe(input));
  if(action==='inspect')return Response.json(await tasksService.inspect(input));
  if(action==='start')return Response.json(await tasksService.start(input,origin,rate));
  if(action==='submit')return Response.json(await tasksService.submit(input,origin,rate));
  throw new TaskError('INVALID_ACTION');
 }catch(error){return Response.json({error:error instanceof TaskError?error.message:'VERIFICATION_UNAVAILABLE',awardedXP:0},{status:error instanceof TaskError?error.status:503});}
}
export const GET=withApiMetrics('tasks',handle);
export const POST=withApiMetrics('tasks',handle);
