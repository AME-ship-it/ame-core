export type LogRange = { fromBlock: bigint; toBlock: bigint };
// The official Robinhood RPC rejects inclusive windows above 10,000,000 blocks.
export function* logRanges(fromBlock: bigint, toBlock: bigint, pageSize = 10_000_000n): Generator<LogRange> {
  if (pageSize < 1n || fromBlock < 0n || toBlock < fromBlock) throw new Error('Invalid event log window');
  for (let start = fromBlock; start <= toBlock; start += pageSize) {
    const end = start + pageSize - 1n;
    yield { fromBlock: start, toBlock: end < toBlock ? end : toBlock };
  }
}
export async function readLogPages<T>(from: bigint, to: bigint, read: (range: LogRange) => Promise<readonly T[]>): Promise<T[]> {
  const result: T[] = [];
  for (const range of logRanges(from, to)) result.push(...await read(range));
  return result;
}
