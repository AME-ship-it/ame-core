import {getAddress} from 'viem';
import {contentHash,object,agentId,walletAddress,TaskError} from './model.ts';
import type {RedisTaskStore} from './store.ts';

if(typeof window!=='undefined')throw new Error('Server-only credit ledger');
export const CREDIT_POLICY={version:'ame-credits-v1',issuanceEnabled:false,spendingEnabled:false,transferable:false,redeemableForMoney:false,xpConversion:null,tokenConversion:null} as const;
export type CreditIntent={id:string;agentId:string;wallet:string;epoch:string;operation:'grant'|'spend';units:number;purpose:string;authorizationId:string};
export type CreditPolicy={version:string;grantPurposes:readonly string[];spendPurposes:readonly string[];maxUnits:number};
export type CreditEntry=CreditIntent&{chainId:4663;registry:string;policy:string;timestamp:string;balance:number;intentHash:string};
// All keys share one Redis hash slot. Idempotency is global within this ledger;
// authorization claims and balance/history writes succeed or fail together.
export const CREDIT_LUA=`
local prior=redis.call('GET',KEYS[1])
if prior then local p=cjson.decode(prior);if p.intentHash~=ARGV[1] then return {'IDEMPOTENCY_CONFLICT'} end;return {'OK',prior} end
if redis.call('EXISTS',KEYS[2])==1 then return {'AUTHORIZATION_REPLAYED'} end
local balance=tonumber(redis.call('GET',KEYS[3]) or '0')
local next=balance+tonumber(ARGV[2])
if next<0 then return {'INSUFFICIENT_CREDITS'} end
if next>1000000000 then return {'CREDIT_BALANCE_LIMIT'} end
local r=cjson.decode(ARGV[3]);r.balance=next
local t=redis.call('TIME');r.timestamp=t[1]..'.'..t[2]
local encoded=cjson.encode(r)
redis.call('SET',KEYS[1],encoded);redis.call('SET',KEYS[2],r.id)
redis.call('SET',KEYS[3],tostring(next));redis.call('RPUSH',KEYS[4],encoded)
return {'OK',encoded}`;

/** No public mutation endpoint or production issuance policy is installed.
 * An eventual caller must verify a wallet-bound, expiring, single-use intent
 * AND fresh NFT authority in authorize; true must never come from client input.
 * Policy is server-owned and disabled by default. XP cannot invoke this ledger.
 */
export function createCreditLedger({store,registry,policy=null,authorize,namespace='ame-credits-v1'}:{store:RedisTaskStore;registry:string;policy?:CreditPolicy|null;authorize:(intent:CreditIntent)=>Promise<boolean>;namespace?:string}){
 if(!/^[a-z0-9-]{1,100}$/.test(namespace))throw new TaskError('INVALID_STORAGE_NAMESPACE');
 const prefix='{'+namespace+'}:',contract=getAddress(registry);
 const account=(id:string,wallet:string,epoch:string)=>{agentId(id);walletAddress(wallet);if(!/^0x[0-9a-f]{64}$/.test(epoch))throw new TaskError('INVALID_OWNERSHIP_EPOCH');return contentHash({chainId:4663,registry:contract,agentId:id,wallet:getAddress(wallet),epoch});};
 return {
  async balance(id:string,wallet:string,epoch:string){return Number(await store.command(['GET',prefix+'balance:'+account(id,wallet,epoch)])||0);},
  async history(id:string,wallet:string,epoch:string){const raw=await store.command(['LRANGE',prefix+'history:'+account(id,wallet,epoch),0,-1]) as string[];return raw.map(r=>JSON.parse(r) as CreditEntry);},
  async transact(input:CreditIntent){
   if(!policy)throw new TaskError('CREDIT_POLICY_NOT_APPROVED',403);
   const v=object(input,['id','agentId','wallet','epoch','operation','units','purpose','authorizationId']);
   if(typeof v.id!=='string'||! /^[0-9a-f-]{36}$/.test(v.id)||typeof v.authorizationId!=='string'||! /^[0-9a-f-]{36}$/.test(v.authorizationId)||!Number.isSafeInteger(v.units)||Number(v.units)<=0||!Number.isSafeInteger(policy.maxUnits)||policy.maxUnits<1||policy.maxUnits>1000000000||Number(v.units)>policy.maxUnits)throw new TaskError('INVALID_CREDIT_INTENT');
   if(!['grant','spend'].includes(String(v.operation))||typeof v.purpose!=='string'||!(v.operation==='grant'?policy.grantPurposes:policy.spendPurposes).includes(v.purpose))throw new TaskError('CREDIT_PURPOSE_NOT_APPROVED',403);
   const intent={...input,wallet:walletAddress(input.wallet)},key=account(intent.agentId,intent.wallet,intent.epoch);
   if(!await authorize(intent))throw new TaskError('CREDIT_AUTHORIZATION_INVALID',403);
   const hash=contentHash({...intent,policy:policy.version,registry:contract,chainId:4663});
   const result=await store.command(['EVAL',CREDIT_LUA,4,prefix+'transaction:'+intent.id,prefix+'authorization:'+intent.authorizationId,prefix+'balance:'+key,prefix+'history:'+key,hash,intent.operation==='spend'?-intent.units:intent.units,JSON.stringify({...intent,chainId:4663,registry:contract,policy:policy.version,intentHash:hash})]) as string[];
   if(result[0]!=='OK')throw new TaskError(result[0],409);
   return JSON.parse(result[1]) as CreditEntry;
  }
 };
}
