import {parseAbi} from 'viem';
export const testFaucetABI = parseAbi([
  'function claim()',
  'function claimAmount() view returns (uint256)',
  'function nextClaimAt(address) view returns (uint256)',
]);
export const testOracleABI = parseAbi([
  'function refresh()',
  'function updatedAt() view returns (uint256)',
]);
