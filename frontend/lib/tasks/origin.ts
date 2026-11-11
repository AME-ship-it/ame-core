import {TaskError} from './model.ts';
/** Next's internal request URL may differ behind a proxy. Never trust caller-supplied forwarded hosts. */
export function taskRequestOrigin(request:Request,env:Record<string,string|undefined>=process.env){
 const url=new URL(request.url),origin=request.headers.get('origin');
 const allowed=env.VERCEL==='1'?['https://www.ame.guru','https://ame.guru',...(env.VERCEL_URL?[`https://${env.VERCEL_URL}`]:[])]:[`http://127.0.0.1:${url.port||'3000'}`,`http://localhost:${url.port||'3000'}`];
 if(origin&&!allowed.includes(origin))throw new TaskError('ORIGIN_MISMATCH',403);
 return origin||allowed[0];
}
