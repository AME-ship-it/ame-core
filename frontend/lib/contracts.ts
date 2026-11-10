import { getAddress, isAddress, zeroAddress } from 'viem';
import { developmentChain } from './chains.ts';
import { agentABI } from './generated/agent.ts';

const address = process.env.NEXT_PUBLIC_AME_AGENT_ADDRESS?.trim();
const block = process.env.NEXT_PUBLIC_AME_AGENT_DEPLOYMENT_BLOCK?.trim();
const validAddress = !!address && isAddress(address) && address.toLowerCase() !== zeroAddress;
const validBlock = !!block && /^\d+$/.test(block) && BigInt(block) <= BigInt(Number.MAX_SAFE_INTEGER);

export const contractConfigurationIssue = !address
  ? `CONTRACT NOT CONFIGURED — AMEAgent is not configured for ${developmentChain.name}. Minting and agent reads are unavailable.`
  : !validAddress ? 'CONTRACT CONFIGURATION INVALID — Set a valid nonzero AMEAgent address.'
  : !validBlock ? 'DEPLOYMENT BLOCK NOT CONFIGURED — Set the AMEAgent deployment block for this network.'
  : null;

const receiptAddress = process.env.NEXT_PUBLIC_AME_RECEIPT_ADDRESS?.trim();
const receiptBlock = process.env.NEXT_PUBLIC_AME_RECEIPT_DEPLOYMENT_BLOCK?.trim();
const validReceiptAddress = !!receiptAddress && isAddress(receiptAddress) && receiptAddress.toLowerCase() !== zeroAddress;
const validReceiptBlock = !!receiptBlock && /^\d+$/.test(receiptBlock) && BigInt(receiptBlock) <= BigInt(Number.MAX_SAFE_INTEGER);
export const receiptConfigurationIssue = !validReceiptAddress || !validReceiptBlock
  ? 'RECEIPT CONTRACT NOT CONFIGURED — Set the real AMEReceipt address and deployment block for this network.' : null;
const receiptSettings = {
  address: !receiptConfigurationIssue ? getAddress(receiptAddress!) : undefined,
  block: validReceiptBlock ? BigInt(receiptBlock!) : BigInt(0),
};
export const deploymentConfigurationIssue = contractConfigurationIssue || receiptConfigurationIssue;
export const contractsConfigured = !deploymentConfigurationIssue;

export const contracts = {
  agent: { address: !contractConfigurationIssue && validAddress ? getAddress(address!) : undefined, abi: agentABI, deploymentBlock: validBlock ? BigInt(block!) : BigInt(0) },
  receipt: {
    address: receiptSettings.address,
    deploymentBlock: receiptSettings.block,
  },
} as const;
