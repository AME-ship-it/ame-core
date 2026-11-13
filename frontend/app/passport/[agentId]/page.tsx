import {cache} from 'react';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {readPassport} from '@/lib/passport/server';
import {passportId,passportError,passportURL} from '@/lib/passport/service';
import {ProductShell} from '@/components/ProductShell';
import {PassportView} from '@/components/PassportView';
export const runtime='nodejs';export const dynamic='force-dynamic';
const read=cache(readPassport);
type Props={params:Promise<{agentId:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{const {agentId}=await params;try{passportId(agentId);}catch{return {title:'Passport not found',robots:{index:false,follow:false}};}let description='Public AME identity, onchain ownership and server-attested task history.';try{const p=await read(agentId);if(p.activity.status==='available')description=`AME #${agentId}: ${p.activity.xp} current-epoch Task XP. Activity Reputation Index ${p.activity.reputation!.index}/100. Not a credit score.`;}catch{description='AME Passport verification is temporarily unavailable. No fresh metrics are claimed.';}return {title:`AME Passport #${agentId}`,description,alternates:{canonical:passportURL(agentId)},openGraph:{title:`AME Passport #${agentId}`,description,url:passportURL(agentId),siteName:'AME Protocol',type:'profile'},twitter:{card:'summary_large_image',title:`AME Passport #${agentId}`,description,images:[passportURL(agentId)+'/opengraph-image']}};}
export default async function Page({params}:Props){const {agentId}=await params;try{passportId(agentId);}catch{notFound();}try{const initial=await read(agentId);return <ProductShell showContractStatus={false}><PassportView id={agentId} initial={initial}/></ProductShell>;}catch(error){const e=passportError(error);if(e.status===404||e.status===400)notFound();return <ProductShell showContractStatus={false}><PassportView id={agentId} error={e.message}/></ProductShell>;}}
