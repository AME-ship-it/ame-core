export type AMENetwork = 'localhost' | 'testnet' | 'mainnet';

export function resolveNetwork(value: string | undefined, production: boolean): AMENetwork {
  const network = value?.trim() || (production ? 'testnet' : 'localhost');
  if (!['localhost', 'testnet', 'mainnet'].includes(network)) throw new Error('NEXT_PUBLIC_AME_NETWORK must be localhost, testnet or mainnet.');
  if (production && network === 'localhost') throw new Error('Localhost is development-only. Use testnet for a production or Vercel build.');
  return network as AMENetwork;
}

export function validateRPC(value: string, publicNetwork: boolean): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('RPC configuration must be an absolute HTTP(S) URL.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('RPC configuration must use HTTP(S).');
  const host = url.hostname.toLowerCase();
  const local = host === 'localhost' || host.endsWith('.localhost') || /^127\./.test(host) || host === '0.0.0.0' || host === '[::1]';
  if (publicNetwork && (url.protocol !== 'https:' || local)) throw new Error('Public-chain RPC configuration must use a remote HTTPS endpoint.');
  return url.toString();
}
