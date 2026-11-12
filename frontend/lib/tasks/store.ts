import type {WriteGrant} from './activation.ts';
import {TaskError,type TaskRecord} from './model.ts';
export interface TaskStore{activationOpen?(grant:WriteGrant):Promise<boolean>;clock?():Promise<number>;putChallenge(id:string,value:unknown):Promise<void>;getChallenge(id:string):Promise<unknown>;claim(id:string):Promise<boolean>;finish(record:TaskRecord,resource:string,grant?:WriteGrant):Promise<'OK'|'DUPLICATE_TASK'|'DUPLICATE_EVIDENCE'|'WRITE_SCOPE_EXPIRED'|'WRITE_SCOPE_EXHAUSTED'|'WRITE_SCOPE_CLOSED'>;history(identity:string,epoch:string):Promise<{history:TaskRecord[];completed:TaskRecord[]}>;limit(key:string):Promise<boolean>;}

export const FINISH_LUA=`
if ARGV[5]~='' then
 local t=redis.call('TIME');local now=tonumber(t[1])*1000+math.floor(tonumber(t[2])/1000)
 if now>=tonumber(ARGV[5]) then return 'WRITE_SCOPE_EXPIRED' end
 if redis.call('GET',KEYS[8])~='enabled' then return 'WRITE_SCOPE_CLOSED' end
 if tonumber(redis.call('GET',KEYS[7]) or '0')>=tonumber(ARGV[6]) then return 'WRITE_SCOPE_EXHAUSTED' end
end
if redis.call('EXISTS',KEYS[6])==1 then return 'DUPLICATE_TASK' end
if redis.call('EXISTS',KEYS[1])==1 then return 'DUPLICATE_TASK' end
if ARGV[3]=='VERIFIED' and redis.call('EXISTS',KEYS[2])==1 then return 'DUPLICATE_EVIDENCE' end
if redis.call('SET',KEYS[3],ARGV[1],'NX')==false then return 'DUPLICATE_TASK' end
redis.call('LPUSH',KEYS[4],ARGV[2])
if ARGV[3]=='VERIFIED' then
 if ARGV[5]~='' then redis.call('INCR',KEYS[7]);redis.call('PEXPIREAT',KEYS[7],tonumber(ARGV[5])+86400000) end
 redis.call('SET',KEYS[6],ARGV[2]);redis.call('SET',KEYS[1],ARGV[2]);redis.call('SET',KEYS[2],ARGV[2]);redis.call('HSET',KEYS[5],ARGV[4],ARGV[1])
end
return 'OK'`;
export class RedisTaskStore implements TaskStore{
 private url:string;private token:string;private request:typeof fetch;private prefix:string;
 constructor(url:string,token:string,request:typeof fetch=fetch,namespace='ame-tasks-v1'){if(!/^[a-z0-9-]{1,100}$/.test(namespace))throw new TaskError('INVALID_STORAGE_NAMESPACE');this.prefix='{'+namespace+'}:';this.url=url;this.token=token;this.request=request;const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||u.hostname==='localhost')throw new TaskError('INVALID_STORAGE_CONFIGURATION',503);}
 async command(args:(string|number)[]):Promise<unknown>{const r=await this.request(this.url,{method:'POST',headers:{Authorization:`Bearer ${this.token}`,'content-type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(5000),cache:'no-store'});if(!r.ok)throw new TaskError('STORAGE_UNAVAILABLE',503);const d=await r.json();if(d.error)throw new TaskError('STORAGE_UNAVAILABLE',503);return d.result;}
 async activationOpen(grant:WriteGrant){const [state,used]=await this.command(['MGET',this.prefix+'activation-state:'+grant.key,this.prefix+'activation:'+grant.key]) as [string|null,string|null];return state==='enabled'&&Number(used||0)<grant.limit;}
 async clock(){const t=await this.command(['TIME']) as [string,string];if(!Array.isArray(t)||t.length!==2||!/^\d+$/.test(t[0])||!/^\d+$/.test(t[1]))throw new TaskError('STORAGE_CLOCK_UNAVAILABLE',503);return Number(t[0])*1000+Math.floor(Number(t[1])/1000);}
 async putChallenge(id:string,value:unknown){if(await this.command(['SET',this.prefix+'challenge:'+id,JSON.stringify(value),'NX','EX',300])!=='OK')throw new TaskError('CHALLENGE_UNAVAILABLE',503);}
 async getChallenge(id:string){const v=await this.command(['GET',this.prefix+'challenge:'+id]);if(typeof v!=='string')throw new TaskError('CHALLENGE_EXPIRED',409);return JSON.parse(v);}
 async claim(id:string){return await this.command(['SET',this.prefix+'used:'+id,'1','NX','EX',600])==='OK';}
 async limit(key:string){const n=await this.command(['EVAL',"local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],60) end;return n",1,this.prefix+'rate:'+key]);return typeof n==='number'&&n<=30;}
 async finish(r:TaskRecord,resource:string,grant?:WriteGrant){const identity=`4663:${r.registry.toLowerCase()}:${r.agentId}`,epoch=identity+':'+r.epoch;return await this.command(['EVAL',FINISH_LUA,8,this.prefix+'reward:'+epoch+':'+r.type,this.prefix+'evidence:'+resource,this.prefix+'record:'+r.id,this.prefix+'history:'+identity,this.prefix+'score:'+epoch,this.prefix+'lifetime:'+identity+':'+r.type,this.prefix+'activation:'+(grant?.key||'disabled'),this.prefix+'activation-state:'+(grant?.key||'disabled'),JSON.stringify(r),r.id,r.status,r.type,grant?String(grant.expires):'',grant?.limit||0]) as 'OK'|'DUPLICATE_TASK'|'DUPLICATE_EVIDENCE'|'WRITE_SCOPE_EXPIRED'|'WRITE_SCOPE_EXHAUSTED'|'WRITE_SCOPE_CLOSED';}
 async history(identity:string,epoch:string){const [ids,current]=await this.command(['EVAL',"return {redis.call('LRANGE',KEYS[1],0,-1),redis.call('HVALS',KEYS[2])}",2,this.prefix+'history:'+identity,this.prefix+'score:'+identity+':'+epoch]) as [string[],string[]];const raw=ids.length?await this.command(['MGET',...ids.map(id=>this.prefix+'record:'+id)]) as (string|null)[]:[];if(raw.some(v=>typeof v!=='string'))throw new TaskError('STORAGE_HISTORY_INCOMPLETE',503);return {history:raw.map(v=>JSON.parse(v!)),completed:current.map(v=>JSON.parse(v))};}
}
export function configuredStore(env:Record<string,string|undefined>=process.env):TaskStore|null{const url=env.KV_REST_API_URL||env.UPSTASH_REDIS_REST_URL,token=env.KV_REST_API_TOKEN||env.UPSTASH_REDIS_REST_TOKEN;if(!url&&!token)return null;if(!url||!token)throw new TaskError('STORAGE_CONFIGURATION_INCOMPLETE',503);return new RedisTaskStore(url,token);}
