'use client';

import { useEffect, useRef, useState, useId } from 'react';
import { useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain, type Connector } from 'wagmi';
import { robinhoodMainnet } from '@/lib/chains';
import { walletNetworkStatus } from '@/lib/wallet-network';
import { walletErrorMessage } from '@/lib/wallet-errors';
import {TokenBalance} from './TokenBalance';

export function WalletControls() {
  const walletTitleId=useId();
  const { address, chainId, isConnected, isConnecting, isReconnecting } = useConnection();
  const connectors = useConnectors();
  const connection = useConnect();
  const disconnection = useDisconnect();
  const switching = useSwitchChain();
  const dialog = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [open,setOpen]=useState(false);
  function openDialog(){setOpen(true);dialog.current?.showModal();}
  const busy = connection.isPending || switching.isPending || disconnection.isPending || discovering || isConnecting || isReconnecting;
  const connected = mounted && isConnected;
  const networkStatus = walletNetworkStatus(connected, chainId);
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
  useEffect(() => { setMounted(true); }, []);
  // Clear stale request errors when the wallet account or network changes externally.
  useEffect(() => { setError(null); }, [address, chainId]);

  async function connectWallet(connector: Connector) {
    setError(null);
    setDiscovering(true);
    try {
      if (!await connector.getProvider()) {
        setError('PROVIDER UNAVAILABLE — Install or unlock MetaMask, or open this page inside an injected wallet browser.');
        return;
      }
      // Connection never requests a network change; transaction flows enforce their own chain.
      await connection.mutateAsync({ connector });
    } catch (cause) { setError(walletErrorMessage(cause)); }
    finally { setDiscovering(false); }
  }

  async function switchNetwork() {
    setError(null);
    try { await switching.mutateAsync({ chainId: robinhoodMainnet.id }); }
    catch (cause) { setError(walletErrorMessage(cause)); }
  }

  async function disconnectWallet() {
    setError(null);
    try { await disconnection.mutateAsync(); }
    catch (cause) { setError(walletErrorMessage(cause)); }
  }

  const buttonLabel = !mounted ? 'CONNECT WALLET'
    : isReconnecting ? 'RECONNECTING...'
    : switching.isPending ? 'SWITCHING...'
    : connection.isPending || discovering || isConnecting ? 'CONNECTING...'
    : disconnection.isPending ? 'DISCONNECTING...'
    : connected ? shortAddress : error ? 'RETRY WALLET' : 'CONNECT WALLET';

  // EIP-6963 discovered wallets have distinct provider identities. The generic injected
  // connector remains a fallback for legacy providers and MetaMask's in-app browser.
  const discovered = connectors.filter(connector => connector.id !== 'injected');
  const available = discovered.length ? discovered : connectors;
  return <>
    <div className="header-actions flex items-center">
      <button className="network" onClick={openDialog} aria-label="View wallet network status">
        <i className={connected ? undefined : 'network-idle'} />
        {connected ? networkStatus.label.toUpperCase() : 'NETWORK NOT CONNECTED'} <span>⌄</span>
      </button>
      <button className="wallet" disabled={mounted && busy} aria-busy={mounted && busy} onClick={openDialog}>{buttonLabel} <span>↗</span></button>
    </div>
    <dialog ref={dialog} aria-labelledby={walletTitleId} onClose={()=>setOpen(false)} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div><p className="eyebrow">// AME WEB3 CORE</p><h2 id={walletTitleId}>{connected ? 'WALLET / CONNECTED' : 'WALLET / CONNECT'}</h2>
        <p className="wallet-detail">{connected ? address : 'Connect an injected wallet. MetaMask is supported on desktop and in its mobile browser.'}</p>
        <p>Connected network: {networkStatus.label}<br />AME network: {robinhoodMainnet.name} · {robinhoodMainnet.id}</p>
        {open&&connected&&address&&<TokenBalance wallet={address} chainId={chainId}/>}
        <p className="wallet-notice" role="status" aria-live="polite">{busy ? switching.isPending ? 'SWITCHING NETWORK — Check your wallet.' : isReconnecting ? 'RESTORING CONNECTION...' : disconnection.isPending ? 'DISCONNECTING...' : 'CONNECTING — Check your wallet.' : error || (connected ? 'Connection active. No signature or transaction requested.' : 'No signature or transaction is required to connect.')}</p>
        <div className="wallet-controls">
          {!connected && available.map(connector => <button className="wallet" key={connector.uid} disabled={busy} onClick={() => void connectWallet(connector)}>{connector.id === 'injected' ? 'CONNECT INJECTED WALLET' : `CONNECT ${connector.name.toUpperCase()}`}</button>)}
          {networkStatus.canSwitchToMainnet && <button className="wallet" disabled={busy} onClick={() => void switchNetwork()}>SWITCH TO {robinhoodMainnet.name.toUpperCase()}</button>}
          {connected && <button className="wallet" disabled={busy} onClick={() => void disconnectWallet()}>DISCONNECT WALLET</button>}
          <button className="wallet" onClick={() => dialog.current?.close()}>CLOSE <span>×</span></button>
        </div>
      </div>
    </dialog>
  </>;
}
