import {createPublicClient,http} from 'viem';
import {allowRequest,withApiMetrics} from '@/lib/server/api-guard';
import {validateRPC} from '@/lib/environment';
export const runtime='nodejs';export const dynamic='force-dynamic';
let cache:{checkedAt:number;block:string;timestamp:number}|undefined,pending:Promise<typeof cache>|undefined;
async function check(){
  if(cache&&Date.now()-cache.checkedAt<5000)return cache;if(pending)return pending;
  pending=(async()=>{const rpc=createPublicClient({transport:http(validateRPC(process.env.NEXT_PUBLIC_ROBINHOOD_MAINNET_RPC_URL||'https://rpc.mainnet.chain.robinhood.com',true),{retryCount:0,timeout:4000,fetchOptions:{signal:AbortSignal.timeout(5000)}})});
    if(await rpc.getChainId()!==4663)throw new Error('CHAIN_MISMATCH');const b=await rpc.getBlock();
    if(b.number===null||Date.now()/1000-Number(b.timestamp)>120||Number(b.timestamp)>Date.now()/1000+30)throw new Error('STALE_RPC');
    cache={checkedAt:Date.now(),block:String(b.number),timestamp:Number(b.timestamp)};return cache;
  })();try{return await pending;}finally{pending=undefined;}
}
export const GET=withApiMetrics('health',async(request)=>{
  if(!allowRequest(request))return new Response(null,{status:429,headers:{'retry-after':'60'}});
  try{return Response.json({status:'available',chainId:4663,...await check()});}catch(error){cache=undefined;const code=error instanceof Error?error.message:'';return Response.json({status:'unavailable',chainId:4663,reason:['CHAIN_MISMATCH','STALE_RPC'].includes(code)?code:'UPSTREAM_UNAVAILABLE'},{status:503});}
});
