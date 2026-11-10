import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import hre from 'hardhat';
import { getAddress, keccak256, stringToHex } from 'viem';

// Intentionally local-only. No private keys or public deployment networks.
const connection = await hre.network.create('localhost');
const { viem } = connection;
const publicClient = await viem.getPublicClient();
assert.equal(await publicClient.getChainId(), 31337, 'Local Hardhat chain required');
const [owner, wallet] = await viem.getWalletClients();

const agentDeployment = await viem.sendDeploymentTransaction('AMEAgent');
const agentTx = await publicClient.waitForTransactionReceipt({ hash: agentDeployment.deploymentTransaction.hash });
assert.equal(agentTx.status, 'success');
const agent = agentDeployment.contract;
const receiptDeployment = await viem.sendDeploymentTransaction('AMEReceipt', [agent.address]);
const receiptTx = await publicClient.waitForTransactionReceipt({ hash: receiptDeployment.deploymentTransaction.hash });
assert.equal(receiptTx.status, 'success');
const receipt = receiptDeployment.contract;
assert.ok((await publicClient.getCode({ address: agent.address }))?.length);
assert.ok((await publicClient.getCode({ address: receipt.address }))?.length);
assert.equal(await receipt.read.agentRegistry(), getAddress(agent.address));

// Local smoke flow confirms the deployed contracts can actually be used.
const mintHash = await agent.write.mint([wallet.account.address, 'ipfs://ame-local-agent-1']);
await publicClient.waitForTransactionReceipt({ hash: mintHash });
assert.equal(await agent.read.ownerOf([1n]), getAddress(owner.account.address));
assert.equal(await agent.read.agentWalletOf([1n]), getAddress(wallet.account.address));
assert.equal(await agent.read.tokenURI([1n]), 'ipfs://ame-local-agent-1');
const receiptHashes = [];
for (const receiptType of [0, 1, 2, 3]) {
  const hash = await receipt.write.createReceipt([
    1n, receiptType, keccak256(stringToHex(`local-${receiptType}`)), `ipfs://ame-local-receipt-${receiptType}`,
  ], { account: wallet.account });
  const tx = await publicClient.waitForTransactionReceipt({ hash });
  assert.equal(tx.status, 'success');
  assert.equal((await receipt.read.getReceipt([BigInt(receiptType + 1)])).receiptType, receiptType);
  receiptHashes.push(hash);
}
const manifest = {
  network: 'localhost', chainId: 31337,
  rpcUrl: 'http://127.0.0.1:8545',
  persistence: 'Development node only; restarting the node clears this chain. Addresses are not public deployments.',
  deployer: owner.account.address,
  contracts: {
    AMEAgent: { address: agent.address, transactionHash: agentTx.transactionHash, blockNumber: agentTx.blockNumber.toString() },
    AMEReceipt: { address: receipt.address, transactionHash: receiptTx.transactionHash, blockNumber: receiptTx.blockNumber.toString() },
  },
  smokeTest: { status: 'passed', agentId: '1', mintHash, receiptHashes, receiptTypes: ['TASK', 'PAYMENT', 'SWAP', 'ACTION'] },
};
await mkdir(new URL('../deployments/', import.meta.url), { recursive: true });
await writeFile(new URL('../deployments/localhost.json', import.meta.url), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
await connection.close();
