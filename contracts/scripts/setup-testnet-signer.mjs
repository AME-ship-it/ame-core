import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, defineChain, http, formatEther } from 'viem';

// Private material stays in memory and the contracts project's ignored .env only.
// Never print caught error objects, parsed env, requests, accounts or private keys.
async function setup() {
  const envFile = new URL('../.env', import.meta.url);
  const ignoreFile = new URL('../.gitignore', import.meta.url);
  let ignore = await readFile(ignoreFile, 'utf8');
  // An explicit final rule protects .env even if previous rules change later.
  if (ignore.trim().split(/\r?\n/).at(-1) !== '.env') {
    ignore = `${ignore.trimEnd()}\n.env\n`;
    await writeFile(ignoreFile, ignore);
  }
  if (ignore.trim().split(/\r?\n/).at(-1) !== '.env') throw new Error('ignore protection unavailable');

  let original = '';
  let exists = true;
  try { original = await readFile(envFile, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') exists = false; else throw new Error('cannot read signer environment'); }
  const fileEnv = parseEnv(original);
  const names = ['AME_TESTNET_PRIVATE_KEY', 'DEPLOYER_PRIVATE_KEY', 'PRIVATE_KEY'];
  let key;
  for (const name of names) {
    const candidate = (process.env[name] || fileEnv[name] || '').trim();
    if (!candidate) continue;
    const normalized = candidate.startsWith('0x') ? candidate : `0x${candidate}`;
    if (!/^0x[\da-f]{64}$/i.test(normalized)) throw new Error('configured signer is not a valid EVM key');
    key = normalized;
    break;
  }
  if (!key) key = generatePrivateKey();
  const account = privateKeyToAccount(key);

  // Canonicalize any existing alias for the deployment command. Preserve other env.
  const assignment = `AME_TESTNET_PRIVATE_KEY=${key}`;
  const pattern = /^\s*(?:export\s+)?AME_TESTNET_PRIVATE_KEY\s*=.*$/gm;
  const content = pattern.test(original)
    ? original.replace(pattern, assignment)
    : `${original.trimEnd()}${original.trim() ? '\n' : ''}${assignment}\n`;
  await writeFile(envFile, content, { flag: exists ? 'w' : 'wx', mode: 0o600 });

  const rpc = process.env.AME_TESTNET_RPC_URL || fileEnv.AME_TESTNET_RPC_URL || 'https://rpc.testnet.chain.robinhood.com';
  if (new URL(rpc).protocol !== 'https:') throw new Error('testnet RPC must use HTTPS');
  const chain = defineChain({ id: 46630, name: 'Robinhood Chain Testnet', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpc] } }, testnet: true });
  const client = createPublicClient({ chain, transport: http(rpc, { retryCount: 2, timeout: 20_000 }) });
  if (await client.getChainId() !== 46630) throw new Error('RPC chain mismatch');
  const balance = await client.getBalance({ address: account.address });
  const publicStatus = {
    schemaVersion: 1,
    status: balance > 0n ? 'FUNDED: ready for public deployment' : 'BLOCKED: needs Robinhood Testnet ETH',
    network: 'robinhood-testnet', chainId: 46630,
    deployer: account.address, balanceWei: String(balance), balanceETH: formatEther(balance),
    signerAvailable: true, envIgnored: true, deploymentExecutedByThisCheck: false,
    metaMaskQA: 'NOT VERIFIED',
  };
  await mkdir(new URL('../deployments/', import.meta.url), { recursive: true });
  await writeFile(new URL('../deployments/robinhood-testnet.status.json', import.meta.url), `${JSON.stringify(publicStatus, null, 2)}\n`);
  // Public address and onchain balance only. No signer metadata or secret values.
  console.log(`DEPLOYER ADDRESS: ${account.address}`);
  console.log(`BALANCE: ${formatEther(balance)} ETH`);
  if (balance === 0n) console.log('ONLY BLOCKER: needs Robinhood Testnet ETH');
}

setup().catch(() => {
  console.error('Signer setup or balance check did not complete. No private key data is logged. Existing .env is preserved for retry.');
  process.exitCode = 1;
});
