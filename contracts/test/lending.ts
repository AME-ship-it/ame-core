import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import hre from 'hardhat';
import { encodeFunctionData, getAddress, maxUint256, parseEventLogs, zeroAddress } from 'viem';
const connection = await hre.network.create();
const { viem } = connection;
const client = await viem.getPublicClient();
const [owner, operator, lender, outsider, buyer] = await viem.getWalletClients();
const U = 10n ** 6n, C = 10n ** 18n, W = 10n ** 18n, DAY = 86400;
const DENOM = 365n * 86400n * 10000n;
async function advance(seconds: number) {
  await connection.provider.request({ method: 'evm_increaseTime', params: [seconds] });
  await connection.provider.request({ method: 'evm_mine', params: [] });
}
async function fixture(adversarial = false, collateralAdversarial = false) {
  const agent = await viem.deployContract('AMEAgent');
  const loanDeployment = await viem.deployContract(adversarial ? 'AMEAdversarialToken' : 'AMETestToken', ['AME TEST USD', 'tUSD', 6]);
  const collateralDeployment = await viem.deployContract(collateralAdversarial ? 'AMEAdversarialToken' : 'AMETestToken', ['AME TEST COLLATERAL', 'tCOL', 18]);
  const loan = await viem.getContractAt('AMETestToken', loanDeployment.address);
  const collateral = await viem.getContractAt('AMETestToken', collateralDeployment.address);
  const oracle = await viem.deployContract('AMETestOracle', [owner.account.address]);
  const market = await viem.deployContract('AMELending', [loan.address, collateral.address, agent.address, oracle.address, owner.account.address]);
  await market.write.setBorrowingPaused([false]);
  await agent.write.mint([operator.account.address, 'data:application/json,test']);
  await market.write.openPosition([1n]);
  for (const wallet of [owner, lender, outsider, buyer]) {
    await loan.write.mint([wallet.account.address, 10000n * U]);
    await loan.write.approve([market.address, maxUint256], { account: wallet.account });
  }
  await collateral.write.mint([owner.account.address, 1000n * C]);
  await collateral.write.approve([market.address, maxUint256]);
  async function price(collateralPrice = 2n * W) {
    const { timestamp } = await client.getBlock();
    await oracle.write.setPrice([loan.address, W, timestamp]);
    await oracle.write.setPrice([collateral.address, collateralPrice, timestamp]);
  }
  await price();
  async function funded(amount = 1000n * U) {
    await market.write.deposit([amount, lender.account.address], { account: lender.account });
    await market.write.addCollateral([1n, 100n * C]);
  }
  return { agent, loan, collateral, oracle, market, price, funded };
}

describe('AME isolated lending lifecycle', () => {
  it('completes supply -> collateral -> operator borrow -> third-party repay -> release -> lender withdraw with exact conservation', async () => {
    const f = await fixture(); await f.funded(); await f.market.write.setOperator([1n, operator.account.address]);
    const beforeOwner = await f.loan.read.balanceOf([owner.account.address]);
    await f.market.write.borrow([1n, 80n * U], { account: operator.account });
    assert.equal(await f.loan.read.balanceOf([owner.account.address]), beforeOwner + 80n * U);
    assert.equal(await f.market.read.availableLiquidity(), 920n * U);
    await advance(2 * DAY); await f.price();
    const debt = await f.market.read.debtOf([1n]); assert.ok(debt > 80n * U);
    await f.market.write.repay([1n, 100n * U], { account: outsider.account });
    assert.equal(await f.market.read.debtOf([1n]), 0n);
    await f.market.write.removeCollateral([1n, 100n * C]);
    assert.equal(await f.market.read.totalCollateral(), 0n);
    const shares = await f.market.read.balanceOf([lender.account.address]);
    await f.market.write.redeem([shares, lender.account.address, lender.account.address], { account: lender.account });
    assert.ok(await f.market.read.availableLiquidity() <= 1n);
    assert.equal((await f.market.read.history([1n]))[0], 1n);
    assert.equal(await f.market.read.reputationScore([1n]), 10n);
  });
  it('uses ERC4626 virtual shares and bounds withdrawals by actual cash', async () => {
    const f = await fixture(); await f.funded(); await f.market.write.borrow([1n, 90n * U]);
    assert.equal(await f.market.read.balanceOf([lender.account.address]), 1000n * U * 1000000n);
    assert.equal(await f.market.read.maxWithdraw([lender.account.address]), 910n * U);
    await assert.rejects(f.market.write.withdraw([911n * U, lender.account.address, lender.account.address], { account: lender.account }), /ERC4626ExceededMaxWithdraw/);
    await f.market.write.withdraw([500n * U, lender.account.address, lender.account.address], { account: lender.account });
    assert.equal(await f.market.read.availableLiquidity(), 410n * U);
  });
  it('rejects arbitrary agent selection, operators without explicit permission and NFT-approved transfer operators', async () => {
    const f = await fixture(); await f.funded();
    await assert.rejects(f.market.write.openPosition([1n], { account: outsider.account }), /Unauthorized/);
    await assert.rejects(f.market.write.openPosition([999n]), /ERC721NonexistentToken/);
    await assert.rejects(f.market.write.borrow([1n, 10n * U], { account: operator.account }), /Unauthorized/);
    await f.agent.write.approve([outsider.account.address, 1n]);
    await assert.rejects(f.market.write.borrow([1n, 10n * U], { account: outsider.account }), /Unauthorized/);
    await assert.rejects(f.market.write.setOperator([1n, outsider.account.address]), /Unauthorized/);
  });
  it('revokes operators explicitly and immediately follows assigned-wallet revocation', async () => {
    const f = await fixture(); await f.funded(); await f.market.write.setOperator([1n, operator.account.address]);
    await f.market.write.setOperator([1n, zeroAddress]);
    await assert.rejects(f.market.write.borrow([1n, 10n * U], { account: operator.account }), /Unauthorized/);
    await f.market.write.setOperator([1n, operator.account.address]);
    await f.agent.write.setAgentWallet([1n, buyer.account.address]);
    await assert.rejects(f.market.write.borrow([1n, 10n * U], { account: operator.account }), /Unauthorized/);
  });
  it('binds existing debt/collateral to original borrower after NFT transfer; buyer cannot inherit debt permissions or seize collateral', async () => {
    const f = await fixture(); await f.funded(); await f.market.write.setOperator([1n, operator.account.address]); await f.market.write.borrow([1n, 50n * U]);
    await f.agent.write.transferFrom([owner.account.address, buyer.account.address, 1n]);
    for (const caller of [owner, operator, buyer]) await assert.rejects(f.market.write.borrow([1n, 10n * U], { account: caller.account }), /Unauthorized/);
    await assert.rejects(f.market.write.removeCollateral([1n, C], { account: buyer.account }), /Unauthorized/);
    assert.equal((await f.market.read.position([1n])).borrower, getAddress(owner.account.address));
    await f.market.write.openPosition([1n], { account: buyer.account });
    assert.equal((await f.market.read.position([2n])).borrower, getAddress(buyer.account.address));
    await f.market.write.repay([1n, 100n * U], { account: outsider.account });
    await f.market.write.removeCollateral([1n, 100n * C]);
  });
  it('rejects borrowing past LTV, insufficient liquidity, and unsafe collateral removal', async () => {
    const f = await fixture(); await f.funded(50n * U);
    await assert.rejects(f.market.write.borrow([1n, 60n * U]), /InsufficientLiquidity/);
    await f.market.write.borrow([1n, 40n * U]);
    await assert.rejects(f.market.write.removeCollateral([1n, 99n * C]), /Unhealthy/);
    await f.market.write.deposit([1000n * U, lender.account.address], { account: lender.account });
    await assert.rejects(f.market.write.borrow([1n, 100n * U]), /Unhealthy/);
    await assert.rejects(f.market.write.borrow([1n, 1n], { account: buyer.account }), /Unauthorized/);
  });
  it('rejects zero, missing, negative, future, excessive and stale oracle quotes, but still permits repayment and debt-free collateral release', async () => {
    const f = await fixture(); await f.funded(); await f.market.write.borrow([1n, 50n * U]);
    for (const answer of [0n, -1n, 10n ** 37n]) {
      await f.oracle.write.setPrice([f.collateral.address, answer, (await client.getBlock()).timestamp]);
      await assert.rejects(f.market.write.borrow([1n, 10n * U]), /InvalidPrice/);
      await assert.rejects(f.market.read.healthFactor([1n]), /InvalidPrice/);
    }
    await f.oracle.write.setPrice([f.collateral.address, 2n * W, (await client.getBlock()).timestamp + 1000n]);
    await assert.rejects(f.market.write.borrow([1n, 10n * U]), /InvalidPrice/);
    await f.price(); await advance(3601);
    await assert.rejects(f.market.write.borrow([1n, 10n * U]), /InvalidPrice/);
    await assert.rejects(f.market.write.liquidate([1n, 100n * U, 0n]), /InvalidPrice/);
    await f.market.write.repay([1n, 100n * U]); await f.market.write.removeCollateral([1n, 100n * C]);
  });
  it('accrues linear simple interest, not compound interest, and retires interest before principal', async () => {
    const f = await fixture(); await f.funded(); await f.market.write.borrow([1n, 80n * U]);
    await advance(10 * DAY);
    let p = await f.market.read.position([1n]);
    const expected = 80n * U * 500n * (p.lastAccrual - p.openedAt);
    assert.equal(p.interestNumerator, expected);
    assert.equal(await f.market.read.debtOf([1n]), 80n * U + (expected + DENOM - 1n) / DENOM);
    await f.market.write.repay([1n, 20000n]);
    p = await f.market.read.position([1n]); assert.equal(p.principal, 80n * U);
    const stored = p.interestNumerator; const timestamp = p.lastAccrual;
    await advance(2 * DAY); p = await f.market.read.position([1n]);
    assert.equal(p.interestNumerator - stored, 80n * U * 500n * (p.lastAccrual - timestamp));
  });
  it('pauses only new borrowing; deposits, repayments, liquidations and withdrawals remain available', async () => {
    const f = await fixture(); await f.funded(); await f.market.write.borrow([1n, 20n * U]);
    await assert.rejects(f.market.write.setBorrowingPaused([true], { account: outsider.account }), /OwnableUnauthorizedAccount/);
    await f.market.write.setBorrowingPaused([true]);
    await assert.rejects(f.market.write.borrow([1n, 10n * U]), /BorrowingDisabled/);
    await f.market.write.deposit([10n * U, lender.account.address], { account: lender.account });
    await f.market.write.repay([1n, 30n * U]); await f.market.write.removeCollateral([1n, 100n * C]);
    await f.market.write.withdraw([10n * U, lender.account.address, lender.account.address], { account: lender.account });
  });
  it('liquidates an unhealthy but solvent loan with a bounded 5% collateral incentive and one negative history outcome', async () => {
    const f = await fixture(); await f.funded(); await f.market.write.borrow([1n, 90n * U]); await f.price(W);
    assert.ok(await f.market.read.healthFactor([1n]) < W);
    await assert.rejects(f.market.write.liquidate([1n, 1n, 0n], { account: outsider.account }), /Slippage/);
    await f.market.write.liquidate([1n, 100n * U, 94n * C], { account: outsider.account });
    assert.equal(await f.market.read.debtOf([1n]), 0n); assert.equal(await f.market.read.totalBadDebt(), 0n);
    assert.equal((await f.market.read.history([1n]))[1], 1n);
    await assert.rejects(f.market.write.liquidate([1n, 100n * U, 0n]), /NotLiquidatable/);
  });
  it('realizes bad debt immediately on collateral exhaustion, reducing supplier NAV without phantom debt or collateral', async () => {
    const f = await fixture(); await f.funded(); await f.market.write.borrow([1n, 90n * U]); await f.price(W / 10n);
    const before = await f.market.read.totalAssets();
    await f.market.write.liquidate([1n, 100n * U, 100n * C], { account: outsider.account });
    assert.ok(await f.market.read.totalBadDebt() > 80n * U); assert.ok(await f.market.read.totalAssets() < before - 80n * U);
    assert.equal(await f.market.read.totalPrincipal(), 0n); assert.equal(await f.market.read.totalInterestNumerator(), 0n);
    assert.equal(await f.market.read.totalCollateral(), 0n); assert.equal(await f.collateral.read.balanceOf([f.market.address]), 0n);
    assert.equal((await f.market.read.position([1n])).closed, true);
  });
  it('rejects healthy liquidation and enables deterministic overdue liquidation only with valid current prices', async () => {
    const f = await fixture(); await f.funded(); await f.market.write.borrow([1n, 50n * U]);
    await assert.rejects(f.market.write.liquidate([1n, 100n * U, 0n]), /NotLiquidatable/);
    await advance(31 * DAY); await f.price();
    await assert.rejects(f.market.write.borrow([1n, 10n * U]), /BorrowingDisabled/);
    await f.market.write.liquidate([1n, 100n * U, 0n]); assert.equal(await f.market.read.debtOf([1n]), 0n);
  });
  it('does not credit instant repayment, duplicate repayment, arbitrary receipts, or a closed-position reborrow', async () => {
    const f = await fixture(); await f.funded(); await f.market.write.borrow([1n, 50n * U]); await f.market.write.repay([1n, 100n * U]);
    assert.equal(await f.market.read.reputationScore([1n]), 0n);
    await assert.rejects(f.market.write.repay([1n, 1n]), /InvalidAmount/);
    await assert.rejects(f.market.write.borrow([1n, 10n * U]), /Unauthorized/);
    assert.equal(f.market.abi.some(item => item.type === 'function' && /creditReceipt|importReceipt|setReputation/.test(item.name)), false);
  });
  it('emits unique engine receipts only for actual borrow/repayment state transitions', async () => {
    const f = await fixture(); await f.funded();
    const h1 = await f.market.write.borrow([1n, 50n * U]);
    const h2 = await f.market.write.repay([1n, 100n * U], { account: outsider.account });
    const events = [];
    for (const hash of [h1, h2]) { const tx = await client.waitForTransactionReceipt({ hash }); events.push(...parseEventLogs({ abi: f.market.abi, logs: tx.logs, eventName: 'FinancialReceipt' })); }
    assert.deepEqual(events.map(e => e.args.receiptId), [1n, 2n]); assert.deepEqual(events.map(e => e.args.kind), [0, 1]);
    assert.equal(events[1].args.payer, getAddress(outsider.account.address));
  });
  it('rejects fee-on-transfer loan deposits and outbound transfers atomically', async () => {
    const f = await fixture(true); const token = await viem.getContractAt('AMEAdversarialToken', f.loan.address);
    await token.write.setFee([100n]);
    await assert.rejects(f.market.write.deposit([100n * U, lender.account.address], { account: lender.account }), /UnsupportedToken/);
    assert.equal(await f.market.read.totalSupply(), 0n);
    await token.write.setFee([0n]); await f.funded(); await token.write.setFee([100n]);
    await assert.rejects(f.market.write.borrow([1n, 50n * U]), /UnsupportedToken/); assert.equal(await f.market.read.totalPrincipal(), 0n);
    await assert.rejects(f.market.write.withdraw([10n * U, lender.account.address, lender.account.address], { account: lender.account }), /UnsupportedToken/);
  });
  it('rejects fee-on-transfer collateral and preserves collateral totals on failure', async () => {
    const f = await fixture(false, true); const token = await viem.getContractAt('AMEAdversarialToken', f.collateral.address);
    await token.write.setFee([100n]); await assert.rejects(f.market.write.addCollateral([1n, 100n * C]), /UnsupportedToken/);
    assert.equal(await f.market.read.totalCollateral(), 0n); assert.equal((await f.market.read.position([1n])).collateral, 0n);
  });
  it('blocks malicious-token reentrancy into borrow, deposit, repayment and collateral methods', async () => {
    const f = await fixture(true); await f.funded(); const token = await viem.getContractAt('AMEAdversarialToken', f.loan.address);
    for (const data of [
      encodeFunctionData({ abi: f.market.abi, functionName: 'borrow', args: [1n, 10n * U] }),
      encodeFunctionData({ abi: f.market.abi, functionName: 'deposit', args: [U, outsider.account.address] }),
      encodeFunctionData({ abi: f.market.abi, functionName: 'repay', args: [1n, U] }),
      encodeFunctionData({ abi: f.market.abi, functionName: 'addCollateral', args: [1n, C] }),
    ]) {
      await token.write.setCallback([f.market.address, data]);
      await assert.rejects(f.market.write.borrow([1n, 10n * U]), /CALLBACK REJECTED/);
      assert.equal(await f.market.read.totalPrincipal(), 0n);
    }
  });
  it('resists donation/rounding theft and never mints zero-share deposits', async () => {
    const f = await fixture(); await f.market.write.deposit([1n, outsider.account.address], { account: outsider.account });
    await f.loan.write.transfer([f.market.address, 100n * U], { account: outsider.account });
    const shares = await f.market.read.previewDeposit([100n * U]); assert.ok(shares > 0n);
    await f.market.write.deposit([100n * U, lender.account.address], { account: lender.account });
    const attackerShares = await f.market.read.balanceOf([outsider.account.address]);
    const attackerOut = await f.market.read.previewRedeem([attackerShares]); assert.ok(attackerOut < 100n * U);
    await assert.rejects(f.market.write.deposit([0n, lender.account.address], { account: lender.account }), /InvalidAmount/);
  });
  it('conserves aggregate debt, cash and collateral across two positions and staggered partial repayments', async () => {
    const f = await fixture(); await f.funded(); await f.market.write.openPosition([1n]); await f.market.write.addCollateral([2n, 100n * C]);
    await f.market.write.borrow([1n, 70n * U]); await f.market.write.borrow([2n, 60n * U]);
    for (let i = 0; i < 8; i++) {
      await advance(31 + i * 13); await f.market.write.repay([i % 2 ? 1n : 2n, (1n + BigInt(i)) * U], { account: outsider.account });
      const p1 = await f.market.read.position([1n]), p2 = await f.market.read.position([2n]);
      assert.equal(await f.market.read.totalPrincipal(), p1.principal + p2.principal);
      const sumInterest = p1.interestNumerator + p2.interestNumerator;
      const total = await f.market.read.totalAssets(); const cash = await f.market.read.availableLiquidity();
      assert.equal(total, cash + p1.principal + p2.principal + sumInterest / DENOM);
      assert.equal(await f.collateral.read.balanceOf([f.market.address]), p1.collateral + p2.collateral);
      assert.equal(await f.market.read.totalCollateral(), p1.collateral + p2.collateral);
    }
    await f.market.write.repay([1n, 100n * U]); await f.market.write.repay([2n, 100n * U]);
    assert.equal(await f.market.read.totalPrincipal(), 0n); assert.equal(await f.market.read.totalInterestNumerator(), 0n);
  });
  it('starts paused and rejects invalid registry, identical assets and unsupported precision', async () => {
    const f = await fixture();
    const paused = await viem.deployContract('AMELending', [f.loan.address, f.collateral.address, f.agent.address, f.oracle.address, owner.account.address]);
    assert.equal(await paused.read.borrowingPaused(), true);
    await assert.rejects(viem.deployContract('AMELending', [f.loan.address, f.loan.address, f.agent.address, f.oracle.address, owner.account.address]), /InvalidConfiguration/);
    await assert.rejects(viem.deployContract('AMELending', [f.loan.address, f.collateral.address, outsider.account.address, f.oracle.address, owner.account.address]), /InvalidConfiguration/);
    const precision = await viem.deployContract('AMETestToken', ['BAD', 'BAD', 19]);
    await assert.rejects(viem.deployContract('AMELending', [precision.address, f.collateral.address, f.agent.address, f.oracle.address, owner.account.address]), /InvalidConfiguration/);
  });
  it('prevents stealing another supplier shares and honors explicit ERC20 share allowances', async () => {
    const f = await fixture(); await f.funded();
    await assert.rejects(f.market.write.withdraw([U, outsider.account.address, lender.account.address], { account: outsider.account }), /ERC20InsufficientAllowance/);
    const shares = await f.market.read.previewWithdraw([10n * U]);
    await f.market.write.approve([outsider.account.address, shares], { account: lender.account });
    await f.market.write.withdraw([10n * U, outsider.account.address, lender.account.address], { account: outsider.account });
    assert.equal(await f.market.read.availableLiquidity(), 990n * U);
  });
  it('caps total principal, enforces minimum opening debt and rejects oversized/zero amounts', async () => {
    const f = await fixture(); await f.funded();
    for (const amount of [0n, 1n << 128n]) await assert.rejects(f.market.write.borrow([1n, amount]), /InvalidAmount/);
    await assert.rejects(f.market.write.borrow([1n, 9n * U]), /InvalidAmount/);
    await f.loan.write.mint([lender.account.address, 2_000_000n * U]);
    await f.market.write.deposit([2_000_000n * U, lender.account.address], { account: lender.account });
    await f.collateral.write.mint([owner.account.address, 2_000_000n * C]);
    await f.market.write.addCollateral([1n, 2_000_000n * C]);
    await assert.rejects(f.market.write.borrow([1n, 1_000_001n * U]), /InsufficientLiquidity/);
    await f.market.write.borrow([1n, 1_000_000n * U]);
    assert.equal(await f.market.read.borrowable([1n]), 0n);
  });
  it('can accept protective collateral after oracle failure and NFT transfer, but cannot over-withdraw it', async () => {
    const f = await fixture(); await f.funded(); await f.market.write.borrow([1n, 50n * U]);
    await f.agent.write.transferFrom([owner.account.address, buyer.account.address, 1n]);
    await advance(3601); await f.market.write.addCollateral([1n, 10n * C]);
    assert.equal(await f.market.read.totalCollateral(), 110n * C);
    await assert.rejects(f.market.write.removeCollateral([1n, C]), /InvalidPrice/);
    await assert.rejects(f.market.write.removeCollateral([1n, 111n * C]), /Unauthorized/);
  });
  it('late repayment is verified completion but never positive reputation', async () => {
    const f = await fixture(); await f.funded(); await f.market.write.borrow([1n, 50n * U]); await advance(31 * DAY);
    await f.market.write.repay([1n, 100n * U]);
    const h = await f.market.read.history([1n]); assert.equal(h[0], 1n); assert.equal(h[4], 0n); assert.equal(h[5], 1n);
    assert.equal(await f.market.read.reputationScore([1n]), 0n);
  });
  it('supplier claim gains only actually accrued interest and full repayment overpayment is bounded by exact debt', async () => {
    const f = await fixture(); await f.funded(); await f.market.write.borrow([1n, 50n * U]); await advance(DAY);
    const before = await f.loan.read.balanceOf([outsider.account.address]);
    const tx = await client.waitForTransactionReceipt({ hash: await f.market.write.repay([1n, 1000n * U], { account: outsider.account }) });
    const [receipt] = parseEventLogs({ abi: f.market.abi, logs: tx.logs, eventName: 'FinancialReceipt' });
    assert.equal(before - await f.loan.read.balanceOf([outsider.account.address]), receipt.args.principal + receipt.args.interest);
    assert.ok(await f.market.read.totalAssets() > 1000n * U);
  });
  it('failed fee-bearing repayment rolls back cash, principal, counters and event ID', async () => {
    const f = await fixture(true); await f.funded(); await f.market.write.borrow([1n, 50n * U]);
    const token = await viem.getContractAt('AMEAdversarialToken', f.loan.address); await token.write.setFee([100n]);
    const principal = await f.market.read.totalPrincipal(), next = await f.market.read.nextFinancialReceiptId();
    await assert.rejects(f.market.write.repay([1n, 100n * U]), /UnsupportedToken/);
    assert.equal(await f.market.read.totalPrincipal(), principal); assert.equal(await f.market.read.nextFinancialReceiptId(), next);
    assert.equal((await f.market.read.history([1n]))[0], 0n);
  });
  it('collateral callbacks cannot reenter and failed outgoing collateral fees restore the full position', async () => {
    const f = await fixture(false, true); await f.funded();
    const token = await viem.getContractAt('AMEAdversarialToken', f.collateral.address);
    await token.write.setCallback([f.market.address, encodeFunctionData({abi:f.market.abi,functionName:'removeCollateral',args:[1n,C]})]);
    await assert.rejects(f.market.write.addCollateral([1n,C]), /CALLBACK REJECTED/);
    await token.write.setCallback([zeroAddress,'0x']); await token.write.setFee([100n]);
    await assert.rejects(f.market.write.removeCollateral([1n,10n*C]), /UnsupportedToken/);
    assert.equal(await f.market.read.totalCollateral(),100n*C);
  });
  it('liquidation slippage failure cannot alter supplier NAV or write off debt', async () => {
    const f=await fixture();await f.funded();await f.market.write.borrow([1n,90n*U]);await f.price(W/10n);
    const principal=await f.market.read.totalPrincipal();
    await assert.rejects(f.market.write.liquidate([1n,100n*U,101n*C],{account:outsider.account}),/Slippage/);
    assert.equal(await f.market.read.totalPrincipal(),principal);assert.equal(await f.market.read.totalBadDebt(),0n);
    assert.equal(await f.market.read.totalCollateral(),100n*C);
  });
  it('a deterministic mixed-action run conserves exact balances through 32 staggered repayments and final redemptions', async () => {
    const f=await fixture();await f.funded();await f.market.write.openPosition([1n]);await f.market.write.addCollateral([2n,100n*C]);
    await f.market.write.borrow([1n,90n*U]);await f.market.write.borrow([2n,90n*U]);
    let seed=1234567;
    for(let i=0;i<32;i++){
      seed=(seed*16807)%2147483647;const id=BigInt(seed%2+1);await advance(seed%60+1);
      await f.market.write.repay([id,BigInt(seed%50000+1)],{account:outsider.account});
      const p1=await f.market.read.position([1n]),p2=await f.market.read.position([2n]);
      const cash=await f.loan.read.balanceOf([f.market.address]);
      assert.equal(await f.market.read.totalAssets(),cash+p1.principal+p2.principal+(p1.interestNumerator+p2.interestNumerator)/DENOM);
      assert.equal(await f.market.read.totalPrincipal(),p1.principal+p2.principal);
      assert.equal(await f.market.read.totalCollateral(),await f.collateral.read.balanceOf([f.market.address]));
    }
    await f.market.write.repay([1n,200n*U]);await f.market.write.repay([2n,200n*U]);
    assert.equal(await f.market.read.totalInterestNumerator(),0n);
    await f.market.write.redeem([await f.market.read.balanceOf([lender.account.address]),lender.account.address,lender.account.address],{account:lender.account});
    assert.ok(await f.market.read.availableLiquidity()<=1n);
  });  it('does not award a qualified repayment by leaving one wei outstanding to age an otherwise instant-repaid loan', async () => {
    const f=await fixture();await f.funded();await f.market.write.borrow([1n,50n*U]);
    const debt=await f.market.read.debtOf([1n]);await f.market.write.repay([1n,debt-1n]);
    await advance(2*DAY);await f.market.write.repay([1n,100n*U]);
    const h=await f.market.read.history([1n]);assert.equal(h[0],1n);assert.equal(h[4],0n);assert.equal(await f.market.read.reputationScore([1n]),0n);
  });  it('enforces supplier slippage bounds atomically, including after a donation changes the share price', async () => {
    const f=await fixture();const quoted=await f.market.read.previewDeposit([100n*U]);
    await f.loan.write.transfer([f.market.address,100n*U]);
    await assert.rejects(f.market.write.depositWithMinShares([100n*U,lender.account.address,quoted],{account:lender.account}),/Slippage/);
    assert.equal(await f.market.read.totalSupply(),0n);
    const actual=await f.market.read.previewDeposit([100n*U]);
    await f.market.write.depositWithMinShares([100n*U,lender.account.address,actual],{account:lender.account});
    await assert.rejects(f.market.write.withdrawWithMaxShares([U,lender.account.address,lender.account.address,1n],{account:lender.account}),/Slippage/);
  });});






