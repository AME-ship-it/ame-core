export function resolveIdentityNetwork(value: string | undefined, production: boolean, development: string): 'mainnet' | 'testnet' | 'localhost' {
  if (production) return 'mainnet';
  const selected = value?.trim() || development;
  if (!['mainnet', 'testnet', 'localhost'].includes(selected)) throw new Error('Invalid identity network');
  return selected as 'mainnet' | 'testnet' | 'localhost';
}
