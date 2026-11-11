'use client';
import {useReportWebVitals} from 'next/web-vitals';
function report(metric:{name:string;value:number;rating:string}){
  // No address, account identifier, URL, or user-provided data is collected.
  if(!['CLS','LCP','INP','FCP','TTFB'].includes(metric.name))return;
  try{navigator.sendBeacon?.('/api/performance',new Blob([JSON.stringify({name:metric.name,value:metric.value,rating:metric.rating})],{type:'application/json'}));}catch{/* Diagnostics must never block navigation or wallet operations. */}
}
export function PerformanceVitals(){useReportWebVitals(report);return null;}
