import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import type { Chain } from 'viem';
import { developmentChain } from './chains.ts';

export function createWeb3Config() {
  const chain: Chain = developmentChain;
  return createConfig({
    chains: [chain],
    connectors: [injected({ shimDisconnect: true })],
    multiInjectedProviderDiscovery: true,
    ssr: true,
    transports: { [chain.id]: http(chain.rpcUrls.default.http[0]) },
  });
}
