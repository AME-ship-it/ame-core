import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { isAddress, zeroAddress } from 'viem';

// Load public env into the child environment, not --env-file / NODE_OPTIONS.
// Next build workers reject --env-file when forwarding parent process flags.
const values = parseEnv(await readFile(new URL('../.env.vercel-preview', import.meta.url), 'utf8'));
const allowed = [
  'NEXT_PUBLIC_AME_NETWORK', 'NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL',
  'NEXT_PUBLIC_AME_AGENT_ADDRESS', 'NEXT_PUBLIC_AME_AGENT_DEPLOYMENT_BLOCK',
  'NEXT_PUBLIC_AME_RECEIPT_ADDRESS', 'NEXT_PUBLIC_AME_RECEIPT_DEPLOYMENT_BLOCK',
  'NEXT_PUBLIC_AME_LENDING_ADDRESS', 'NEXT_PUBLIC_AME_LENDING_DEPLOYMENT_BLOCK',
  'NEXT_PUBLIC_AME_TEST_FAUCET',
];
if (Object.keys(values).some(key => !allowed.includes(key))) throw new Error('Preview env must contain only the expected public configuration values');
if (values.NEXT_PUBLIC_AME_NETWORK !== 'testnet') throw new Error('Testnet production build requires testnet configuration');
for (const name of ['AGENT', 'RECEIPT']) {
  const address = values[`NEXT_PUBLIC_AME_${name}_ADDRESS`];
  if (!address || !isAddress(address) || address.toLowerCase() === zeroAddress || !/^[1-9]\d*$/.test(values[`NEXT_PUBLIC_AME_${name}_DEPLOYMENT_BLOCK`] || '')) throw new Error('Confirmed testnet deployment values are required');
}
if (values.NEXT_PUBLIC_AME_LENDING_ADDRESS || values.NEXT_PUBLIC_AME_LENDING_DEPLOYMENT_BLOCK) {
  const address = values.NEXT_PUBLIC_AME_LENDING_ADDRESS;
  if (!address || !isAddress(address) || address.toLowerCase() === zeroAddress || !/^[1-9]\d*$/.test(values.NEXT_PUBLIC_AME_LENDING_DEPLOYMENT_BLOCK || '')) throw new Error('A real lending address and deployment block are required together');
}
const child = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url)), 'build', '--webpack'], {
  stdio: 'inherit', cwd: fileURLToPath(new URL('../', import.meta.url)), env: { ...process.env, ...values },
});
child.on('error', () => { console.error('Unable to start testnet production build'); process.exitCode = 1; });
child.on('close', code => { process.exitCode = code ?? 1; });


