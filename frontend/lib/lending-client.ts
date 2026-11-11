import { createPublicClient, http } from 'viem';
import { developmentChain } from './chains.ts';
export const agentClient = createPublicClient({ chain: developmentChain, transport: http(undefined, { retryCount: 0, timeout: 10_000 }) });
