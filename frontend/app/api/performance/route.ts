import {allowRequest,boundedJSON} from '@/lib/server/api-guard';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:Request){
  if(!allowRequest(request))return new Response(null,{status:429,headers:{'retry-after':'60'}});
  let b:unknown;try{b=await boundedJSON(request,512);}catch{return new Response(null,{status:400});}
  if(!b||typeof b!=='object'||Array.isArray(b))return new Response(null,{status:400});
  const m=b as Record<string,unknown>;
  if(Object.keys(m).some(k=>!['name','value','rating'].includes(k))||!['CLS','LCP','INP','FCP','TTFB'].includes(String(m.name))||typeof m.value!=='number'||!Number.isFinite(m.value)||m.value<0||m.value>3_600_000||!['good','needs-improvement','poor'].includes(String(m.rating)))return new Response(null,{status:400});
  console.info(JSON.stringify({event:'ame_web_vital',name:m.name,value:m.value,rating:m.rating}));
  return new Response(null,{status:204,headers:{'cache-control':'no-store'}});
}
