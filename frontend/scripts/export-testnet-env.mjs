import { readFile, writeFile } from 'node:fs/promises';
import { getAddress, isAddress } from 'viem';

const file = new URL('../../contracts/deployments/robinhood-testnet.json', import.meta.url);
let manifest;
try { manifest = JSON.parse(await readFile(file, 'utf8')); }
catch { throw new Error('BLOCKED: no confirmed Robinhood Testnet deployment manifest. No env values were generated.'); }
if (manifest.chainId !== 46630 || manifest.network !== 'robinhood-testnet' || manifest.status !== 'deployed') throw new Error('Expected a completed chain 46630 deployment');
for (const name of ['AMEAgent', 'AMEReceipt']) {
  const record = manifest.contracts[name];
  if (!record || !isAddress(record.address) || !/^[1-9]\d*$/.test(record.blockNumber) || !/^0x[\da-f]{64}$/i.test(record.transactionHash)) throw new Error(`Missing confirmed ${name} deployment evidence`);
}
const values = [
  '# Public values from confirmed Robinhood Testnet deployment. No signer data.',
  'NEXT_PUBLIC_AME_NETWORK=testnet',
  'NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL=https://rpc.testnet.chain.robinhood.com',
  `NEXT_PUBLIC_AME_AGENT_ADDRESS=${getAddress(manifest.contracts.AMEAgent.address)}`,
  `NEXT_PUBLIC_AME_AGENT_DEPLOYMENT_BLOCK=${manifest.contracts.AMEAgent.blockNumber}`,
  `NEXT_PUBLIC_AME_RECEIPT_ADDRESS=${getAddress(manifest.contracts.AMEReceipt.address)}`,
  `NEXT_PUBLIC_AME_RECEIPT_DEPLOYMENT_BLOCK=${manifest.contracts.AMEReceipt.blockNumber}`,
  '',
];
try {
  const lending = JSON.parse(await readFile(new URL('../../contracts/deployments/lending-robinhood-testnet.json',import.meta.url),'utf8'));
  if (lending.chainId !== 46630 || lending.status !== 'deployed-tested-active-test-only' || !lending.testAssetsOnly || getAddress(lending.agentRegistry) !== getAddress(manifest.contracts.AMEAgent.address)) throw new Error('Completed and verified testnet lending manifest required');
  const market=lending.contracts.market;
  if (!isAddress(market.address) || !/^[1-9]\d*$/.test(market.blockNumber) || !market.runtimeCodeHash) throw new Error('Missing lending deployment evidence');
  values.push(`NEXT_PUBLIC_AME_LENDING_ADDRESS=${getAddress(market.address)}`,`NEXT_PUBLIC_AME_LENDING_DEPLOYMENT_BLOCK=${market.blockNumber}`,'NEXT_PUBLIC_AME_TEST_FAUCET=1','');
} catch(error) { if(error.code!=='ENOENT') throw error; }
const env=values.join('\n');
await writeFile(new URL('../.env.vercel-preview', import.meta.url), env);
console.log('Exported confirmed public values to .env.vercel-preview. Signer data is never copied.');
