'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { WalletControls } from './WalletControls';
import styles from './SiteHeader.module.css';

const X_URL = 'https://x.com/ame_runtime';

export function SiteHeader() {
  const pathname = usePathname();
  const [activeHash, setActiveHash] = useState('');
  useEffect(() => {
    const syncHash = () => setActiveHash(window.location.hash);
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, [pathname]);
  const sectionActive = (hash: string) => pathname === '/' && activeHash === hash ? 'location' as const : undefined;
  return <header className="header flex items-center justify-between">
    <Link className="wordmark" href="/" aria-label="AME home" aria-current={pathname === '/' && !activeHash ? 'page' : undefined} onClick={() => setActiveHash('')}>ame<span aria-hidden="true">.</span></Link>
    <nav className={`nav flex items-center ${styles.links}`} aria-label="Main navigation">
      <Link href="/lending" aria-current={pathname === '/lending' || pathname.startsWith('/lending/') ? 'page' : undefined}>Lending</Link>
      <Link href="/#nfts" aria-current={sectionActive('#nfts')} onClick={() => setActiveHash('#nfts')}>NFTs</Link>
      <Link href="/#protocol" aria-current={sectionActive('#protocol')} onClick={() => setActiveHash('#protocol')}>Protocol</Link>
      <Link href="/#docs" aria-current={sectionActive('#docs')} onClick={() => setActiveHash('#docs')}>Docs</Link>
      <a href={X_URL} target="_blank" rel="noopener noreferrer" aria-label="AME on X (opens in a new tab)" title="AME on X">X <span aria-hidden="true">↗</span></a>
      <a href="https://github.com/AME-ship-it/ame-protocol" target="_blank" rel="noopener noreferrer" aria-label="AME on GitHub (opens in a new tab)" title="AME source code">GitHub <span aria-hidden="true">↗</span></a>
    </nav>
    <WalletControls />
  </header>;
}
