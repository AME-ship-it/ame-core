import {readPassport} from '@/lib/passport/server';
import {passportError} from '@/lib/passport/service';
import {allowRequest,apiHeaders} from '@/lib/server/api-guard';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{agentId:string}>}){
 const start=performance.now(),headers=apiHeaders(start);if(!allowRequest(request))return Response.json({error:'Please wait before verifying again.'},{status:429,headers});
 if(new URL(request.url).searchParams.size)return Response.json({error:'Passport reads do not accept query parameters.'},{status:400,headers});
 try{return Response.json(await readPassport((await params).agentId),{headers:apiHeaders(start)});}catch(error){const e=passportError(error);return Response.json({error:e.message},{status:e.status,headers:apiHeaders(start)});}
}
