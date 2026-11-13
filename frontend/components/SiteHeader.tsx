'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { WalletControls } from './WalletControls';
import styles from './SiteHeader.module.css';

const X_URL = 'https://x.com/ame_runtime';
const TOKEN_ADDRESS = '0x5c5607a98e663e74590386dc7fa46de3cc7eb1b1';

export function SiteHeader() {
  const pathname = usePathname();
  const [copyStatus, setCopyStatus] = useState('');
  const active = (route: string) => pathname === route || pathname.startsWith(`${route}/`) ? 'page' as const : undefined;
  return <header className={`header flex items-center justify-between ${styles.header}`}>
    <Link className="wordmark" href="/" aria-label="AME home" aria-current={pathname === '/' ? 'page' : undefined}>ame<span aria-hidden="true">.</span></Link>
    <nav className={`nav flex items-center ${styles.links}`} aria-label="Main navigation">
      <Link href="/nfts" aria-current={active('/nfts')}>NFT</Link>
      <Link href="/tasks" aria-current={active('/tasks')}>Tasks</Link>
      <Link href="/passport" aria-current={active('/passport')}>Passport</Link>
      <Link href="/protocol" aria-current={active('/protocol')}>Protocol</Link>
      <Link href="/lending" aria-current={active('/lending')}>Lending</Link>
      <Link href="/docs" aria-current={active('/docs')}>Docs</Link>
      <a href={X_URL} target="_blank" rel="noopener noreferrer" aria-label="AME on X (opens in a new tab)" title="AME on X">X <span aria-hidden="true">↗</span></a>
      <a href="https://github.com/AME-ship-it/ame-core" target="_blank" rel="noopener noreferrer" aria-label="AME on GitHub (opens in a new tab)" title="AME source code">GitHub <span aria-hidden="true">↗</span></a>
    </nav>
    <WalletControls />
    <div className={styles.contractAddress}>
      <button onClick={async () => { try { await navigator.clipboard.writeText(TOKEN_ADDRESS); setCopyStatus('Contract address copied.'); } catch { setCopyStatus('Copy unavailable. Select the address to copy it manually.'); } }} aria-label={`Copy AME token contract address ${TOKEN_ADDRESS}`} title="Copy token contract address"><span>CA</span><span>{TOKEN_ADDRESS}</span></button>
      <span className={styles.copyStatus} role="status">{copyStatus}</span>
    </div>
  </header>;
}
