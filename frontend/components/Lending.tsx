'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useConfig, useConnection, useWriteContract } from 'wagmi';
import {getConnection} from 'wagmi/actions';
import {holderGuardedAction,requireHolderAccess} from '@/lib/holder-access';
import { encodeFunctionData, erc20Abi, formatUnits, getAddress, parseEventLogs, parseUnits, zeroAddress, type Abi, type Address, type Hash } from 'viem';
import { ProductShell } from './ProductShell';
import { developmentChain } from '@/lib/chains';
import { agentClient } from '@/lib/agents';
import { lendingABI } from '@/lib/generated/lending';
import { lendingConfiguration, readLendingMarket } from '@/lib/lending';
import { positiveId } from '@/lib/lending-config';
import {testFaucetABI,testOracleABI} from '@/lib/test-faucet';
import {actionIssue,lendingError,parseTokenAmount,type LendingAction,type TransactionPhase} from '@/lib/lending-terminal';
import {LendingWorkspace,MainnetOverview} from './LendingWorkspace';
import styles from './Lending.module.css';

function quantity(value: bigint | undefined | null, decimals: number, symbol = '') {
  if (value === undefined || value === null) return 'Unavailable';
  const [whole, fraction] = formatUnits(value, decimals).split('.');
  return `${whole}${fraction ? '.' + fraction.slice(0, 6) : ''}${symbol ? ' ' + symbol : ''}`;
}
export function Lending({holderWallet}:{holderWallet:Address}) {
  const config=useConfig();
  const connection = useConnection();
  const writer = useWriteContract();
  const queryClient = useQueryClient();
  const [view,setView] = useState<'testnet'|'mainnet'>('testnet');
  const [phase,setPhase] = useState<TransactionPhase>('idle');
  const lock = useRef(false);
  const [positionInput, setPositionInput] = useState('');
  const [selected, setSelected] = useState<bigint>();
  const [agentInput, setAgentInput] = useState('');
  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('');
  const [minimumCollateral, setMinimumCollateral] = useState('');
  const [liquidationRepay,setLiquidationRepay] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [hash, setHash] = useState<Hash>();
  const storageKey = `ame-position:${developmentChain.id}:${lendingConfiguration.address}:${connection.address}`;
  useEffect(() => {
    try { const saved = localStorage.getItem(storageKey); setSelected(saved ? positiveId(saved) : undefined); setPositionInput(saved || ''); } catch { setSelected(undefined); setPositionInput(''); }
  }, [storageKey]);
  function selectPosition(id?: bigint) {
    setSelected(id); setPositionInput(id ? String(id) : '');
    try { if (id) localStorage.setItem(storageKey,String(id)); else localStorage.removeItem(storageKey); } catch { /* Onchain state remains available when browser storage is disabled. */ }
  }
  const configured = !lendingConfiguration.issue && !!lendingConfiguration.address;
  const query = useQuery({ queryKey: ['lending', developmentChain.id, lendingConfiguration.address, connection.address, String(selected)], queryFn: () => readLendingMarket(connection.address, selected), enabled: configured && view==='testnet', retry: false, refetchInterval: 15_000 });
  const data = query.data; const credit = data?.credit;
  const ready = view==='testnet' && configured && !!data && connection.isConnected && connection.chainId === developmentChain.id && !!connection.address && !busy && !query.isError;
  const actionError = lendingError;
  const parseAmount = parseTokenAmount;
  async function send(address: Address, abi: Abi, functionName: string, args: readonly unknown[]) {
    if (!connection.address) throw new Error('Connect a wallet.');
    const owner=connection.address;
    const assertWallet=()=>{const current=getConnection(config);if(!current.isConnected||!current.address||getAddress(current.address)!==getAddress(owner)||getAddress(owner)!==getAddress(holderWallet)||current.chainId!==developmentChain.id)throw new Error('Wallet or network changed. Verify holder access again.');};
    assertWallet();await requireHolderAccess(owner);assertWallet();
    setPhase('simulating');setMessage(`Simulating ${functionName} against the contract.`);
    const input = encodeFunctionData({ abi, functionName, args });
    const simulation = await agentClient.simulateContract({ address, abi, functionName, args, account: connection.address });
    setMessage(`Confirm ${functionName} in your wallet.`);
    setPhase('wallet');
    const submitted = await holderGuardedAction(owner,()=>getConnection(config).address,()=>{assertWallet();return writer.mutateAsync({...simulation.request,account:owner,chainId:developmentChain.id});}); setHash(submitted); setMessage(`Waiting for ${functionName} confirmation.`);
    setPhase('pending');
    const receipt = await agentClient.waitForTransactionReceipt({ hash: submitted, onReplaced: replacement => setHash(replacement.transaction.hash) });
    if (receipt.status !== 'success') throw new Error('Transaction reverted.');
    const transaction = await agentClient.getTransaction({ hash: receipt.transactionHash });
    if (!transaction.to || getAddress(transaction.to) !== getAddress(address) || transaction.input !== input || getAddress(transaction.from) !== getAddress(connection.address)) throw new Error('Transaction was replaced with a different action; no success is claimed.');
    return receipt;
  }
  async function approve(token: Address, value: bigint) {
    const allowance = await agentClient.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [connection.address!, lendingConfiguration.address!] });
    if (allowance < value) {
      // Reset nonzero allowances before a finite, exact approval; never request an unlimited approval.
      if (allowance > 0n) await send(token, erc20Abi, 'approve', [lendingConfiguration.address!, 0n]);
      await send(token, erc20Abi, 'approve', [lendingConfiguration.address!, value]);
    }
  }
  async function act(action: string) {
    if (!ready || lock.current || !data) return;
    lock.current = true; setBusy(true); setPhase('simulating'); setMessage('Checking transaction on the selected network.'); setHash(undefined);
    try {
      if (['deposit','borrow','repay','withdraw','addCollateral','removeCollateral'].includes(action)) {
        const decimals=action==='addCollateral'||action==='removeCollateral'?data.collateralDecimals:data.loanDecimals;
        const issue=actionIssue(action as LendingAction,parseAmount(amount,decimals),data,connection.address!);
        if(issue)throw new Error(issue);
      }
      const market = lendingConfiguration.address!;
      if (action === 'claimLoan' || action === 'claimCollateral') {
        if (!data.faucet) throw new Error('Test faucet unavailable for this market.');
        await send(action === 'claimLoan' ? data.asset : data.collateral,testFaucetABI,'claim',[]);
        setMessage('Valueless TESTNET asset claim confirmed. One fixed claim per wallet per asset every 24 hours.');
      } else if (action === 'refreshMockPrices') {
        if (!data.faucet) throw new Error('Mock oracle refresh unavailable for this market.');
        await send(data.faucet.oracle,testOracleABI,'refresh',[]);setMessage('Fixed mock quote timestamps refreshed. These are synthetic test prices, not market data.');
      } else if (action === 'openPosition') {
        const id = positiveId(agentInput); const receipt = await send(market, lendingABI, action, [id]);
        const [opened] = parseEventLogs({ abi: lendingABI, logs: receipt.logs, eventName: 'PositionOpened' });
        if (!opened || getAddress(opened.args.borrower) !== getAddress(connection.address!)) throw new Error('Confirmed transaction has no matching position event.');
        selectPosition(opened.args.positionId);
        setMessage(`Position ${opened.args.positionId} confirmed in block ${receipt.blockNumber}.`);
      } else if (action === 'setOperator') {
        if (!selected) throw new Error('Select a position.');
        const address = operator.trim() ? getAddress(operator.trim()) : zeroAddress;
        await send(market, lendingABI, action, [selected, address]); setMessage('Operator authorization confirmed.');
      } else {
        const col = action === 'addCollateral' || action === 'removeCollateral';
        const value = parseAmount(action==='liquidate'?liquidationRepay:amount, col ? data.collateralDecimals : data.loanDecimals);
        if (action === 'deposit') { await approve(data.asset, value); const quote = await agentClient.readContract({address:market,abi:lendingABI,functionName:'previewDeposit',args:[value]}); const minimum = quote * 9950n / 10000n; await send(market, lendingABI, 'depositWithMinShares', [value, connection.address!, minimum > 0n ? minimum : 1n]); }
        else if (action === 'withdraw') { const quote = await agentClient.readContract({address:market,abi:lendingABI,functionName:'previewWithdraw',args:[value]}); await send(market,lendingABI,'withdrawWithMaxShares',[value,connection.address!,connection.address!,quote * 10050n / 10000n + 1n]); }
        else {
          if (!selected) throw new Error('Select a position.');
          if (action === 'addCollateral') await approve(data.collateral, value);
          if (action === 'repay' || action === 'liquidate') await approve(data.asset, value);
          if (action === 'liquidate') {
            const minOut = parseAmount(minimumCollateral, data.collateralDecimals);
            await send(market, lendingABI, action, [selected, value, minOut]);
          } else await send(market, lendingABI, action, [selected, value]);
        }
        setMessage('Onchain action confirmed. Repay amounts are maxima: only current debt is collected. Refresh the position before another action.');
      }
      await query.refetch();
      await queryClient.invalidateQueries({queryKey:['lending-history']});setPhase('confirmed');
    } catch (error) { setPhase('error');setMessage(actionError(error)); }
    finally { setBusy(false); lock.current = false; }
  }
  return <ProductShell>
    <p className="eyebrow" role="status">HOLDER VERIFIED · $AME HOLDER VERIFIED</p>
    <div className={styles.topline}><p className="eyebrow">// AME CREDIT / {developmentChain.name.toUpperCase()}</p><Link href="/agents" className="text-link">Agent identities ↗</Link></div>
    <h1 className="product-title">Lending_</h1>
    <div className={styles.networkTabs} aria-label="Lending network view"><button aria-pressed={view==='testnet'} disabled={busy} onClick={()=>setView('testnet')}>{process.env.NODE_ENV!=='production' && developmentChain.id===31337?'Local':'Robinhood Testnet'} · Lending</button><button aria-pressed={view==='mainnet'} disabled={busy} onClick={()=>setView('mainnet')}>Robinhood Mainnet · Read only</button></div>
    {view==='mainnet'?<MainnetOverview account={connection.address}/>:<>
    <p className="product-copy">AME Lending — isolated, overcollateralized Agent Credit. Test assets and mock oracle prices only. Unaudited; no real-value lending.</p>
    {lendingConfiguration.issue && <p className={styles.notice} role="status">{lendingConfiguration.issue} No APR, balances or health factors are inferred. Existing identity and minting remain available.</p>}
    {configured && query.isPending && <p role="status">Reading the configured onchain market…</p>}
    {query.error && <p className={styles.notice} role="alert">{query.error.message} <button className="wallet" onClick={() => void query.refetch()}>Retry reads</button></p>}
    <dl className={styles.metrics}>
      <div><dt>Available liquidity</dt><dd>{data ? quantity(data.cash, data.loanDecimals, data.loanSymbol) : 'Unavailable'}</dd></div>
      <div><dt>Your supply claim</dt><dd>{data ? quantity(data.supplyBalance, data.loanDecimals, data.loanSymbol) : 'Unavailable'}</dd></div>
      <div><dt>Withdrawable now</dt><dd>{data ? quantity(data.withdrawable, data.loanDecimals, data.loanSymbol) : 'Unavailable'}</dd></div>
      <div><dt>Borrow APR / simple</dt><dd>{data ? `${formatUnits(data.apr, 2)}%` : 'Unavailable'}</dd></div>
      <div><dt>Utilization / debt ÷ assets</dt><dd>{data && data.nav > 0n ? `${formatUnits((data.nav - data.cash) * 10000n / data.nav, 2)}%` : data ? 'Empty market' : 'Unavailable'}</dd></div>
      <div><dt>LTV / liquidation threshold</dt><dd>{data ? `${formatUnits(data.ltv, 2)}% / ${formatUnits(data.threshold, 2)}%` : 'Unavailable'}</dd></div>
    </dl>
    {data && <p className={styles.small}>Snapshot block {String(data.block)} · Borrowing {data.paused ? 'PAUSED' : 'enabled'} · Term {String(data.term / 86400n)} days · Liquidation bonus {formatUnits(data.bonus, 2)}% · Deposit shares bear realized losses. Supply APY is not promised.</p>}
    <LendingWorkspace data={data} configured={configured} ready={ready} busy={busy} account={connection.address} amount={amount} setAmount={setAmount} onAction={action=>void act(action)} phase={phase} message={message} hash={hash}/>
    {data?.faucet && <section className={styles.section} aria-labelledby="test-faucet-title">
      <h2 id="test-faucet-title">TESTNET faucet / no value</h2>
      <p className="product-copy">Claim valueless test assets with your connected wallet. Each asset allows one fixed claim every 24 hours, subject to its supply cap. Testnet ETH is required for gas. Create an AME identity before opening a credit position.</p>
      <div className={styles.actions}><button className="wallet" disabled={!ready || data.timestamp < data.faucet.loanNext} onClick={() => void act('claimLoan')}>Claim {quantity(data.faucet.loanClaim,data.loanDecimals,data.loanSymbol)}</button><button className="wallet" disabled={!ready || data.timestamp < data.faucet.collateralNext} onClick={() => void act('claimCollateral')}>Claim {quantity(data.faucet.collateralClaim,data.collateralDecimals,data.collateralSymbol)}</button><Link className="text-link" href="/deploy">Create AME identity ↗</Link></div>
      <p className={styles.small}>Fixed MOCK quotes: 1 tUSD = 1 synthetic unit; 1 tCOL = 2 synthetic units. No live market feed. Updated {new Date(Number(data.faucet.updatedAt)*1000).toISOString()}. Quotes expire after one hour; anyone can refresh their timestamps without changing prices. {data.timestamp-data.faucet.updatedAt>3600n ? 'ORACLE STALE — borrowing is blocked until refreshed.' : 'Mock quotes are fresh.'}</p>
      <button className="wallet" disabled={!ready} onClick={() => void act('refreshMockPrices')}>Refresh mock test quotes</button>
    </section>}
    <section className={styles.section} aria-labelledby="credit-title"><h2 id="credit-title">Agent credit position</h2>
      <div className={styles.fields}><label className={styles.label}>AME ID / new position<input value={agentInput} onChange={event => setAgentInput(event.target.value)} inputMode="numeric" disabled={busy || !configured} /></label><button className="wallet" disabled={!ready} onClick={() => void act('openPosition')}>Open owner-bound position</button></div>
      <div className={styles.fields}><label className={styles.label}>Position ID<input value={positionInput} onChange={event => setPositionInput(event.target.value)} inputMode="numeric" disabled={busy || !configured} /></label><button className="wallet" disabled={!configured || busy} onClick={() => { try { selectPosition(positiveId(positionInput)); setMessage(''); } catch (error) { setMessage(actionError(error)); } }}>Load position</button><button className="wallet" disabled={busy} onClick={() => selectPosition()}>Clear selection</button></div>
      <p className={styles.small}>Each position belongs to its original borrower, not the NFT buyer. A transfer blocks new borrowing on the old position; it does not transfer debt or collateral rights.</p>
      {credit && data && <>
        <dl className="terminal-data"><div><dt>AME ID / identity evidence</dt><dd><Link href={`/agent/${credit.position.agentId}`}>AME_{String(credit.position.agentId)} ↗</Link><small>Identity score 1 = NFT exists. Not a creditworthiness score.</small></dd></div>
          <div><dt>Current NFT owner</dt><dd>{credit.currentOwner}</dd></div><div><dt>Assigned wallet</dt><dd>{credit.wallet === zeroAddress ? 'UNASSIGNED' : credit.wallet}</dd></div>
          <div><dt>Original borrower</dt><dd>{credit.position.borrower}</dd></div><div><dt>Authorized operator</dt><dd>{credit.position.operator === zeroAddress ? 'NONE' : credit.position.operator}<small>Also must remain the currently assigned wallet, with the original borrower still owning the NFT.</small></dd></div>
          <div><dt>Position state</dt><dd>{credit.position.closed ? 'CLOSED' : credit.position.dueAt === 0n ? 'NO LOAN YET' : data.timestamp >= credit.position.dueAt ? 'OVERDUE / LIQUIDATABLE' : 'OPEN'}</dd></div>
          <div><dt>Outstanding debt</dt><dd>{quantity(credit.debt, data.loanDecimals, data.loanSymbol)}</dd></div><div><dt>Collateral</dt><dd>{quantity(credit.position.collateral, data.collateralDecimals, data.collateralSymbol)}</dd></div>
          <div><dt>Health factor / risk</dt><dd>{credit.debt === 0n ? 'NO DEBT' : credit.health === null ? 'UNAVAILABLE — Oracle invalid or stale' : quantity(credit.health, 18)}<small>Liquidation below 1, or at term expiry. Informational reputation never changes these limits.</small></dd></div>
          <div><dt>Borrowable now</dt><dd>{credit.borrowable === null ? 'UNAVAILABLE — Oracle invalid or stale' : quantity(credit.borrowable, data.loanDecimals, data.loanSymbol)}</dd></div>
          <div><dt>Informational reputation</dt><dd>{String(credit.reputation)} / 100<small>Qualified repayments: {String(credit.history[4])}. Liquidations: {String(credit.history[1])}. Late repayments: {String(credit.history[5])}. Can be economically farmed; not a trusted lending signal.</small></dd></div>
          <div><dt>Verified engine history</dt><dd>{String(credit.history[0])} completed loans · {quantity(credit.history[2], data.loanDecimals, data.loanSymbol)} principal repaid<small>Agent lifetime counters persist across NFT transfers; borrower identity is retained per position.</small></dd></div>
        </dl>
        <label className={styles.label}>Operator address / blank revokes<input value={operator} onChange={event => setOperator(event.target.value)} disabled={busy} placeholder="Must match the current assigned agent wallet" /></label>
        <div className={styles.actions}><button className="wallet" disabled={!ready} onClick={() => void act('setOperator')}>Set / revoke operator</button></div>
        <label className={styles.label}>Liquidation maximum repayment / {data.loanSymbol}<input value={liquidationRepay} onChange={event=>setLiquidationRepay(event.target.value)} disabled={busy} inputMode="decimal" placeholder="Maximum repayment in the lending asset" /></label>
        <label className={styles.label}>Liquidation minimum collateral out<input value={minimumCollateral} onChange={event => setMinimumCollateral(event.target.value)} disabled={busy} inputMode="decimal" placeholder="Positive collateral slippage bound" /></label>
        <button className="wallet" disabled={!ready || credit.debt === 0n} onClick={() => void act('liquidate')}>Liquidate unhealthy / overdue position</button>
        <h3 className={styles.historyTitle}>Financial receipts / recent 5,000 blocks</h3>
        {credit.historyUnavailable ? <p className="product-copy">History RPC unavailable. Lifetime counters above are still contract reads.</p> : credit.receipts.length === 0 ? <p className="product-copy">No engine receipts found in this block window.</p> : <ol className={styles.receipts}>{credit.receipts.map(receipt => <li key={`${receipt.transactionHash}:${receipt.logIndex}`}><span>#{String(receipt.args.receiptId)} · {['BORROW', 'REPAY', 'LIQUIDATION'][Number(receipt.args.kind)]} · block {String(receipt.blockNumber)}</span><span>{quantity(receipt.args.principal, data.loanDecimals, data.loanSymbol)} · {receipt.args.kind === 2 ? 'bad debt' : 'interest'} {quantity(receipt.args.interest, data.loanDecimals, data.loanSymbol)}</span><code>{receipt.transactionHash}</code></li>)}</ol>}
      </>}
    </section>
    {!connection.isConnected && <p className="product-copy">Connect with the existing header wallet controls to submit an action.</p>}
    {connection.isConnected && connection.chainId !== developmentChain.id && <p className="product-copy">WRONG NETWORK — use the header to switch to {developmentChain.name}.</p>}
    <p className={styles.small}>Borrow proceeds always go to the original borrower. Approvals and each action are separate wallet confirmations. Supply/withdraw share quotes use a 0.5% slippage bound. Repayment does not require a valid oracle; liquidation and debt-bearing collateral withdrawals do. No private keys are stored here.</p>
    </>}
  </ProductShell>;
}



