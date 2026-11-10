import assert from 'node:assert/strict';
import { it } from 'node:test';
import hre from 'hardhat';
import { encodeDeployData, encodeFunctionData, decodeFunctionData } from 'viem';
import { assertManifest, deploymentRecord } from '../scripts/testnet-manifest.ts';

const address = '0x1111111111111111111111111111111111111111';
const hash = `0x${'11'.repeat(32)}`;

it('testnet deployment constructors match the compiled artifacts', async () => {
  const agent = await hre.artifacts.readArtifact('AMEAgent');
  const receipt = await hre.artifacts.readArtifact('AMEReceipt');
  assert.equal(agent.abi.find(item => item.type === 'constructor')?.inputs.length, 0);
  const constructor = receipt.abi.find(item => item.type === 'constructor');
  assert.equal(constructor?.inputs.length, 1);
  assert.equal(constructor?.inputs[0].type, 'address');
  assert.ok(encodeDeployData({ abi: agent.abi, bytecode: agent.bytecode }).startsWith(agent.bytecode));
  assert.ok(encodeDeployData({ abi: receipt.abi, bytecode: receipt.bytecode, args: [address] }).startsWith(receipt.bytecode));
});

it('mint calldata can be constructed and decoded with the compiled AMEAgent ABI', async () => {
  const artifact = await hre.artifacts.readArtifact('AMEAgent');
  const data = encodeFunctionData({ abi: artifact.abi, functionName: 'mint', args: [address, 'ipfs://testnet-metadata'] });
  const decoded = decodeFunctionData({ abi: artifact.abi, data });
  assert.equal(decoded.functionName, 'mint');
  assert.deepEqual(decoded.args, [address, 'ipfs://testnet-metadata']);
});

it('structured manifests require the actual testnet identity and both confirmed contracts', () => {
  const record = deploymentRecord(address, hash, 10n, '0x6000');
  const manifest = { schemaVersion: 1, status: 'deployed', network: 'robinhood-testnet', chainId: 46630, deployer: address, contracts: { AMEAgent: record, AMEReceipt: record } };
  assert.doesNotThrow(() => assertManifest(manifest));
  assert.throws(() => assertManifest({ ...manifest, chainId: 31337 }));
  assert.throws(() => assertManifest({ ...manifest, contracts: { AMEAgent: record } }));
  assert.throws(() => assertManifest({ ...manifest, contracts: { AMEAgent: { ...record, transactionHash: 'pending' } } }));
});

it('no receipt/code evidence is fabricated from empty or unconfirmed values', () => {
  assert.throws(() => deploymentRecord(address, hash, 0n, '0x6000'));
  assert.throws(() => deploymentRecord(address, hash, 10n, '0x'));
  assert.throws(() => deploymentRecord(address, 'not-confirmed', 10n, '0x6000'));
});
