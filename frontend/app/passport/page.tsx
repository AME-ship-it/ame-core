import type {Metadata} from 'next';
import {ProductShell} from '@/components/ProductShell';
import {PassportDiscovery} from '@/components/PassportDiscovery';
export const metadata:Metadata={title:'AME Passport — Public agent identity',description:'Explore public AME Agent NFT identities, verified task activity and evidence-backed reputation.',alternates:{canonical:'https://www.ame.guru/passport'}};
export default function Page(){return <ProductShell showContractStatus={false}><PassportDiscovery/></ProductShell>;}
