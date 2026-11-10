import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import hre from 'hardhat';
import { getAddress, keccak256 } from 'viem';

// Deliberately separate from the established identity deployment scripts.
// This script is PREPARED, not approved for execution by the local implementation task.
if (process.env.AME_LENDING_TESTNET_APPROVED !== 'YES_TEST_ASSETS_ONLY') throw new Error('BLOCKED: explicit approval of this reviewed test implementation is required; no transactions sent.');
if (!process.env.AME_TESTNET_PRIVATE_KEY) throw new Error('BLOCKED: dedicated funded testnet signer required; never export it to frontend.');
const previous = new URL('../deployments/lending-robinhood-testnet.json', import.meta.url);
try { await readFile(previous); throw new Error('An existing lending deployment manifest exists. Inspect/resume manually; refusing duplicate deployment.'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
const identity = JSON.parse(await readFile(new URL('../deployments/robinhood-testnet.json', import.meta.url), 'utf8'));
assert.equal(identity.status, 'deployed'); assert.equal(identity.chainId, 46630);
const connection = await hre.network.create('robinhoodTestnet'); const { viem } = connection;
const client = await viem.getPublicClient(); assert.equal(await client.getChainId(), 46630);
const [signer] = await viem.getWalletClients(); assert.ok(signer?.account);
const agentAddress = getAddress(identity.contracts.AMEAgent.address);
const code = await client.getCode({ address: agentAddress }); assert.ok(code && code !== '0x');
assert.equal(keccak256(code), identity.contracts.AMEAgent.runtimeCodeHash);
const records: Record<string, unknown> = {};
const journal = new URL('../deployments/lending-testnet-journal.json', import.meta.url);
try { await readFile(journal); throw new Error('Deployment journal exists. Resolve recorded transactions manually before retrying; refusing duplicate deployments.'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
async function checkpoint(name: string, hash: `0x${string}`, address: `0x${string}`) {
  records[name] = { address, transactionHash: hash, state: 'submitted' };
  await writeFile(journal, JSON.stringify({ chainId: 46630, testAssetsOnly: true, contracts: records }, null, 2));
  const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 2 }); assert.equal(receipt.status, 'success');
  const runtime = await client.getCode({ address }); assert.ok(runtime && runtime !== '0x');
  records[name] = { address, transactionHash: hash, blockNumber: String(receipt.blockNumber), runtimeCodeHash: keccak256(runtime), state: 'confirmed' };
  await writeFile(journal, JSON.stringify({ chainId: 46630, testAssetsOnly: true, contracts: records }, null, 2));
}
const loan = await viem.sendDeploymentTransaction('AMETestToken', ['AME TEST USD - NO VALUE', 'tUSD', 6]); await checkpoint('loanToken', loan.deploymentTransaction.hash, loan.contract.address);
const collateral = await viem.sendDeploymentTransaction('AMETestToken', ['AME TEST COLLATERAL - NO VALUE', 'tCOL', 18]); await checkpoint('collateralToken', collateral.deploymentTransaction.hash, collateral.contract.address);
const oracle = await viem.sendDeploymentTransaction('AMETestOracle', [signer.account.address]); await checkpoint('oracle', oracle.deploymentTransaction.hash, oracle.contract.address);
// No mock price is silently installed on testnet. Explicit operator quotes and freshness are required.
const market = await viem.sendDeploymentTransaction('AMELending', [loan.contract.address, collateral.contract.address, agentAddress, oracle.contract.address, signer.account.address]); await checkpoint('market', market.deploymentTransaction.hash, market.contract.address);
assert.equal(await market.contract.read.borrowingPaused(), true);
assert.equal(await market.contract.read.agentRegistry(), agentAddress);
await writeFile(previous, JSON.stringify({ schemaVersion: 1, status: 'deployed-paused-test-only', chainId: 46630, testAssetsOnly: true, mockPrices: true, agentRegistry: agentAddress, contracts: records, borrowingPaused: true }, null, 2) + '\n');
console.log('Test-only deployment confirmed, borrowing remains paused. No real-value lending or public sample loan created.'); await connection.close();
