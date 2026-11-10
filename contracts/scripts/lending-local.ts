import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import hre from 'hardhat';
import { getAddress, keccak256, maxUint256 } from 'viem';

const connection = await hre.network.create('localhost');
const { viem } = connection;
const client = await viem.getPublicClient();
assert.equal(await client.getChainId(), 31337, 'Local Hardhat only');
const [borrower, payer] = await viem.getWalletClients();
const identityManifest = JSON.parse(await readFile(new URL('../deployments/localhost.json', import.meta.url), 'utf8'));
const agent = await viem.getContractAt('AMEAgent', identityManifest.contracts.AMEAgent.address);
assert.equal(getAddress(await agent.read.ownerOf([1n])), getAddress(borrower.account.address), 'Existing local agent 1 must belong to test borrower');
const txs: Record<string, string> = {};
const records: Record<string, { address: string; blockNumber: string; transactionHash: string; runtimeCodeHash: string }> = {};
async function record(name: string, hash: `0x${string}`, address: `0x${string}`) {
  const receipt = await client.waitForTransactionReceipt({ hash }); assert.equal(receipt.status, 'success');
  const code = await client.getCode({ address }); assert.ok(code && code !== '0x');
  records[name] = { address, blockNumber: String(receipt.blockNumber), transactionHash: hash, runtimeCodeHash: keccak256(code) };
}
const loanTx = await viem.sendDeploymentTransaction('AMETestToken', ['AME TEST USD', 'tUSD', 6]);
await record('loanToken', loanTx.deploymentTransaction.hash, loanTx.contract.address); const loan = loanTx.contract;
const colTx = await viem.sendDeploymentTransaction('AMETestToken', ['AME TEST COLLATERAL', 'tCOL', 18]);
await record('collateralToken', colTx.deploymentTransaction.hash, colTx.contract.address); const collateral = colTx.contract;
const oracleTx = await viem.sendDeploymentTransaction('AMETestOracle', [borrower.account.address]);
await record('oracle', oracleTx.deploymentTransaction.hash, oracleTx.contract.address); const oracle = oracleTx.contract;
const marketTx = await viem.sendDeploymentTransaction('AMELending', [loan.address, collateral.address, agent.address, oracle.address, borrower.account.address]);
await record('market', marketTx.deploymentTransaction.hash, marketTx.contract.address); const market = marketTx.contract;
const U = 10n ** 6n, C = 10n ** 18n;
for (const wallet of [borrower, payer]) { await loan.write.mint([wallet.account.address, 5000n * U]); await loan.write.approve([market.address, maxUint256], { account: wallet.account }); }
await collateral.write.mint([borrower.account.address, 1000n * C]); await collateral.write.approve([market.address, maxUint256]);
const now = (await client.getBlock()).timestamp;
await oracle.write.setPrice([loan.address, 10n ** 18n, now]); await oracle.write.setPrice([collateral.address, 2n * 10n ** 18n, now]);
await market.write.setBorrowingPaused([false]);
txs.supply = await market.write.deposit([1000n * U, borrower.account.address]);
txs.open = await market.write.openPosition([1n]);
txs.collateral = await market.write.addCollateral([1n, 100n * C]);
txs.borrow = await market.write.borrow([1n, 50n * U]);
txs.repay = await market.write.repay([1n, 100n * U], { account: payer.account });
assert.equal(await market.read.debtOf([1n]), 0n);
txs.release = await market.write.removeCollateral([1n, 100n * C]);
const shares = await market.read.balanceOf([borrower.account.address]);
txs.withdraw = await market.write.redeem([shares, borrower.account.address, borrower.account.address]);
assert.equal(await market.read.totalPrincipal(), 0n); assert.equal(await market.read.totalCollateral(), 0n);
for (const hash of Object.values(txs)) assert.equal((await client.waitForTransactionReceipt({ hash: hash as `0x${string}` })).status, 'success');
const manifest = { schemaVersion: 1, status: 'local-tested', chainId: 31337, testAssetsOnly: true, mockPrices: true, agentRegistry: agent.address, contracts: records, smoke: { status: 'passed', positionId: '1', transactionHashes: txs }, limitations: 'Ephemeral local state. Mock USD=1, collateral=2; not market prices. Oracle expires after one hour. No public deployment.' };
await writeFile(new URL('../deployments/lending-localhost.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2)); await connection.close();
