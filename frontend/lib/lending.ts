import { erc20Abi, getAddress, parseAbiItem, type Address } from 'viem';
import { agentClient } from './agents.ts';
import { developmentChain } from './chains.ts';
import { contracts } from './contracts.ts';
import { lendingABI } from './generated/lending.ts';
import { resolveLendingConfiguration } from './lending-config.ts';
import {testFaucetABI,testOracleABI} from './test-faucet.ts';
export const lendingConfiguration = resolveLendingConfiguration(developmentChain.id, process.env.NEXT_PUBLIC_AME_LENDING_ADDRESS?.trim(), process.env.NEXT_PUBLIC_AME_LENDING_DEPLOYMENT_BLOCK?.trim());
export const financialReceiptEvent = parseAbiItem('event FinancialReceipt(uint256 indexed receiptId, uint256 indexed positionId, uint256 indexed agentId, uint8 kind, address payer, uint256 principal, uint256 interest)');

export async function readLendingMarket(account?: Address, selectedPosition?: bigint) {
  if (!lendingConfiguration.address || lendingConfiguration.issue) throw new Error(lendingConfiguration.issue || 'Lending unavailable');
  if (await agentClient.getChainId() !== developmentChain.id) throw new Error('LENDING RPC WRONG NETWORK');
  const code = await agentClient.getCode({ address: lendingConfiguration.address });
  if (!code || code === '0x') throw new Error('LENDING UNAVAILABLE — No contract bytecode at configured address.');
  const block = await agentClient.getBlock();
  const market = { address: lendingConfiguration.address, abi: lendingABI, blockNumber: block.number } as const;
  const [asset, collateral, registry, cash, nav, principal, apr, ltv, threshold, bonus, paused, cap, term, minimumBorrow] = await Promise.all([
    agentClient.readContract({ ...market, functionName: 'asset' }), agentClient.readContract({ ...market, functionName: 'collateralAsset' }),
    agentClient.readContract({ ...market, functionName: 'agentRegistry' }), agentClient.readContract({ ...market, functionName: 'availableLiquidity' }),
    agentClient.readContract({ ...market, functionName: 'totalAssets' }), agentClient.readContract({ ...market, functionName: 'totalPrincipal' }),
    agentClient.readContract({ ...market, functionName: 'APR_BPS' }), agentClient.readContract({ ...market, functionName: 'LTV_BPS' }),
    agentClient.readContract({ ...market, functionName: 'LIQUIDATION_BPS' }), agentClient.readContract({ ...market, functionName: 'BONUS_BPS' }),
    agentClient.readContract({ ...market, functionName: 'borrowingPaused' }), agentClient.readContract({ ...market, functionName: 'borrowCap' }),
    agentClient.readContract({ ...market, functionName: 'LOAN_TERM' }),
    agentClient.readContract({ ...market, functionName: 'minimumBorrow' }),
  ]);
  if (!contracts.agent.address || getAddress(registry) !== getAddress(contracts.agent.address)) throw new Error('LENDING REGISTRY MISMATCH — Identity configuration does not match this market.');
  const token = (address: Address) => ({ address, abi: erc20Abi, blockNumber: block.number } as const);
  const [loanSymbol, loanDecimals, collateralSymbol, collateralDecimals] = await Promise.all([
    agentClient.readContract({ ...token(asset), functionName: 'symbol' }), agentClient.readContract({ ...token(asset), functionName: 'decimals' }),
    agentClient.readContract({ ...token(collateral), functionName: 'symbol' }), agentClient.readContract({ ...token(collateral), functionName: 'decimals' }),
  ]);
  if (loanDecimals > 18 || collateralDecimals > 18) throw new Error('Unsupported token precision');
  const shares = account ? await agentClient.readContract({ ...market, functionName: 'balanceOf', args: [account] }) : undefined;
  const supplyBalance = shares !== undefined ? await agentClient.readContract({ ...market, functionName: 'previewRedeem', args: [shares] }) : undefined;
  const withdrawable = account ? await agentClient.readContract({ ...market, functionName: 'maxWithdraw', args: [account] }) : undefined;
  const loanBalance = account ? await agentClient.readContract({ ...token(asset), functionName: 'balanceOf', args: [account] }) : undefined;
  const collateralBalance = account ? await agentClient.readContract({ ...token(collateral), functionName: 'balanceOf', args: [account] }) : undefined;
  let faucet = null;
  if (process.env.NEXT_PUBLIC_AME_TEST_FAUCET === '1' && developmentChain.id === 46630) {
    const oracle = await agentClient.readContract({...market,functionName:'oracle'});
    const [loanClaim,collateralClaim,updatedAt,loanNext,collateralNext] = await Promise.all([
      agentClient.readContract({address:asset,abi:testFaucetABI,functionName:'claimAmount',blockNumber:block.number}),
      agentClient.readContract({address:collateral,abi:testFaucetABI,functionName:'claimAmount',blockNumber:block.number}),
      agentClient.readContract({address:oracle,abi:testOracleABI,functionName:'updatedAt',blockNumber:block.number}),
      account ? agentClient.readContract({address:asset,abi:testFaucetABI,functionName:'nextClaimAt',args:[account],blockNumber:block.number}) : 0n,
      account ? agentClient.readContract({address:collateral,abi:testFaucetABI,functionName:'nextClaimAt',args:[account],blockNumber:block.number}) : 0n,
    ]);
    faucet = {oracle,loanClaim,collateralClaim,updatedAt,loanNext,collateralNext};
  }
  let credit = null;
  if (selectedPosition !== undefined) {
    const position = await agentClient.readContract({ ...market, functionName: 'position', args: [selectedPosition] });
    const identity = { address: registry, abi: contracts.agent.abi, blockNumber: block.number } as const;
    const [debt, health, borrowable, history, reputation, currentOwner, wallet] = await Promise.all([
      agentClient.readContract({ ...market, functionName: 'debtOf', args: [selectedPosition] }),
      agentClient.readContract({ ...market, functionName: 'healthFactor', args: [selectedPosition] }).catch(() => null),
      agentClient.readContract({ ...market, functionName: 'borrowable', args: [selectedPosition] }).catch(() => null),
      agentClient.readContract({ ...market, functionName: 'history', args: [position.agentId] }),
      agentClient.readContract({ ...market, functionName: 'reputationScore', args: [position.agentId] }),
      agentClient.readContract({ ...identity, functionName: 'ownerOf', args: [position.agentId] }),
      agentClient.readContract({ ...identity, functionName: 'agentWalletOf', args: [position.agentId] }),
    ]);
    // Explicitly bounded history; aggregate contract counters remain lifetime values.
    const fromBlock = block.number > 4999n ? block.number - 4999n : 0n;
    let historyUnavailable = false;
    const receipts = await agentClient.getLogs({ address: market.address, event: financialReceiptEvent, args: { positionId: selectedPosition }, fromBlock: fromBlock > lendingConfiguration.deploymentBlock! ? fromBlock : lendingConfiguration.deploymentBlock!, toBlock: block.number }).catch(() => { historyUnavailable = true; return []; });
    credit = { position, debt, health, borrowable, history, reputation, currentOwner, wallet, receipts, historyUnavailable };
  }
  return { block: block.number, timestamp: block.timestamp, address: market.address, asset, collateral, cash, nav, principal, apr, ltv, threshold, bonus, paused, cap, term, minimumBorrow, loanSymbol, loanDecimals, collateralSymbol, collateralDecimals, shares, supplyBalance, withdrawable, loanBalance, collateralBalance, credit, faucet };
}
