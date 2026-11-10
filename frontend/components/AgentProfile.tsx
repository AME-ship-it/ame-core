'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { zeroAddress } from 'viem';
import { agentLabel, isMissingAgent, parseAgentId, readAgent } from '@/lib/agents';
import { developmentChain } from '@/lib/chains';
import { contracts, contractConfigurationIssue } from '@/lib/contracts';
import { ProductShell } from './ProductShell';
import {parseIdentityMetadata} from '@/lib/agent-metadata';

export function AgentProfile({ id }: { id: string }) {
  let agentId: bigint | null = null;
  try { agentId = parseAgentId(id); } catch { /* Invalid route is a clean not-found state. */ }
  const query = useQuery({ queryKey: ['agent', developmentChain.id, contracts.agent.address, id], queryFn: () => readAgent(agentId!), enabled: agentId !== null && !contractConfigurationIssue, retry: false, refetchInterval: 15_000 });
  const agent = query.data;
  const metadata=agent?parseIdentityMetadata(agent.metadataURI):null;
  const explorer=developmentChain.blockExplorers?.default.url;
  return <ProductShell><p className="eyebrow">// AGENT REGISTRY / {developmentChain.name.toUpperCase()}</p>
    {agentId === null || (query.error && isMissingAgent(query.error)) ? <><h1 className="product-title">AGENT NOT FOUND_</h1><p className="product-copy">This ID does not identify an AME on the configured contract.</p><Link className="wallet" href="/agents">VIEW AGENTS ↗</Link></>
      : <><h1 className="product-title">{agentLabel(id)}<span className="caret">_</span></h1>
        {query.isPending && !contractConfigurationIssue && <p role="status" className="product-copy">READING ONCHAIN STATE...</p>}
        {query.error && <div role="alert"><p className="product-copy">{query.error.message}</p><button className="wallet" onClick={() => void query.refetch()}>RETRY READ</button></div>}
        {agent && <><p className="product-copy">REGISTERED ONCHAIN / No autonomous runtime is connected.</p><dl className="terminal-data">
          <div><dt>AGENT ID</dt><dd>{String(agent.id)}</dd></div><div><dt>OWNER</dt><dd>{agent.owner}</dd></div><div><dt>AGENT WALLET</dt><dd>{agent.wallet === zeroAddress ? 'UNASSIGNED' : agent.wallet}</dd></div>
          <div><dt>CREATED AT</dt><dd>{agent.createdAt === null ? 'EVENT UNAVAILABLE' : new Date(Number(agent.createdAt) * 1000).toISOString()}<small>Mint event block timestamp</small></dd></div>
          <div><dt>STATUS</dt><dd>{agent.status}<small>Derived from NFT existence; no runtime status is stored.</small></dd></div>
          <div><dt>REPUTATION</dt><dd>UNRATED<small>No reputation engine implemented</small></dd></div>
          <div><dt>TASKS COMPLETED</dt><dd>NOT TRACKED</dd></div><div><dt>TOTAL VOLUME</dt><dd>NOT TRACKED</dd></div><div><dt>EARNINGS</dt><dd>NOT TRACKED</dd></div>
          <div><dt>METADATA POINTER</dt><dd className="metadata-pointer">{agent.metadataURI}</dd></div>
          <div><dt>IDENTITY NAME</dt><dd>{metadata?.name??'NOT PROVIDED'}</dd></div><div><dt>DESCRIPTION</dt><dd>{metadata?.description??metadata?.issue??'NOT PROVIDED'}</dd></div>
          {agent.mintTransaction&&<div><dt>MINT TRANSACTION</dt><dd>{explorer?<a href={`${explorer}/tx/${agent.mintTransaction}`} target="_blank" rel="noopener noreferrer">{agent.mintTransaction} ↗</a>:agent.mintTransaction}</dd></div>}
        </dl>{agent.historyIssue&&<p className="product-copy" role="status">{agent.historyIssue}</p>}<p className="product-copy">Ownership, wallet and metadata are contract reads. Metadata can be updated by the current NFT owner. The assigned agent wallet is not a custodial wallet, executable AI runtime or lending authorization. Financial and task metrics are not stored by this core.</p></>}
      </>}
  </ProductShell>;
}
