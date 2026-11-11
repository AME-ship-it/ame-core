import {getAddress,isAddress,type Address} from 'viem';

export type HolderReason='HOLDER'|'NOT_HOLDER'|'PRE_LAUNCH'|'CONFIGURATION_ERROR'|'VERIFICATION_UNAVAILABLE'|'ENTITLEMENTS_DISABLED';
export type HolderAccess={status:'success'|'unavailable';wallet:Address;access:'locked'|'unlocked';isHolder:boolean|null;reason:HolderReason;balance:string|null;threshold:string|null;decimals:number|null;chainId:number|null;tokenAddress:Address|null;tokenURL:string|null;block:string|null;checkedAt:number;expiresAt:number};

/** Eligibility is separate from lending authorization, creditworthiness and network selection. */
export function isUnlockedForWallet(data:HolderAccess|undefined,wallet:string|undefined,now=Date.now()):boolean{
  if(!wallet||!isAddress(wallet)||!data||!isAddress(data.wallet)||getAddress(data.wallet)!==getAddress(wallet))return false;
  if(data.status!=='success'||data.access!=='unlocked'||data.isHolder!==true||data.reason!=='HOLDER'||data.expiresAt<=now||data.checkedAt>now||data.expiresAt-data.checkedAt>30_000)return false;
  if(!Number.isSafeInteger(data.chainId)||!data.chainId||!data.tokenAddress||!isAddress(data.tokenAddress)||data.decimals===null||!Number.isInteger(data.decimals)||data.decimals<0||data.decimals>255)return false;
  if(!/^\d+$/.test(data.balance??'')||!/^\d+$/.test(data.threshold??''))return false;
  return BigInt(data.threshold!)>0n&&BigInt(data.balance!)>=BigInt(data.threshold!);
}

export type HolderPresentation='disconnected'|'checking'|'prelaunch'|'unavailable'|'not-holder'|'unlocked'|'holder-no-entitlements';
export function holderPresentation({connected,wallet,data,failed=false,pending=false,now=Date.now()}:{connected:boolean;wallet?:string;data?:HolderAccess;failed?:boolean;pending?:boolean;now?:number}):HolderPresentation{
  if(!connected||!wallet)return 'disconnected';
  if(!isAddress(wallet))return 'unavailable';
  if(failed)return 'unavailable';
  if(pending&&!data)return 'checking';
  if(isUnlockedForWallet(data,wallet,now))return 'unlocked';
  if(!data||!isAddress(data.wallet)||getAddress(data.wallet)!==getAddress(wallet))return 'unavailable';
  if(data.status==='success'&&data.reason==='ENTITLEMENTS_DISABLED'&&data.isHolder===true&&data.expiresAt>now)return 'holder-no-entitlements';
  if(data.reason==='PRE_LAUNCH')return 'prelaunch';
  if(data.reason==='NOT_HOLDER'&&data.status==='success'&&data.expiresAt>now)return 'not-holder';
  return 'unavailable';
}

export async function requestHolderAccess(wallet:string,{refresh=false,action=false,signal}:{refresh?:boolean;action?:boolean;signal?:AbortSignal}={}):Promise<HolderAccess>{
  if(!isAddress(wallet))throw new Error('Invalid wallet address.');
  const controller=new AbortController(),abort=()=>controller.abort();
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,12_000);
  try{
  const response=await fetch('/api/holder-access',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({walletAddress:getAddress(wallet),refresh,intent:action?'action':'status'}),cache:'no-store',signal:controller.signal});
  const data=await response.json() as HolderAccess;
  if(!data||!isAddress(data.wallet)||getAddress(data.wallet)!==getAddress(wallet)||!['success','unavailable'].includes(data.status)||!['locked','unlocked'].includes(data.access))throw new Error('Holder verification is unavailable.');
  if(!response.ok&&response.status!==403&&response.status!==503)throw new Error('Holder verification is unavailable.');
  return data;
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}

/** Every approval/write must recheck with the server; no storage flag or UI badge grants access. */
export async function requireHolderAccess(wallet:string):Promise<void>{
  const result=await requestHolderAccess(wallet,{action:true});
  if(!isUnlockedForWallet(result,wallet))throw new Error(result.reason==='NOT_HOLDER'?'$AME holder access is required.':'Holder verification is unavailable. No wallet request was made.');
}

export async function holderGuardedAction<T>(wallet:string,currentWallet:()=>string|undefined,action:()=>Promise<T>):Promise<T>{
  await requireHolderAccess(wallet);
  const current=currentWallet();
  if(!current||!isAddress(current)||getAddress(current)!==getAddress(wallet))throw new Error('Wallet changed. Verify holder access again.');
  return action();
}
