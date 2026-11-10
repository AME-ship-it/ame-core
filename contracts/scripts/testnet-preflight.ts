import { mkdir, writeFile } from 'node:fs/promises';
import { createPublicClient, defineChain, http } from 'viem';

const rpc = process.env.AME_TESTNET_RPC_URL || 'https://rpc.testnet.chain.robinhood.com';
const url = new URL(rpc);
if (url.protocol !== 'https:') throw new Error('Testnet RPC must use HTTPS');
const chain = defineChain({ id: 46630, name: 'Robinhood Chain Testnet', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpc] } }, testnet: true });
const client = createPublicClient({ chain, transport: http(rpc, { retryCount: 0, timeout: 15_000 }) });
const [chainId, blockNumber, gasPrice] = await Promise.all([client.getChainId(), client.getBlockNumber(), client.getGasPrice()]);
if (chainId !== 46630) throw new Error('Wrong testnet RPC chain');
const signerAvailable = !!process.env.AME_TESTNET_PRIVATE_KEY?.trim();
const status = {
  schemaVersion: 1, status: signerAvailable ? 'signer configured; deployment not attempted by preflight' : 'BLOCKED: signer unavailable',
  network: 'robinhood-testnet', chainId, rpcOrigin: url.origin, rpcConnected: true,
  latestBlock: String(blockNumber), gasPriceWei: String(gasPrice), signerAvailable,
  deploymentExecutedByThisCheck: false,
  metaMaskQA: 'NOT VERIFIED',
};
await mkdir(new URL('../deployments/', import.meta.url), { recursive: true });
await writeFile(new URL('../deployments/robinhood-testnet.status.json', import.meta.url), `${JSON.stringify(status, null, 2)}\n`);
console.log(JSON.stringify(status, null, 2));
