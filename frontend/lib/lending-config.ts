import { getAddress, isAddress, zeroAddress, type Address } from 'viem';
export function resolveLendingConfiguration(chainId: number, address?: string, block?: string): { address?: Address; deploymentBlock?: bigint; issue: string | null } {
  const localAllowed = process.env.NODE_ENV !== 'production' && chainId === 31337;
  if (!localAllowed && chainId !== 46630) return { issue: 'LENDING UNAVAILABLE — AME Lending supports local/testnet only. Mainnet lending is disabled.' };
  if (!address) return { issue: 'LENDING UNAVAILABLE — No lending market is deployed/configured for this network.' };
  if (!isAddress(address) || address.toLowerCase() === zeroAddress || !block || !/^[1-9]\d*$/.test(block) || BigInt(block) > BigInt(Number.MAX_SAFE_INTEGER)) return { issue: 'LENDING UNAVAILABLE — Invalid market address or deployment block.' };
  return { address: getAddress(address), deploymentBlock: BigInt(block), issue: null };
}
export function positiveId(input: string): bigint {
  if (!/^[1-9]\d{0,77}$/.test(input) || BigInt(input) >= 1n << 256n) throw new Error('Enter a positive decimal ID.');
  return BigInt(input);
}


