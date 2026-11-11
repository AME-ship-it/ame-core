import {createPublicClient,erc20Abi,getAddress,http,isAddress,parseUnits,zeroAddress,type Address,type Hex} from 'viem';
import {mainnet,base,arbitrum,optimism,polygon,bsc,avalanche} from 'viem/chains';
import type {HolderAccess} from '../holder-access.ts';

if(typeof window!=='undefined')throw new Error('Server holder verification cannot run in a browser.');
type Env=Record<string,string|undefined>;
export type HolderConfig={token:Address;chainId:number;threshold:string;rpc:string;tokenURL:string|null};
export class HolderConfigurationError extends Error{}
export class InvalidHolderWallet extends Error{}
const defaults=new Map<number,string>([mainnet,base,arbitrum,optimism,polygon,bsc,avalanche].map(c=>[c.id,c.rpcUrls.default.http[0]]));
defaults.set(4663,'https://rpc.mainnet.chain.robinhood.com');
defaults.set(46630,'https://rpc.testnet.chain.robinhood.com');
export function readHolderConfig(env:Env=process.env):HolderConfig|null{
  const fields=[env.AME_TOKEN_ADDRESS,env.AME_HOLDER_THRESHOLD,env.AME_TOKEN_CHAIN_ID].map(v=>v?.trim()||'');
  if(fields.every(v=>!v))return null;
  const [token,threshold,id]=fields;
  if(!isAddress(token)||getAddress(token)===zeroAddress||!/^\d+$/.test(id)||!Number.isSafeInteger(Number(id))||Number(id)<=0||threshold.length>90||!/^(0|[1-9]\d*)(\.\d+)?$/.test(threshold)||!/[1-9]/.test(threshold))throw new HolderConfigurationError('Invalid holder configuration');
  const rpc=env.AME_TOKEN_RPC_URL?.trim()||defaults.get(Number(id));
  if(!rpc)throw new HolderConfigurationError('RPC required for configured token chain');
  try{const u=new URL(rpc);if(u.protocol!=='https:'||u.username||u.password||['localhost','127.0.0.1','::1','[::1]'].includes(u.hostname))throw new Error();}catch{throw new HolderConfigurationError('Remote HTTPS token RPC required');}
  let tokenURL:string|null=null;
  if(env.AME_TOKEN_URL?.trim())try{const u=new URL(env.AME_TOKEN_URL.trim());if(u.protocol!=='https:'||u.username||u.password)throw new Error();tokenURL=u.href;}catch{throw new HolderConfigurationError('Invalid acquisition URL');}
  return {token:getAddress(token),chainId:Number(id),threshold,rpc,tokenURL};
}
export interface HolderClient{
  chain:()=>Promise<number>;block:()=>Promise<bigint>;code:(token:Address,block:bigint)=>Promise<Hex|undefined>;
  decimals:(token:Address,block:bigint)=>Promise<number>;balance:(token:Address,wallet:Address,block:bigint)=>Promise<bigint>;
}
function rpcClient(config:HolderConfig):HolderClient{
  const client=createPublicClient({transport:http(config.rpc,{timeout:8000,retryCount:0})});
  return {chain:()=>client.getChainId(),block:()=>client.getBlockNumber(),code:(address,blockNumber)=>client.getCode({address,blockNumber}),decimals:(address,blockNumber)=>client.readContract({address,abi:erc20Abi,functionName:'decimals',blockNumber}),balance:(address,wallet,blockNumber)=>client.readContract({address,abi:erc20Abi,functionName:'balanceOf',args:[wallet],blockNumber})};
}
const MAX=(1n<<256n)-1n;
/** Injectable RPC/clock are for tests. The exported production instance always uses server env + real RPC. */
export function createHolderVerifier({config=()=>readHolderConfig(),client=rpcClient,now=Date.now}:{config?:()=>HolderConfig|null;client?:(c:HolderConfig)=>HolderClient;now?:()=>number}={}){
  const cache=new Map<string,HolderAccess>(),pending=new Map<string,Promise<HolderAccess>>();
  return async function verify(input:string,refresh=false):Promise<HolderAccess>{
    if(!isAddress(input)||getAddress(input)===zeroAddress)throw new InvalidHolderWallet('Invalid wallet address');
    const wallet=getAddress(input);
    const locked=(reason:HolderAccess['reason']):HolderAccess=>({wallet,status:reason==='PRE_LAUNCH'?'success':'unavailable',access:'locked',isHolder:null,reason,balance:null,threshold:null,decimals:null,chainId:null,tokenAddress:null,tokenURL:null,block:null,checkedAt:now(),expiresAt:now()+30_000});
    let cfg:HolderConfig|null;
    try{cfg=config();}catch{return locked('CONFIGURATION_ERROR');}
    if(!cfg)return locked('PRE_LAUNCH');
    const c=cfg,key=JSON.stringify([wallet,c.chainId,c.token,c.threshold,c.rpc,c.tokenURL]);
    const hit=cache.get(key);if(!refresh&&hit&&hit.expiresAt>now())return hit;
    if(pending.has(key))return pending.get(key)!;
    if(pending.size>=32)return locked('VERIFICATION_UNAVAILABLE');
    const work=(async()=>{
      try{
        const rpc=client(c);
        if(await rpc.chain()!==c.chainId)throw new HolderConfigurationError('Token RPC chain mismatch');
        const block=await rpc.block(),code=await rpc.code(c.token,block);
        if(!code||code==='0x')throw new HolderConfigurationError('Token contract unavailable');
        const [decimals,balance]=await Promise.all([rpc.decimals(c.token,block),rpc.balance(c.token,wallet,block)]);
        if(!Number.isInteger(decimals)||decimals<0||decimals>255||(c.threshold.split('.')[1]?.length||0)>decimals)throw new HolderConfigurationError('Threshold precision exceeds token decimals');
        const threshold=parseUnits(c.threshold,decimals);
        if(threshold<=0n||threshold>MAX)throw new HolderConfigurationError('Invalid atomic holder threshold');
        if(typeof balance!=='bigint'||balance<0n||balance>MAX)throw new Error('Invalid ERC20 balance');
        if(await rpc.chain()!==c.chainId)throw new HolderConfigurationError('Token RPC chain changed');
        const isHolder=balance>=threshold,checkedAt=now();
        const result:HolderAccess={wallet,status:'success',access:isHolder?'unlocked':'locked',isHolder,reason:isHolder?'HOLDER':'NOT_HOLDER',balance:String(balance),threshold:String(threshold),decimals,chainId:c.chainId,tokenAddress:c.token,tokenURL:c.tokenURL,block:String(block),checkedAt,expiresAt:checkedAt+30_000};
        if(cache.size>=256)cache.delete(cache.keys().next().value!);
        cache.set(key,result);return result;
      }catch(error){cache.delete(key);return locked(error instanceof HolderConfigurationError?'CONFIGURATION_ERROR':'VERIFICATION_UNAVAILABLE');}
    })();
    pending.set(key,work);try{return await work;}finally{pending.delete(key);}
  };
}
export const verifyHolderAccess=createHolderVerifier();

/** Same server check authorizes status reads and fresh first-party action preparation. */
export async function handleHolderAccess(request:Request,verify=verifyHolderAccess):Promise<Response>{
  const headers={'cache-control':'private, no-store','content-type':'application/json'};
  const error=(message:string,status:number)=>Response.json({status:'error',access:'locked',error:message},{status,headers});
  if(Number(request.headers.get('content-length')||0)>2048)return error('Request too large',413);
  let body:Record<string,unknown>;
  try{const text=await request.text();if(text.length>2048)return error('Request too large',413);body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();}catch{return error('Invalid JSON request',400);}
  if(Object.keys(body).some(k=>!['walletAddress','refresh','intent'].includes(k))||typeof body.walletAddress!=='string'||(body.refresh!==undefined&&typeof body.refresh!=='boolean')||(body.intent!==undefined&&!['status','action'].includes(String(body.intent))))return error('Invalid holder request',400);
  try{
    const result=await verify(body.walletAddress,body.intent==='action'||body.refresh===true);
    const status=result.status==='unavailable'?503:body.intent==='action'&&result.access!=='unlocked'?403:200;
    return Response.json(result,{status,headers});
  }catch(error){return error instanceof InvalidHolderWallet?Response.json({status:'error',access:'locked',error:'Invalid wallet address'},{status:400,headers}):Response.json({status:'unavailable',access:'locked',error:'Verification unavailable'},{status:503,headers});}
}
