import {isAddress,zeroAddress,getAddress} from 'viem';
import {readTokenSnapshot} from '@/lib/server/token-state';
import {allowRequest,apiHeaders,boundedJSON,withApiMetrics} from '@/lib/server/api-guard';
export const runtime='nodejs';export const dynamic='force-dynamic';
async function handle(request:Request){
  const start=performance.now(),reply=(body:unknown,status:number)=>Response.json(body,{status,headers:apiHeaders(start)});
  if(!allowRequest(request))return new Response(null,{status:429,headers:{...apiHeaders(start),'retry-after':'60'}});
  let body:unknown;try{body=await boundedJSON(request);}catch(e){return reply({status:'error'},e instanceof Error&&e.message==='BODY_TOO_LARGE'?413:400);}
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==1||!('walletAddress'in body)||typeof body.walletAddress!=='string'||!isAddress(body.walletAddress)||getAddress(body.walletAddress)===zeroAddress)return reply({status:'error'},400);
  const data=await readTokenSnapshot(body.walletAddress);return reply(data,data.status==='unavailable'?503:200);
}
export const POST=withApiMetrics('token-state',handle);
