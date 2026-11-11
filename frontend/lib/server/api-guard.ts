/** Per-instance abuse protection. Deploy an edge/WAF limit for fleet-wide enforcement. */
export function createRateLimiter(limit=60,windowMs=60_000,now=Date.now){
  const buckets=new Map<string,{count:number;until:number}>();
  return (key:string)=>{
    const t=now();for(const [k,v] of buckets)if(v.until<=t)buckets.delete(k);
    const bucket=buckets.get(key)??{count:0,until:t+windowMs};
    if(bucket.count>=limit||(!buckets.has(key)&&buckets.size>=1024))return false;
    bucket.count++;buckets.set(key,bucket);return true;
  };
}
const perClient=createRateLimiter(),global=createRateLimiter(240);
export function allowRequest(request:Request){
  // Only Vercel's platform header is used in production; never trust a caller-supplied wallet as a limit key.
  const key=process.env.VERCEL==='1'?(request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()||'unknown'):'local';
  return global('all')&&perClient(key);
}
export async function boundedJSON(request:Request,maxBytes=2048):Promise<unknown>{
  if(Number(request.headers.get('content-length')||0)>maxBytes)throw new Error('BODY_TOO_LARGE');
  const reader=request.body?.getReader();if(!reader)throw new Error('INVALID_BODY');
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new Error('BODY_TOO_LARGE');}chunks.push(value);}}finally{reader.releaseLock();}
  const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data));
}
export function apiHeaders(start:number){return {'cache-control':'private, no-store','server-timing':`app;dur=${Math.max(0,performance.now()-start).toFixed(1)}`};}
export function withApiMetrics(route:string,handler:(request:Request)=>Promise<Response>){return async(request:Request)=>{
  const start=performance.now();let response:Response;
  try{response=await handler(request);}catch{response=Response.json({status:'unavailable'},{status:503});}
  const durationMs=Number((performance.now()-start).toFixed(1));
  response.headers.set('server-timing',`app;dur=${durationMs}`);response.headers.set('cache-control','private, no-store');
  console.info(JSON.stringify({event:'ame_api',route,status:response.status,durationMs}));return response;
};}
