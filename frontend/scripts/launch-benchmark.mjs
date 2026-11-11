// Read-only, bounded diagnostic. Local concurrency test; public origins require --public (maximum 6 requests).
import {writeFile} from 'node:fs/promises';
const origin=new URL(process.argv[2]||'http://127.0.0.1:3119'),publicRun=process.argv.includes('--public');
if(!['http:','https:'].includes(origin.protocol)||(!['127.0.0.1','localhost'].includes(origin.hostname)&&!publicRun))throw Error('Public origins require explicit --public');
const count=publicRun?6:24,concurrency=publicRun?2:4,wallet='0x1000000000000000000000000000000000000001';
const results=[];let next=0;
await Promise.all(Array.from({length:concurrency},async()=>{while(next<count){const i=next++,route=['health','token-state','holder-access'][i%3],start=performance.now();
  try{const response=await fetch(new URL('/api/'+route,origin),{method:route==='health'?'GET':'POST',headers:{'content-type':'application/json'},body:route==='health'?undefined:JSON.stringify({walletAddress:wallet}),signal:AbortSignal.timeout(15000)});const body=await response.json();results.push({route,ms:performance.now()-start,status:response.status,state:body.status,reason:body.reason??null});}catch{results.push({route,ms:performance.now()-start,status:0});}
}}));
const summarize=rows=>{const ms=rows.map(r=>r.ms).sort((a,b)=>a-b),p=q=>Number(ms[Math.max(0,Math.ceil(ms.length*q)-1)].toFixed(1));return {samples:rows.length,p50:p(.5),p95:p(.95),errors:rows.filter(r=>r.status!==200).length,statuses:rows.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{})};};
const report={measuredAt:new Date().toISOString(),environment:publicRun?'production-bounded-read-check':'local-production-server',concurrency,publicWrites:0,api:summarize(results),routes:Object.fromEntries(['health','token-state','holder-access'].map(r=>[r,summarize(results.filter(x=>x.route===r))]))};
console.log(JSON.stringify(report,null,2));if(process.env.AME_BENCH_REPORT)await writeFile(process.env.AME_BENCH_REPORT,JSON.stringify(report,null,2)+'\n');if(report.api.errors)process.exitCode=1;
