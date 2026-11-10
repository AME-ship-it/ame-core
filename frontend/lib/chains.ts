import { defineChain } from 'viem';
import { resolveNetwork, validateRPC } from './environment.ts';

export const network = resolveNetwork(process.env.NEXT_PUBLIC_AME_NETWORK, process.env.NODE_ENV === 'production');

const localChain = process.env.NODE_ENV !== 'production' ? defineChain({
  id: 31337, name: 'AME Local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [validateRPC(process.env.NEXT_PUBLIC_LOCAL_RPC_URL || 'http://127.0.0.1:8545', false)] } },
  testnet: true,
}) : undefined;

// Official network metadata: https://docs.robinhood.com/chain/connecting/
export const robinhoodTestnet = defineChain({
  id: 46630,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [validateRPC(process.env.NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL || 'https://rpc.testnet.chain.robinhood.com', true)] } },
  blockExplorers: { default: { name: 'Robinhood Testnet Explorer', url: 'https://explorer.testnet.chain.robinhood.com' } },
  testnet: true,
});

export const robinhoodMainnet = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [validateRPC(process.env.NEXT_PUBLIC_ROBINHOOD_MAINNET_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com', true)] } },
  blockExplorers: { default: { name: 'Robinhood Explorer', url: 'https://robinhoodchain.blockscout.com' } },
});

export const developmentChain = network === 'localhost' && localChain ? localChain : network === 'mainnet' ? robinhoodMainnet : robinhoodTestnet;
