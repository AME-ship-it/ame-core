import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import type { Chain } from 'viem';
import { developmentChain, robinhoodMainnet, robinhoodTestnet } from './chains.ts';

export function createWeb3Config() {
  // Wallet defaults are independent of the chain that hosts the identity contracts.
  const chains: [Chain, ...Chain[]] = [robinhoodMainnet, robinhoodTestnet];
  if (!chains.some(chain => chain.id === developmentChain.id)) chains.push(developmentChain);
  return createConfig({
    chains,
    connectors: [injected({ shimDisconnect: true })],
    multiInjectedProviderDiscovery: true,
    ssr: true,
    transports: Object.fromEntries(chains.map(chain => [chain.id, http(chain.rpcUrls.default.http[0])])),
  });
}
