import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import hre from 'hardhat';
import { getAddress, keccak256, encodeDeployData } from 'viem';
import { assertManifest, deploymentRecord, type TestnetManifest, type DeploymentRecord } from './testnet-manifest.ts';

// Never print signer errors/objects: they may contain raw request/transaction data.
async function deploy() {
  if (!process.env.AME_TESTNET_PRIVATE_KEY?.trim()) throw new Error('signer unavailable');
  if (!/^0x[\da-f]{64}$/i.test(process.env.AME_TESTNET_PRIVATE_KEY.trim())) throw new Error('signer format invalid');
  const directory = new URL('../deployments/', import.meta.url);
  await mkdir(directory, { recursive: true });
  const file = new URL('robinhood-testnet.json', directory);
  const pendingFile = new URL('robinhood-testnet.pending.json', directory);
  const { viem } = await hre.network.create('robinhoodTestnet');
  const client = await viem.getPublicClient();
  assert.equal(await client.getChainId(), 46630, 'wrong chain');
  const [wallet] = await viem.getWalletClients();
  assert.ok(wallet, 'signer unavailable');
  const deployer = getAddress(wallet.account.address);
  let manifest: TestnetManifest = { schemaVersion: 1, status: 'partial', network: 'robinhood-testnet', chainId: 46630, deployer, contracts: {} };
  try { const saved = JSON.parse(await readFile(file, 'utf8')); assertManifest(saved); manifest = saved; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('existing manifest invalid'); }
  assert.equal(manifest.deployer, deployer, 'existing deployment belongs to another signer');
  async function save() {
    assertManifest(manifest);
    const temporary = new URL('robinhood-testnet.json.tmp', directory);
    await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`);
    await rename(temporary, file);
  }
  async function verify(record: DeploymentRecord) {
    const receipt = await client.getTransactionReceipt({ hash: record.transactionHash });
    assert.equal(receipt.status, 'success'); assert.equal(receipt.contractAddress && getAddress(receipt.contractAddress), getAddress(record.address));
    assert.equal(String(receipt.blockNumber), record.blockNumber); assert.equal(getAddress(receipt.from), deployer);
    const code = await client.getCode({ address: record.address });
    assert.ok(code && code !== '0x'); assert.equal(keccak256(code), record.runtimeCodeHash);
  }
  // Persist tx hashes immediately. If confirmation failed previously, resume that hash,
  // never broadcast an untracked duplicate deployment.
  let pending: { name: 'AMEAgent' | 'AMEReceipt'; hash: `0x${string}`; deployer: string } | null = null;
  try { pending = JSON.parse(await readFile(pendingFile, 'utf8')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('pending deployment record invalid'); }
  if (pending && (pending.deployer !== deployer || !['AMEAgent', 'AMEReceipt'].includes(pending.name) || !/^0x[\da-f]{64}$/i.test(pending.hash))) throw new Error('pending deployment record invalid');
  for (const name of ['AMEAgent', 'AMEReceipt'] as const) {
    if (manifest.contracts[name]) {
      await verify(manifest.contracts[name]!);
      if (pending?.name === name) {
        assert.equal(pending.hash, manifest.contracts[name]!.transactionHash, 'pending hash mismatch');
        pending = null; await writeFile(pendingFile, 'null\n');
      }
      continue;
    }
    const artifact = await hre.artifacts.readArtifact(name);
    const args = name === 'AMEReceipt' ? [manifest.contracts.AMEAgent!.address] as const : [] as const;
    const data = encodeDeployData({ abi: artifact.abi, bytecode: artifact.bytecode, args });
    let hash: `0x${string}`;
    if (pending) {
      assert.equal(pending.name, name, 'pending contract order mismatch'); hash = pending.hash;
    } else {
      const gas = await client.estimateGas({ account: wallet.account, data });
      const price = await client.getGasPrice();
      assert.ok(await client.getBalance({ address: deployer }) > gas * price * 2n, 'insufficient testnet gas balance');
      hash = await wallet.sendTransaction({ data, gas: gas * 12n / 10n });
      pending = { name, hash, deployer };
      await writeFile(pendingFile, `${JSON.stringify(pending, null, 2)}\n`);
    }
    console.log(`${name}: submitted ${hash}`);
    const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 2, timeout: 180_000 });
    assert.equal(receipt.status, 'success'); assert.ok(receipt.contractAddress);
    const code = await client.getCode({ address: receipt.contractAddress }); assert.ok(code && code !== '0x');
    manifest.contracts[name] = deploymentRecord(receipt.contractAddress, hash, receipt.blockNumber, code);
    await verify(manifest.contracts[name]!); await save();
    // Preserve only public evidence; the next run ignores completed pending entries.
    pending = null;
    await writeFile(pendingFile, 'null\n');
  }
  const agent = await viem.getContractAt('AMEAgent', manifest.contracts.AMEAgent!.address);
  const receipt = await viem.getContractAt('AMEReceipt', manifest.contracts.AMEReceipt!.address);
  assert.equal(await receipt.read.agentRegistry(), getAddress(agent.address));
  assert.equal(await agent.read.name(), 'AME Agent');
  manifest.status = 'deployed'; await save();
  console.log(JSON.stringify(manifest, null, 2));
}
deploy().catch(() => { console.error('TESTNET DEPLOY NOT COMPLETE. Check signer availability, funding, RPC and saved public transaction records. No private signer data is logged.'); process.exitCode = 1; });
