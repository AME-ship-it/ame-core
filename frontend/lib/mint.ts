import { isAddress, getAddress, zeroAddress, isAddressEqual, decodeFunctionData, type Address, type Hash, type PublicClient, type TransactionReceipt } from 'viem';
import { developmentChain } from './chains.ts';
import { verifyDeployment, mintedAgentId } from './agents.ts';
import { walletErrorMessage } from './wallet-errors.ts';
import {identityMetadata,type AgentMetadataInput} from './agent-metadata.ts';

export type MintPhase = 'ready' | 'waiting' | 'submitted' | 'pending' | 'confirmed' | 'rejected' | 'reverted' | 'rpc-failure' | 'failed' | 'insufficient-funds' | 'wallet-changed' | 'submission-unknown';
export function mintInputs(owner: Address, optionalWallet: string,metadata?:AgentMetadataInput) {
  if(!isAddress(owner)||isAddressEqual(owner,zeroAddress))throw new Error('INVALID OWNER WALLET');
  const wallet = optionalWallet.trim() || owner;
  if (!isAddress(wallet) || wallet === zeroAddress) throw new Error('INVALID AGENT WALLET — Enter a nonzero EVM address.');
  const agentWallet = getAddress(wallet);
  const metadataURI = identityMetadata(agentWallet,metadata);
  return { agentWallet, metadataURI };
}
export function transactionError(error: unknown): { phase: MintPhase; message: string } {
  if(error instanceof Error&&error.message.startsWith('SUBMISSION UNKNOWN'))return {phase:'submission-unknown',message:'SUBMISSION UNKNOWN — Your wallet may have broadcast a transaction. Recover its hash from wallet activity before another mint.'};
  const wallet = walletErrorMessage(error);
  if (wallet.startsWith('REQUEST REJECTED')) return { phase: 'rejected', message: 'TRANSACTION REJECTED — No mint was submitted.' };
  const seen = new Set<unknown>(); let current = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const value = current as { name?: string; cause?: unknown; message?: string };
    if(/InsufficientFunds/.test(value.name||'')||/insufficient funds/i.test(value.message||''))return {phase:'insufficient-funds',message:'INSUFFICIENT TESTNET GAS — Minting has no contract fee, but requires testnet ETH for gas.'};
    if(/ChainMismatch|AccountNotFound/.test(value.name||'')||/WALLET CHANGED/.test(value.message||''))return {phase:'wallet-changed',message:'WALLET CHANGED — Reconnect the intended owner on the configured network before retrying.'};
    if (/Reverted|ExecutionReverted/.test(value.name || '') || value.message === 'TRANSACTION REVERTED') return { phase: 'reverted', message: 'TRANSACTION REVERTED — No agent was minted by this transaction.' };
    if (/HttpRequest|Timeout|RpcRequest|Socket|TransactionReceiptNotFound/.test(value.name || '')) return { phase: 'rpc-failure', message: 'RPC FAILURE — Check the node connection. If submitted, recheck this transaction; do not mint again.' };
    current = value.cause;
  }
  return { phase: 'failed', message: error instanceof Error && /CONTRACT|NETWORK|WALLET|MINT EVENT|REPLACED|METADATA/.test(error.message) ? error.message : 'UNKNOWN FAILURE — Inspect the wallet and transaction before retrying.' };
}
/** One pending mint per controller. Shared by UI and local integration tests. */
export function createMintController() {
  let locked = false;
  return {
    async submit({ owner, chainId, optionalWallet, metadata, client, write, beforeWrite, onPhase, onHash }: {
      owner: Address; chainId: number; optionalWallet: string; client: PublicClient;
      write: (agentWallet: Address, metadataURI: string) => Promise<Hash>;
      metadata?:AgentMetadataInput;beforeWrite?:()=>void|Promise<void>;
      onPhase: (phase: MintPhase) => void; onHash: (hash: Hash) => void;
    }) {
      if (locked) throw new Error('MINT ALREADY IN PROGRESS');
      locked = true;
      try {
        if (chainId !== developmentChain.id) throw new Error('WRONG NETWORK — Switch to the configured network.');
        const { agentWallet, metadataURI } = mintInputs(owner, optionalWallet,metadata);
        const config = await verifyDeployment(client);
        // Catch deterministic reverts before opening the wallet request.
        await client.simulateContract({ ...config, functionName: 'mint', args: [agentWallet, metadataURI], account: owner });
        await beforeWrite?.();
        onPhase('waiting');
        let hash:Hash;
        try{hash=await write(agentWallet, metadataURI);}
        catch(error){const failure=transactionError(error);if(['rpc-failure','failed'].includes(failure.phase))throw new Error('SUBMISSION UNKNOWN',{cause:error});throw error;}
        onHash(hash); onPhase('submitted'); onPhase('pending');
        return await confirmMint(client, hash, owner, onPhase, onHash,{agentWallet,metadataURI});
      } finally { locked = false; }
    },
  };
}
export async function confirmMint(client: PublicClient, hash: Hash, owner: Address, onPhase: (phase: MintPhase) => void, onHash: (hash: Hash) => void = () => {},expected?:{agentWallet:Address;metadataURI:string}) {
  const config=await verifyDeployment(client);
  let cancelled = false;
  const receipt: TransactionReceipt = await client.waitForTransactionReceipt({
    hash, confirmations: 1, timeout: 120_000, pollingInterval: 1_000,
    onReplaced(replacement) {
      onHash(replacement.transaction.hash);
      if (replacement.reason !== 'repriced') cancelled = true;
    },
  });
  if (cancelled) throw new Error('TRANSACTION REPLACED — Inspect the replacement before minting again.');
  if(receipt.status!=='success')throw new Error('TRANSACTION REVERTED');
  const transaction=await client.getTransaction({hash:receipt.transactionHash});
  if(!transaction.to||!isAddressEqual(transaction.to,config.address)||!isAddressEqual(transaction.from,owner)||transaction.value!==0n)throw new Error('MINT EVENT TRANSACTION TARGET OR OWNER MISMATCH');
  const decoded=decodeFunctionData({abi:config.abi,data:transaction.input});
  if(decoded.functionName!=='mint')throw new Error('MINT EVENT TRANSACTION CALL MISMATCH');
  const actual={agentWallet:decoded.args[0],metadataURI:decoded.args[1]};
  if(expected&&(!isAddressEqual(expected.agentWallet,actual.agentWallet)||expected.metadataURI!==actual.metadataURI))throw new Error('MINT EVENT ARGUMENT MISMATCH');
  const id = mintedAgentId(receipt, owner,actual);
  const currentOwner = await client.readContract({ ...config, functionName: 'ownerOf', args: [id],blockNumber:receipt.blockNumber });
  if (!isAddressEqual(currentOwner, owner)) throw new Error('MINT OWNER MISMATCH');
  onPhase('confirmed');
  return { id, hash: receipt.transactionHash };
}
