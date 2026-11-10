'use client';
import Link from 'next/link';
import { SiteHeader } from './SiteHeader';
import { deploymentConfigurationIssue as contractConfigurationIssue } from '@/lib/contracts';

export function ProductShell({ children }: { children: React.ReactNode }) {
  return <><a className="skip-link" href="#product-main">Skip to content</a><SiteHeader />
    <main id="product-main" className="product-main">{contractConfigurationIssue && <p className="product-copy" role="status">{contractConfigurationIssue}</p>}{children}</main>
    <footer className="site-footer flex justify-between"><Link href="/" className="footer-brand">ame.</Link><Link href="/agents">Your agents ↗</Link><Link href="/lending">Lending ↗</Link><span>ONCHAIN IDENTITY / TEST ENVIRONMENT</span></footer></>;
}

