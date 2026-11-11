import { robinhoodMainnet, robinhoodTestnet } from './chains.ts';

export function walletNetworkName(chainId: number | undefined): string {
  if (chainId === 1) return 'Ethereum Mainnet';
  if (chainId === robinhoodMainnet.id) return robinhoodMainnet.name;
  if (chainId === robinhoodTestnet.id) return robinhoodTestnet.name;
  if (chainId === 31337) return 'AME Local';
  return chainId === undefined ? 'Unknown network' : `Unrecognized network`;
}

export function walletNetworkStatus(connected: boolean, chainId?: number) {
  return {
    label: connected ? `${walletNetworkName(chainId)} · ${chainId ?? 'unknown'}` : 'Not connected',
    canSwitchToMainnet: connected && chainId !== robinhoodMainnet.id,
  };
}
