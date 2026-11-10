import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../../contracts/', import.meta.url);
const artifact = JSON.parse(await readFile(new URL('artifacts/contracts/AMELending.sol/AMELending.json', root), 'utf8'));
await writeFile(new URL('../lib/generated/lending.ts', import.meta.url), `// Generated from AMELending artifact; no deployment addresses.\nexport const lendingABI = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`);
if (process.argv.includes('--local')) {
  const manifest = JSON.parse(await readFile(new URL('deployments/lending-localhost.json', root), 'utf8'));
  if (manifest.chainId !== 31337 || manifest.status !== 'local-tested') throw new Error('Confirmed local smoke manifest required');
  const file = new URL('../.env.development.local', import.meta.url);
  const existing = await readFile(file, 'utf8');
  if (!existing.startsWith('# Generated local development configuration.')) throw new Error('Refusing user-managed environment overwrite');
  const retained = existing.split(/\r?\n/).filter(line => line && !line.startsWith('NEXT_PUBLIC_AME_LENDING_'));
  retained.push(`NEXT_PUBLIC_AME_LENDING_ADDRESS=${manifest.contracts.market.address}`, `NEXT_PUBLIC_AME_LENDING_DEPLOYMENT_BLOCK=${manifest.contracts.market.blockNumber}`);
  await writeFile(file, retained.join('\n') + '\n');
}
console.log('Synced lending ABI; local addresses are written only with --local. Existing identity ABI and public environment untouched.');
