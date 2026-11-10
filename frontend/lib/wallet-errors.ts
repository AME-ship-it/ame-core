export function walletErrorMessage(error: unknown): string {
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const value = current as { code?: number; name?: string; cause?: unknown };
    if (value.code === 4001 || value.name === 'UserRejectedRequestError') {
      return 'REQUEST REJECTED — You declined the wallet request. Try again when ready.';
    }
    if (value.code === -32002) return 'REQUEST PENDING — Open your wallet to approve or reject the existing request.';
    if (value.code === 4900 || value.code === 4901) return 'PROVIDER OFFLINE — Unlock your wallet and check its network connection.';
    if (value.name === 'ProviderNotFoundError') return 'PROVIDER UNAVAILABLE — Open AME in a browser with an injected wallet, such as MetaMask.';
    current = value.cause;
  }
  return 'REQUEST FAILED — Check your wallet and connection, then retry.';
}
