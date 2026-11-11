import {TaskError,type TaskRecord} from './model.ts';
export interface TaskStore{putChallenge(id:string,value:unknown):Promise<void>;getChallenge(id:string):Promise<unknown>;claim(id:string):Promise<boolean>;finish(record:TaskRecord,resource:string):Promise<'OK'|'DUPLICATE_TASK'|'DUPLICATE_EVIDENCE'>;history(identity:string,epoch:string):Promise<{history:TaskRecord[];completed:TaskRecord[]}>;limit(key:string):Promise<boolean>;}
const PREFIX='{ame-tasks-v1}:';
export const FINISH_LUA=`
if redis.call('EXISTS',KEYS[1])==1 then return 'DUPLICATE_TASK' end
if ARGV[3]=='VERIFIED' and redis.call('EXISTS',KEYS[2])==1 then return 'DUPLICATE_EVIDENCE' end
if redis.call('SET',KEYS[3],ARGV[1],'NX')==false then return 'DUPLICATE_TASK' end
redis.call('LPUSH',KEYS[4],ARGV[2])
if ARGV[3]=='VERIFIED' then
 redis.call('SET',KEYS[1],ARGV[2]);redis.call('SET',KEYS[2],ARGV[2]);redis.call('HSET',KEYS[5],ARGV[4],ARGV[1])
end
return 'OK'`;
export class RedisTaskStore implements TaskStore{
 private url:string;private token:string;private request:typeof fetch;
 constructor(url:string,token:string,request:typeof fetch=fetch){this.url=url;this.token=token;this.request=request;const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||u.hostname==='localhost')throw new TaskError('INVALID_STORAGE_CONFIGURATION',503);}
 async command(args:(string|number)[]):Promise<unknown>{const r=await this.request(this.url,{method:'POST',headers:{Authorization:`Bearer ${this.token}`,'content-type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(5000),cache:'no-store'});if(!r.ok)throw new TaskError('STORAGE_UNAVAILABLE',503);const d=await r.json();if(d.error)throw new TaskError('STORAGE_UNAVAILABLE',503);return d.result;}
 async putChallenge(id:string,value:unknown){if(await this.command(['SET',PREFIX+'challenge:'+id,JSON.stringify(value),'NX','EX',300])!=='OK')throw new TaskError('CHALLENGE_UNAVAILABLE',503);}
 async getChallenge(id:string){const v=await this.command(['GET',PREFIX+'challenge:'+id]);if(typeof v!=='string')throw new TaskError('CHALLENGE_EXPIRED',409);return JSON.parse(v);}
 async claim(id:string){return await this.command(['SET',PREFIX+'used:'+id,'1','NX','EX',600])==='OK';}
 async limit(key:string){const n=await this.command(['EVAL',"local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],60) end;return n",1,PREFIX+'rate:'+key]);return typeof n==='number'&&n<=30;}
 async finish(r:TaskRecord,resource:string){const identity=`4663:${r.registry.toLowerCase()}:${r.agentId}`,epoch=identity+':'+r.epoch;return await this.command(['EVAL',FINISH_LUA,5,PREFIX+'reward:'+epoch+':'+r.type,PREFIX+'evidence:'+resource,PREFIX+'record:'+r.id,PREFIX+'history:'+identity,PREFIX+'score:'+epoch,JSON.stringify(r),r.id,r.status,r.type]) as 'OK'|'DUPLICATE_TASK'|'DUPLICATE_EVIDENCE';}
 async history(identity:string,epoch:string){const ids=await this.command(['LRANGE',PREFIX+'history:'+identity,0,99]) as string[];const raw=ids.length?await this.command(['MGET',...ids.map(id=>PREFIX+'record:'+id)]) as (string|null)[]:[];const current=await this.command(['HVALS',PREFIX+'score:'+identity+':'+epoch]) as string[];return {history:raw.filter((v):v is string=>typeof v==='string').map(v=>JSON.parse(v)),completed:current.map(v=>JSON.parse(v))};}
}
export function configuredStore(env:Record<string,string|undefined>=process.env):TaskStore|null{const url=env.KV_REST_API_URL||env.UPSTASH_REDIS_REST_URL,token=env.KV_REST_API_TOKEN||env.UPSTASH_REDIS_REST_TOKEN;if(!url&&!token)return null;if(!url||!token)throw new TaskError('STORAGE_CONFIGURATION_INCOMPLETE',503);return new RedisTaskStore(url,token);}
