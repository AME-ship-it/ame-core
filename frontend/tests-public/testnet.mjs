// Read-only checks against the actual public contracts. No signing or mock provider.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { before, test, after } from 'node:test';
import { encodeDeployData, encodeFunctionData, decodeFunctionData, getAddress, keccak256, formatEther } from 'viem';
import { agentClient, agentContract, readAgent, readOwnedAgentIds, AgentNotFound } from '../lib/agents.ts';
import { contracts, contractsConfigured } from '../lib/contracts.ts';
import { developmentChain } from '../lib/chains.ts';
import { agentABI } from '../lib/generated/agent.ts';

const contractRoot = new URL('../../contracts/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('deployments/robinhood-testnet.json', contractRoot), 'utf8'));
const artifacts = {};
const checks = [];
before(async () => {
  assert.equal(developmentChain.id, 46630); assert.equal(await agentClient.getChainId(), 46630);
  assert.equal(manifest.status, 'deployed'); assert.equal(manifest.chainId, 46630); assert.equal(contractsConfigured, true);
  for (const name of ['AMEAgent', 'AMEReceipt']) artifacts[name] = JSON.parse(await readFile(new URL(`artifacts/contracts/${name}.sol/${name}.json`, contractRoot), 'utf8'));
});

test('both contract deployment receipts, input bytecode/constructors and runtime code match chain 46630', async () => {
  for (const name of ['AMEAgent', 'AMEReceipt']) {
    const record = manifest.contracts[name];
    const [transaction, receipt, code] = await Promise.all([
      agentClient.getTransaction({ hash: record.transactionHash }), agentClient.getTransactionReceipt({ hash: record.transactionHash }), agentClient.getCode({ address: record.address }),
    ]);
    assert.equal(receipt.status, 'success'); assert.equal(getAddress(receipt.contractAddress), getAddress(record.address));
    assert.equal(receipt.blockNumber.toString(), record.blockNumber); assert.equal(getAddress(transaction.from), getAddress(manifest.deployer));
    assert.ok(code && code !== '0x'); assert.equal(keccak256(code), record.runtimeCodeHash);
    const artifact = artifacts[name];
    const args = name === 'AMEReceipt' ? [manifest.contracts.AMEAgent.address] : [];
    assert.equal(transaction.input, encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode, args }));
    checks.push({ contract: name, address: record.address, bytecodeBytes: (code.length - 2) / 2, block: record.blockNumber, transactionHash: record.transactionHash });
  }
});

test('frontend ABI and contract config point to the actual public deployment and its event start blocks', async () => {
  assert.deepEqual(agentABI, artifacts.AMEAgent.abi);
  assert.equal(contracts.agent.address, getAddress(manifest.contracts.AMEAgent.address));
  assert.equal(contracts.agent.deploymentBlock.toString(), manifest.contracts.AMEAgent.blockNumber);
  assert.equal(contracts.receipt.address, getAddress(manifest.contracts.AMEReceipt.address));
  assert.equal(contracts.receipt.deploymentBlock.toString(), manifest.contracts.AMEReceipt.blockNumber);
  assert.equal(await agentClient.readContract({ ...agentContract(), functionName: 'name' }), 'AME Agent');
  const registry = await agentClient.readContract({ address: contracts.receipt.address, abi: artifacts.AMEReceipt.abi, functionName: 'agentRegistry' });
  assert.equal(getAddress(registry), contracts.agent.address);
});

test('mint calldata is constructed using the deployed ABI without submitting an extra public mint', () => {
  const args = [manifest.deployer, 'data:application/json,%7B%22name%22%3A%22AME%20Agent%22%7D'];
  const data = encodeFunctionData({ abi: agentABI, functionName: 'mint', args });
  const decoded = decodeFunctionData({ abi: agentABI, data });
  assert.equal(decoded.functionName, 'mint'); assert.equal(getAddress(decoded.args[0]), getAddress(manifest.deployer)); assert.equal(decoded.args[1], args[1]);
});

test('real public profile reads reject nonexistent IDs cleanly', async () => {
  await assert.rejects(readAgent((1n << 256n) - 1n), AgentNotFound);
});

test('owner discovery uses real public Transfer logs from the confirmed deployment block', async () => {
  const ids = await readOwnedAgentIds(manifest.deployer);
  for (const id of ids) assert.equal((await readAgent(id)).owner, getAddress(manifest.deployer));
  checks.push({ deployerAgentIds: ids.map(String) });
});

after(async () => {
  const balance = await agentClient.getBalance({ address: manifest.deployer });
  const report = { network: 'robinhood-testnet', chainId: 46630, deployer: manifest.deployer, deployerBalanceETH: formatEther(balance), checks, extraPublicMintSubmitted: false, metaMaskQA: 'NOT VERIFIED' };
  await writeFile(new URL('../testnet-verification.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Public deployer balance: ${formatEther(balance)} ETH`);
});
