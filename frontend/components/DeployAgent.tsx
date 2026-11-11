'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useConfig,useConnection, useWriteContract, useSwitchChain } from 'wagmi';
import {getConnection} from 'wagmi/actions';
import { isAddress,isAddressEqual, type Address, type Hash } from 'viem';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { developmentChain } from '@/lib/chains';
import { contracts, contractConfigurationIssue } from '@/lib/contracts';
import { agentClient, agentLabel, readAgent } from '@/lib/agents';
import { confirmMint, createMintController, transactionError, type MintPhase } from '@/lib/mint';
import { ProductShell } from './ProductShell';
import { walletErrorMessage } from '@/lib/wallet-errors';
import {parseIdentityMetadata} from '@/lib/agent-metadata';

type PendingMint = { hash: Hash; owner: Address };
const storageKey = `ame:mint:${developmentChain.id}:${contracts.agent.address || 'unconfigured'}`;
const phaseLabels: Record<MintPhase, string> = { ready: 'READY', waiting: 'WAITING FOR SIGNATURE', submitted: 'TRANSACTION SUBMITTED', pending: 'TRANSACTION PENDING', confirmed: 'TRANSACTION CONFIRMED', rejected: 'TRANSACTION REJECTED', reverted: 'TRANSACTION REVERTED', 'rpc-failure': 'RPC FAILURE', failed: 'UNKNOWN FAILURE','insufficient-funds':'INSUFFICIENT TESTNET GAS','wallet-changed':'WALLET CHANGED','submission-unknown':'SUBMISSION UNKNOWN' };

export function DeployAgent() {
  const { address, chainId, isConnected } = useConnection();
  const write = useWriteContract();
  const switching = useSwitchChain();
  const [networkError, setNetworkError] = useState('');
  useEffect(() => { setNetworkError(''); }, [chainId, address]);
  const config=useConfig(),queries=useQueryClient();
  const controller = useRef(createMintController());
  const checking = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [wallet, setWallet] = useState('');
  const [name,setName]=useState(''),[description,setDescription]=useState('');
  const [uncertainOwner,setUncertainOwner]=useState<Address|null>(null),[recoveryHash,setRecoveryHash]=useState(''),[checkedWallet,setCheckedWallet]=useState(false);
  const [phase, setPhase] = useState<MintPhase>('ready');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<PendingMint | null>(null);
  const [minted, setMinted] = useState<bigint | null>(null);
  const [preparing, setPreparing] = useState(false);

  function remember(hash: Hash, owner: Address) {
    const record = { hash, owner };
    setPending(record);
    setUncertainOwner(null);
    try{localStorage.removeItem(`${storageKey}:uncertain`);}catch{/* The submitted hash remains visible. */}
    try { localStorage.setItem(storageKey, JSON.stringify(record)); }
    catch { setMessage('Transaction submitted. Browser storage unavailable: keep this hash before leaving the page.'); }
  }
  async function check(record: PendingMint) {
    if (checking.current) return;
    checking.current = true; setPhase('pending'); setMessage('');
    try {
      const result = await confirmMint(agentClient, record.hash, record.owner, setPhase, hash => remember(hash, record.owner));
      setMinted(result.id);
      void queries.invalidateQueries({queryKey:['owned-agents',developmentChain.id,contracts.agent.address,record.owner]});
    } catch (error) { const failure = transactionError(error); setPhase(failure.phase); setMessage(failure.message); }
    finally { checking.current = false; }
  }
  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(storageKey);
      const unresolved=localStorage.getItem(`${storageKey}:uncertain`);
      if(!raw&&unresolved&&isAddress(unresolved)){setUncertainOwner(unresolved);setPhase('submission-unknown');setMessage('Check wallet activity. Recover the transaction hash before another mint.');}
      if (!raw || contractConfigurationIssue) return;
      const record = JSON.parse(raw) as PendingMint;
      if (!/^0x[0-9a-fA-F]{64}$/.test(record.hash) || !isAddress(record.owner)) throw new Error('Invalid saved mint');
      setPending(record); void check(record);
    } catch { setMessage('Saved transaction unavailable. Check your wallet history before submitting a new mint.'); setPhase('failed'); }
    // Read submitted transaction once after hydration. Do not submit a mint on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const profile = useQuery({ queryKey: ['minted-agent', developmentChain.id, contracts.agent.address, String(minted)], queryFn: () => readAgent(minted!), enabled: minted !== null, retry: false,refetchInterval:15000 });
  const metadata=profile.data?parseIdentityMetadata(profile.data.metadataURI):null;
  const explorer=developmentChain.blockExplorers?.default.url;
  const connected = mounted && isConnected && !!address;
  const wrongNetwork = connected && chainId !== developmentChain.id;
  const busy = switching.isPending || preparing || ['waiting', 'submitted', 'pending'].includes(phase);

  async function deploy() {
    if (!address || !connected || wrongNetwork || busy || pending || uncertainOwner || checking.current) return;
    setPreparing(true); setPhase('ready'); setMessage('');
    try {
      const owner = address;
      const result = await controller.current.submit({
        owner, chainId: chainId!, optionalWallet: wallet,metadata:{name,description}, client: agentClient,
        beforeWrite:()=>{
          const current=getConnection(config);
          if(!current.isConnected||current.chainId!==developmentChain.id||!current.address||!isAddressEqual(current.address,owner))throw new Error('WALLET CHANGED');
          const saved=localStorage.getItem(storageKey);
          if(saved){const record=JSON.parse(saved) as PendingMint;if(!/^0x[0-9a-fA-F]{64}$/.test(record.hash)||!isAddress(record.owner))throw new Error('MINT EVENT SAVED TRANSACTION INVALID');setPending(record);throw new Error('MINT EVENT ALREADY RECORDED — Recheck the saved transaction.');}
          if(localStorage.getItem(`${storageKey}:uncertain`))throw new Error('SUBMISSION UNKNOWN');
          // Persist intent synchronously before opening the wallet, including across reloads/tabs.
          localStorage.setItem(`${storageKey}:uncertain`,owner);
        },
        write: (agentWallet, metadataURI) => write.mutateAsync({ address: contracts.agent.address!, abi: contracts.agent.abi, functionName: 'mint', args: [agentWallet, metadataURI], account: owner, chainId: developmentChain.id }),
        onPhase: p=>{if(p==='waiting')localStorage.setItem(`${storageKey}:uncertain`,owner);setPhase(p);}, onHash: hash => remember(hash, owner),
      });
      setMinted(result.id);
      void queries.invalidateQueries({queryKey:['owned-agents',developmentChain.id,contracts.agent.address,owner]});
    } catch (error) { const failure = transactionError(error); setPhase(failure.phase); setMessage(failure.message);if(failure.phase==='submission-unknown'){let original=address;try{const saved=localStorage.getItem(`${storageKey}:uncertain`);if(saved&&isAddress(saved))original=saved;localStorage.setItem(`${storageKey}:uncertain`,original);}catch{/* Keep the warning on screen. */}setUncertainOwner(original);}else{try{localStorage.removeItem(`${storageKey}:uncertain`);}catch{/* No automatic retry. */}} }
    finally { setPreparing(false); }
  }
  function newMint() {
    if (phase !== 'confirmed' && phase !== 'reverted') return;
    try{localStorage.removeItem(storageKey);}catch{setMessage('Browser storage unavailable. Check wallet history before another mint.');return;} setPending(null); setMinted(null); setPhase('ready'); setMessage('');
  }
  function recover(){if(!uncertainOwner||!/^0x[0-9a-fA-F]{64}$/.test(recoveryHash.trim())){setMessage('Enter the transaction hash from your wallet activity.');return;}const record={owner:uncertainOwner,hash:recoveryHash.trim() as Hash};remember(record.hash,record.owner);void check(record);}
  function clearUncertain(){if(!checkedWallet||!uncertainOwner)return;try{localStorage.removeItem(`${storageKey}:uncertain`);}catch{return;}setUncertainOwner(null);setPhase('ready');setMessage('Wallet activity checked. No automatic resubmission was made.');setCheckedWallet(false);}
  const status = contractConfigurationIssue ? 'CONTRACT NOT CONFIGURED' : !connected ? 'WALLET DISCONNECTED' : wrongNetwork ? 'WRONG NETWORK' : preparing && phase === 'ready' ? 'CHECKING CONTRACT' : phaseLabels[phase];
  return <ProductShell><p className="eyebrow">// AGENT INITIALIZATION / {developmentChain.name.toUpperCase()}</p>
    <h1 className="product-title">{minted !== null ? `${agentLabel(minted)} REGISTERED` : 'DEPLOY AN AME_'} </h1>
    <p className="product-copy">{minted !== null ? 'Identity confirmed onchain. Autonomous execution is not enabled.' : 'Create an onchain identity. One transaction. Your AME ID is assigned by the contract.'}</p>
    <dl className="terminal-data">
      {minted===null&&<><div><dt><label htmlFor="agent-name">IDENTITY NAME</label></dt><dd><input id="agent-name" value={name} maxLength={64} disabled={busy||!!pending||!!uncertainOwner} onChange={e=>setName(e.target.value)} placeholder="AME Agent"/></dd></div><div><dt><label htmlFor="agent-description">DESCRIPTION</label></dt><dd><input id="agent-description" value={description} maxLength={500} disabled={busy||!!pending||!!uncertainOwner} onChange={e=>setDescription(e.target.value)} placeholder="Optional NFT identity description"/></dd></div></>}
      <div><dt>OWNER</dt><dd>{minted !== null ? profile.data?.owner || 'READING...' : mounted ? address || 'NOT CONNECTED' : 'NOT CONNECTED'}</dd></div>
      <div><dt>AGENT WALLET</dt><dd>{minted !== null ? profile.data?.wallet || 'READING...' : <><label className="sr-only" htmlFor="agent-wallet">Optional agent wallet address</label><input id="agent-wallet" value={wallet} disabled={busy || !!pending} onChange={event => setWallet(event.target.value)} placeholder="Optional — defaults to your wallet" autoComplete="off" spellCheck={false} /><small>When omitted, the connected owner wallet is assigned. Assignment does not prove control. The assigned wallet can issue core attestations; it receives no lending permission.</small></>}</dd></div>
      <div><dt>STATUS</dt><dd role="status" aria-live="polite">{status}</dd></div><div><dt>NETWORK</dt><dd>{mounted && isConnected ? `${chainId} / ${chainId === developmentChain.id ? developmentChain.name : 'WRONG NETWORK'}` : 'NOT CONNECTED'}</dd></div>
      {minted !== null && <><div><dt>REPUTATION</dt><dd>UNRATED</dd></div><div><dt>TASKS</dt><dd>NOT TRACKED</dd></div><div><dt>RECEIPTS</dt><dd>NOT LOADED</dd></div></>}
      {pending && <div><dt>TRANSACTION</dt><dd>{explorer?<a href={`${explorer}/tx/${pending.hash}`} target="_blank" rel="noopener noreferrer">{pending.hash} ↗</a>:pending.hash}</dd></div>}
      {metadata&&<><div><dt>METADATA NAME</dt><dd>{metadata.name??'NOT PROVIDED'}</dd></div><div><dt>DESCRIPTION</dt><dd>{metadata.description??metadata.issue??'NOT PROVIDED'}</dd></div><div><dt>METADATA POINTER</dt><dd className="metadata-pointer">{profile.data?.metadataURI}</dd></div></>}
    </dl>
    {message && <p className="product-copy" role="alert">{message}</p>}
    {profile.error && <p className="product-copy" role="alert">Mint confirmed; profile read failed: {profile.error.message}</p>}
    {!connected && <p className="product-copy">CONNECT WALLET using the header to continue.</p>}
    {wrongNetwork && <p className="product-copy">Identity minting requires {developmentChain.name} ({developmentChain.id}). This does not change the general AME network.</p>}
    {wrongNetwork && <button className="wallet" disabled={busy} onClick={async () => { setNetworkError(''); try { await switching.mutateAsync({chainId:developmentChain.id}); } catch (error) { setNetworkError(walletErrorMessage(error)); } }}>{switching.isPending ? 'SWITCHING NETWORK...' : `SWITCH TO ${developmentChain.name.toUpperCase()}`}</button>}
    {networkError && <p className="product-copy" role="alert">{networkError}</p>}
    {uncertainOwner&&<div className="product-copy"><p>Submission owner: {uncertainOwner}. Check wallet activity before another mint.</p><label htmlFor="mint-recovery">Transaction hash<input id="mint-recovery" value={recoveryHash} onChange={e=>setRecoveryHash(e.target.value)} placeholder="0x…"/></label><button className="wallet" disabled={busy} onClick={recover}>RECOVER TRANSACTION</button><label><input type="checkbox" checked={checkedWallet} onChange={e=>setCheckedWallet(e.target.checked)}/> I checked wallet activity and no mint was broadcast.</label><button className="wallet" disabled={!checkedWallet||busy} onClick={clearUncertain}>CLEAR UNKNOWN SUBMISSION</button></div>}
    <div className="product-actions">
      {minted !== null ? <><Link className="deploy flex items-center justify-between" href={`/agent/${minted}`}>VIEW AGENT <span>↗</span></Link><button className="wallet" onClick={newMint}>NEW MINT</button></> : <>
        {!pending && <button className="deploy flex items-center justify-between" disabled={!connected || wrongNetwork || busy || !!uncertainOwner || !contracts.agent.address} onClick={() => void deploy()}>{busy ? 'PROCESSING...' : 'DEPLOY AME'}<span>⟶</span></button>}
        {pending && !busy && phase !== 'reverted' && <button className="wallet" onClick={() => void check(pending)}>RECHECK TRANSACTION</button>}
        {phase === 'reverted' && <button className="wallet" onClick={newMint}>START NEW ATTEMPT</button>}
      </>}
    </div><p className="product-footnote">This mints an NFT identity, not an executable AI agent or financial permission. Mint fee: 0; testnet ETH gas is required. Metadata is inline JSON stored onchain and can be updated by the current NFT owner. Confirmation requires one block.</p>
  </ProductShell>;
}

