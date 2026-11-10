import { readFile, mkdir, writeFile } from 'node:fs/promises';
const root = new URL('../../contracts/', import.meta.url);
const deployment = JSON.parse(await readFile(new URL('deployments/localhost.json', root), 'utf8'));
const artifact = JSON.parse(await readFile(new URL('artifacts/contracts/AMEAgent.sol/AMEAgent.json', root), 'utf8'));
if (deployment.chainId !== 31337) throw new Error('Expected a localhost deployment');
await mkdir(new URL('../lib/generated/', import.meta.url), { recursive: true });
await writeFile(new URL('../lib/generated/agent.ts', import.meta.url),
  `// Generated ABI/runtime bytecode only. No deployment addresses.\nexport const agentABI = ${JSON.stringify(artifact.abi, null, 2)} as const;\nexport const agentRuntimeBytecode = '${artifact.deployedBytecode}' as const;\n`);
const localEnv = new URL('../.env.development.local', import.meta.url);
let existing = '';
try { existing = await readFile(localEnv, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (existing && !existing.startsWith('# Generated local development configuration.')) throw new Error('Refusing to overwrite a user-managed .env.development.local');
await writeFile(localEnv, `# Generated local development configuration. Never used in production.\nNEXT_PUBLIC_AME_NETWORK=localhost\nNEXT_PUBLIC_LOCAL_RPC_URL=http://127.0.0.1:8545\nNEXT_PUBLIC_AME_AGENT_ADDRESS=${deployment.contracts.AMEAgent.address}\nNEXT_PUBLIC_AME_AGENT_DEPLOYMENT_BLOCK=${deployment.contracts.AMEAgent.blockNumber}\nNEXT_PUBLIC_AME_RECEIPT_ADDRESS=${deployment.contracts.AMEReceipt.address}\nNEXT_PUBLIC_AME_RECEIPT_DEPLOYMENT_BLOCK=${deployment.contracts.AMEReceipt.blockNumber}\n`);
console.log('Synced ABI/bytecode and development-only env. No local deployment file is imported at runtime.');
