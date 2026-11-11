'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useConnection } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { agentLabel, readOwnedAgentIds } from '@/lib/agents';
import { developmentChain } from '@/lib/chains';
import { contracts, contractConfigurationIssue } from '@/lib/contracts';
import { ProductShell } from './ProductShell';

export function AgentsList() {
  const { address, isConnected } = useConnection();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const enabled = mounted && isConnected && !!address && !contractConfigurationIssue;
  const query = useQuery({ queryKey: ['owned-agents', developmentChain.id, contracts.agent.address, address], queryFn: () => readOwnedAgentIds(address!), enabled, retry: false, refetchInterval: 15_000 });
  return <ProductShell><p className="eyebrow">// CURRENT OWNERSHIP / {developmentChain.name.toUpperCase()}</p><h1 className="product-title">YOUR AGENTS_</h1>
    {!mounted || !isConnected ? <p className="product-copy">Connect your wallet using the header to view your agents.</p> : <>
      <p className="product-copy address-wrap">OWNER / {address}</p>
      {query.isPending && enabled && <p role="status" className="product-copy">READING TRANSFER HISTORY...</p>}
      {query.error && <div role="alert"><p className="product-copy">{query.error.message}</p><button className="wallet" onClick={() => void query.refetch()}>RETRY READ</button></div>}
      {query.data && (query.data.length ? <ul className="agent-list">{query.data.map(id => <li key={String(id)}><Link href={`/agent/${id}`}>{agentLabel(id)}<span>VIEW AGENT ↗</span></Link></li>)}</ul> : <p className="product-copy">NO AGENTS OWNED ON THIS CONTRACT.</p>)}
    </>}
    <Link className="wallet" href="/deploy">DEPLOY AN AME ↗</Link><p className="product-footnote">NFT identities derived from paginated Transfer events and verified against current ownerOf. Refreshes every 15 seconds. These identities do not start autonomous AI execution or grant financial permissions.</p>
  </ProductShell>;
}
