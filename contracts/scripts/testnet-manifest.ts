import { getAddress, isAddress, keccak256, type Address, type Hash } from 'viem';

export type DeploymentRecord = { address: Address; transactionHash: Hash; blockNumber: string; runtimeCodeHash: Hash };
export type TestnetManifest = {
  schemaVersion: 1; status: 'partial' | 'deployed'; network: 'robinhood-testnet'; chainId: 46630;
  deployer: Address; contracts: { AMEAgent?: DeploymentRecord; AMEReceipt?: DeploymentRecord };
};
export function deploymentRecord(address: string, transactionHash: string, block: bigint, code: `0x${string}`): DeploymentRecord {
  if (!isAddress(address) || !/^0x[\da-f]{64}$/i.test(transactionHash) || code === '0x' || block <= 0n) throw new Error('Invalid confirmed deployment record');
  return { address: getAddress(address), transactionHash: transactionHash as Hash, blockNumber: String(block), runtimeCodeHash: keccak256(code) };
}
export function assertManifest(value: unknown): asserts value is TestnetManifest {
  if (!value || typeof value !== 'object') throw new Error('Invalid deployment manifest');
  const manifest = value as TestnetManifest;
  if (manifest.schemaVersion !== 1 || manifest.network !== 'robinhood-testnet' || manifest.chainId !== 46630 || !isAddress(manifest.deployer) || !['partial', 'deployed'].includes(manifest.status) || !manifest.contracts) throw new Error('Invalid testnet manifest identity');
  for (const record of Object.values(manifest.contracts)) {
    if (!record || !isAddress(record.address) || !/^0x[\da-f]{64}$/i.test(record.transactionHash) || !/^[1-9]\d*$/.test(record.blockNumber) || !/^0x[\da-f]{64}$/i.test(record.runtimeCodeHash)) throw new Error('Invalid testnet deployment record');
  }
  if (manifest.status === 'deployed' && (!manifest.contracts.AMEAgent || !manifest.contracts.AMEReceipt)) throw new Error('Incomplete deployed manifest');
}
