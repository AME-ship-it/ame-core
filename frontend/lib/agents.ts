import { createPublicClient, http, keccak256, parseEventLogs, isAddressEqual, zeroAddress, type PublicClient, type TransactionReceipt, type Address } from 'viem';
import { developmentChain, network } from './chains.ts';
import { contracts, contractConfigurationIssue } from './contracts.ts';
import { agentRuntimeBytecode } from './generated/agent.ts';
import { readLogPages } from './log-ranges.ts';

export const agentClient = createPublicClient({ chain: developmentChain, transport: http(undefined, { retryCount: 0, timeout: 10_000 }) });
export class AgentNotFound extends Error { constructor() { super('AGENT NOT FOUND'); } }
export function parseAgentId(value: string): bigint {
  if (!/^[1-9]\d*$/.test(value) || value.length > 78 || BigInt(value) > (1n << 256n) - 1n) throw new AgentNotFound();
  return BigInt(value);
}
export function agentLabel(id: bigint | string) { return `AME_${String(id).padStart(4, '0')}`; }
export function agentContract() {
  const address = contracts.agent.address;
  if (!address) throw new Error(contractConfigurationIssue || 'CONTRACT NOT CONFIGURED');
  return { address, abi: contracts.agent.abi };
}
export async function verifyDeployment(client: PublicClient = agentClient) {
  const config = agentContract();
  if (await client.getChainId() !== developmentChain.id) throw new Error('RPC WRONG NETWORK');
  const code = await client.getCode({ address: config.address });
  if (!code || code === '0x') throw new Error(network === 'localhost' ? 'CONTRACT UNAVAILABLE — Start the local node and deploy the contracts.' : `CONTRACT UNAVAILABLE — No code found at the configured AMEAgent address on ${developmentChain.name}.`);
  if (keccak256(code) !== keccak256(agentRuntimeBytecode)) throw new Error('CONTRACT BYTECODE MISMATCH — The configured identity registry does not match the reviewed AMEAgent runtime.');
  return config;
}
export function isMissingAgent(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const value = current as { data?: { errorName?: string }; cause?: unknown };
    if (value.data?.errorName === 'ERC721NonexistentToken') return true;
    current = value.cause;
  }
  return error instanceof AgentNotFound;
}
export async function readAgent(id: bigint, client: PublicClient = agentClient) {
  if (id <= 0n || id > (1n << 256n) - 1n) throw new AgentNotFound();
  const config = await verifyDeployment(client);
  const blockNumber = await client.getBlockNumber({ cacheTime: 0 });
  try {
    const [owner, wallet, metadataURI] = await Promise.all([
      client.readContract({ ...config, functionName: 'ownerOf', args: [id], blockNumber }),
      client.readContract({ ...config, functionName: 'agentWalletOf', args: [id], blockNumber }),
      client.readContract({ ...config, functionName: 'tokenURI', args: [id], blockNumber }),
    ]);
    let historyIssue:string|null=null;
    const events = await readLogPages(contracts.agent.deploymentBlock, blockNumber, range => client.getContractEvents({ ...config, eventName: 'AgentMinted', args: { agentId: id }, ...range, strict: true })).catch(()=>{historyIssue='Mint history unavailable; ownership and metadata below are verified contract reads.';return [];});
    const mint = events[0];
    const createdAt = mint ? await client.getBlock({ blockNumber: mint.blockNumber }).then(b=>b.timestamp).catch(()=>null) : null;
    return { id, owner, wallet, metadataURI, createdAt, mintTransaction:mint?.transactionHash??null, historyIssue, status: 'REGISTERED' as const };
  } catch (error) { if (isMissingAgent(error)) throw new AgentNotFound(); throw error; }
}
export async function readOwnedAgentIds(owner: `0x${string}`, client: PublicClient = agentClient) {
  const config = await verifyDeployment(client);
  const blockNumber = await client.getBlockNumber({ cacheTime: 0 });
  const [received, sent] = await Promise.all([
    readLogPages(contracts.agent.deploymentBlock, blockNumber, range => client.getContractEvents({ ...config, eventName: 'Transfer', args: { to: owner }, ...range, strict: true })),
    readLogPages(contracts.agent.deploymentBlock, blockNumber, range => client.getContractEvents({ ...config, eventName: 'Transfer', args: { from: owner }, ...range, strict: true })),
  ]);
  const ids = [...new Set([...received, ...sent].map(event => event.args.tokenId))];
  const ownership = await Promise.all(ids.map(id => client.readContract({ ...config, functionName: 'ownerOf', args: [id], blockNumber })));
  return ids.filter((_, index) => isAddressEqual(ownership[index], owner)).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}
export function mintedAgentId(receipt: TransactionReceipt, owner: Address, expected?:{agentWallet:Address;metadataURI:string}) {
  if (receipt.status !== 'success') throw new Error('TRANSACTION REVERTED');
  const config = agentContract();
  const logs = receipt.logs.filter(log => isAddressEqual(log.address, config.address));
  const events = parseEventLogs({ abi: config.abi, logs, eventName: 'AgentMinted', strict: true });
  const matches=events.filter(event => isAddressEqual(event.args.owner, owner));
  const event=matches[0];
  if (matches.length!==1||!event) throw new Error('MINT EVENT MISSING OR AMBIGUOUS — Inspect the transaction before submitting again.');
  const transfers=parseEventLogs({abi:config.abi,logs,eventName:'Transfer',strict:true});
  if(!transfers.some(t=>t.args.tokenId===event.args.agentId&&isAddressEqual(t.args.from,zeroAddress)&&isAddressEqual(t.args.to,owner)))throw new Error('MINT EVENT MISSING — No matching ERC721 mint Transfer.');
  if(expected&&(!isAddressEqual(event.args.agentWallet,expected.agentWallet)||event.args.metadataURI!==expected.metadataURI))throw new Error('MINT EVENT ARGUMENT MISMATCH');
  return event.args.agentId;
}

