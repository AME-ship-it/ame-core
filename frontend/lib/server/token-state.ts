import {createPublicClient,erc20Abi,getAddress,http,isAddress,keccak256,parseAbiItem,zeroAddress,type Address,type Hex} from 'viem';
import type {TokenSnapshot} from '../token-state.ts';
if(typeof window!=='undefined')throw new Error('Token verification is server-only');
type Env=Record<string,string|undefined>;
export type TokenConfig={address:Address;chainId:4663;rpc:string[];runtimeHash:Hex;decimals:number;symbol:string;maxSupply:bigint;deploymentBlock:bigint;spender?:Address};
export function readTokenConfig(env:Env=process.env):TokenConfig|null{
  if(env.AME_TOKEN_VERIFIED!=='1')return null;
  const address=env.AME_TOKEN_ADDRESS?.trim()??'',hash=env.AME_TOKEN_RUNTIME_HASH?.trim()??'';
  const decimals=env.AME_TOKEN_DECIMALS??'',supply=env.AME_TOKEN_MAX_SUPPLY??'',block=env.AME_TOKEN_DEPLOYMENT_BLOCK??'',symbol=env.AME_TOKEN_SYMBOL??'';
  if(env.AME_TOKEN_CHAIN_ID!=='4663'||!isAddress(address)||getAddress(address)===zeroAddress||!/^0x[\da-fA-F]{64}$/.test(hash)||!/^\d{1,3}$/.test(decimals)||Number(decimals)>255||!/^\d{1,78}$/.test(supply)||BigInt(supply)<=0n||BigInt(supply)>=(1n<<256n)||!/^\d{1,30}$/.test(block)||BigInt(block)<=0n||!symbol||symbol.length>32)throw new Error('TOKEN_CONFIGURATION_INVALID');
  const rpc=[env.AME_TOKEN_RPC_URL||'https://rpc.mainnet.chain.robinhood.com',...(env.AME_TOKEN_RPC_FALLBACK_URLS||'').split(',').filter(Boolean)].map(s=>s.trim());
  if(rpc.length>3)throw new Error('TOKEN_CONFIGURATION_INVALID');
  for(const endpoint of rpc){const u=new URL(endpoint);if(u.protocol!=='https:'||u.username||u.password||['localhost','127.0.0.1','[::1]','0.0.0.0'].includes(u.hostname))throw new Error('TOKEN_CONFIGURATION_INVALID');}
  const spender=env.AME_TOKEN_ALLOWANCE_SPENDER?.trim();if(spender&&(!isAddress(spender)||getAddress(spender)===zeroAddress))throw new Error('TOKEN_CONFIGURATION_INVALID');
  return {address:getAddress(address),chainId:4663,rpc:[...new Set(rpc)],runtimeHash:hash.toLowerCase() as Hex,decimals:Number(decimals),symbol,maxSupply:BigInt(supply),deploymentBlock:BigInt(block),spender:spender?getAddress(spender):undefined};
}
function rpcClient(url:string,signal?:AbortSignal){return createPublicClient({transport:http(url,{retryCount:0,timeout:4000,fetchOptions:{signal}})});}
type TokenClient=ReturnType<typeof rpcClient>;
const transfer=parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');
export function createTokenReader({config=()=>readTokenConfig(),client=rpcClient,now=Date.now}:{config?:()=>TokenConfig|null;client?:(url:string,signal?:AbortSignal)=>TokenClient;now?:()=>number}={}){
  const cache=new Map<string,TokenSnapshot>(),pending=new Map<string,Promise<TokenSnapshot>>();
  return async (input:string,refresh=false):Promise<TokenSnapshot>=>{
    if(!isAddress(input)||getAddress(input)===zeroAddress)throw new Error('INVALID_WALLET');
    const wallet=getAddress(input),empty=(status:TokenSnapshot['status'],reason:string):TokenSnapshot=>({status,reason,chainId:4663,wallet,token:null,symbol:null,decimals:null,totalSupply:null,balance:null,allowance:null,spender:null,block:null,blockHash:null,blockTimestamp:null,checkedAt:now(),expiresAt:now(),transferCount:null,recentWindowComplete:false});
    let c:TokenConfig|null;try{c=config();}catch{return empty('unavailable','CONFIGURATION_ERROR');}if(!c)return empty('disabled','TOKEN_NOT_ACTIVATED');
    const cfg=c,key=JSON.stringify([wallet,cfg.address,cfg.runtimeHash,cfg.decimals,cfg.symbol,String(cfg.maxSupply),String(cfg.deploymentBlock),cfg.rpc,cfg.spender]);
    const old=cache.get(key);if(!refresh&&old&&old.expiresAt>now())return old;
    if(pending.has(key))return pending.get(key)!;if(pending.size>=16)return empty('unavailable','CAPACITY');
    const work=(async()=>{
      const signal=AbortSignal.timeout(10_000);
      for(const url of cfg.rpc){if(signal.aborted)break;try{
        const rpc=client(url,signal);if(await rpc.getChainId()!==4663)throw new Error('CHAIN_MISMATCH');
        const head=await rpc.getBlock();if(head.number===null||head.number<cfg.deploymentBlock+2n)throw new Error('BLOCK_UNAVAILABLE');
        if(now()/1000-Number(head.timestamp)>120||Number(head.timestamp)>now()/1000+30)throw new Error('STALE_RPC');
        const block=await rpc.getBlock({blockNumber:head.number-2n});if(!block.hash||block.number===null)throw new Error('BLOCK_UNAVAILABLE');
        if(old?.block===String(block.number)&&old.blockHash===block.hash){const refreshed={...old,checkedAt:now(),expiresAt:now()+10_000};cache.set(key,refreshed);return refreshed;}
        const code=await rpc.getCode({address:cfg.address,blockNumber:block.number});if(!code||code==='0x'||keccak256(code)!==cfg.runtimeHash)throw new Error('TOKEN_RUNTIME_MISMATCH');
        const contract={address:cfg.address,abi:erc20Abi,blockNumber:block.number} as const;
        const [decimals,symbol,totalSupply,balance,allowance]=await Promise.all([
          rpc.readContract({...contract,functionName:'decimals'}),rpc.readContract({...contract,functionName:'symbol'}),rpc.readContract({...contract,functionName:'totalSupply'}),rpc.readContract({...contract,functionName:'balanceOf',args:[wallet]}),
          cfg.spender?rpc.readContract({...contract,functionName:'allowance',args:[wallet,cfg.spender]}):Promise.resolve(null),
        ]);
        if(decimals!==cfg.decimals||symbol!==cfg.symbol||totalSupply<=0n||totalSupply>cfg.maxSupply||balance<0n||balance>totalSupply)throw new Error('TOKEN_METADATA_MISMATCH');
        let transferCount:number|null=null,recentWindowComplete=false;
        if(old?.block){const prior=BigInt(old.block),from=prior>2n?prior-2n:cfg.deploymentBlock;
          if(block.number>=from&&block.number-from<=64n){try{const [sent,received]=await Promise.all([rpc.getLogs({address:cfg.address,event:transfer,args:{from:wallet},fromBlock:from,toBlock:block.number}),rpc.getLogs({address:cfg.address,event:transfer,args:{to:wallet},fromBlock:from,toBlock:block.number})]);transferCount=new Set([...sent,...received].map(e=>`${e.blockHash}:${e.transactionHash}:${e.logIndex}`)).size;recentWindowComplete=true;}catch{/* Balance snapshot is valid; bounded activity remains unavailable. */}}
        }
        const check=await rpc.getBlock({blockNumber:block.number});if(check.hash!==block.hash||await rpc.getChainId()!==4663)throw new Error('REORG_OR_CHAIN_CHANGE');
        const result:TokenSnapshot={status:'synchronized',chainId:4663,wallet,token:cfg.address,symbol,decimals,totalSupply:String(totalSupply),balance:String(balance),allowance:allowance===null?null:String(allowance),spender:cfg.spender??null,block:String(block.number),blockHash:block.hash,blockTimestamp:Number(block.timestamp),checkedAt:now(),expiresAt:now()+10_000,transferCount,recentWindowComplete};
        if(cache.size>=256)cache.delete(cache.keys().next().value!);cache.set(key,result);return result;
      }catch{/* Retry the entire pinned snapshot on the next configured provider; never mix endpoints. */}}
      cache.delete(key);return empty('unavailable','VERIFICATION_UNAVAILABLE');
    })();pending.set(key,work);try{return await work;}finally{pending.delete(key);}
  };
}
export const readTokenSnapshot=createTokenReader();
