# AME credit experiment — architecture and security boundary

Local implementation, unaudited, not approved for real-value use. Existing AMEAgent/AMEReceipt sources and public deployments remain unchanged. No new public lending deployment is claimed.

## Architecture decision

One AMELending contract combines an isolated ERC-4626 liquidity vault and owner-bound credit positions. It reuses the installed OpenZeppelin ERC4626/ERC20, SafeERC20, Math, ReentrancyGuard and Ownable2Step. No separate AMEVault/AMERisk, governance, staking or speculative protocol token. Vault ERC-20 shares represent supplier accounting claims.

An adapter to an established reviewed lending deployment is preferable for real-value use when its network, assets, oracle, liquidity and delegation semantics are verified. Official Aave and Morpho address resources were consulted, but this task did not verify a suitable Robinhood testnet integration. No address was guessed and no Aave/Morpho integration is claimed. The custom local engine proves semantics; it is not asserted safer than an established lending protocol.

References: [OpenZeppelin ERC4626](https://docs.openzeppelin.com/contracts/5.x/erc4626), [Aave addresses](https://www.aave.com/docs/reference/addresses), [Morpho addresses](https://docs.morpho.org/developers/contracts/addresses/).

## Test market and assumptions

Exactly one immutable loan token, one different collateral token and one immutable oracle. Token decimals must be <=18. Local pair: faucet tUSD (6 decimals), faucet tCOL (18). AMETestToken is valueless. AMETestOracle contains administrator-set MOCK quotes, not market prices. The separate AMEAdversarialToken harness is never used by deployment scripts.

Fixed experimental limits: 50% initial/withdrawal LTV; 70% liquidation threshold; 5% liquidation bonus; 5% simple borrow APR; 30-day term; minimum initial borrow 10 loan tokens; aggregate principal cap 1,000,000 loan tokens. These are test parameters, not calibrated economic recommendations. New markets start borrowing-paused. The two-step guardian can pause/resume new borrowing only, with no asset-sweep function. Repayments, deposits, available-cash withdrawals and valid liquidations remain possible.

## Accounting and rounding

For each position, integrate interest numerator N += outstanding principal * 500 * elapsed seconds. Denominator D = 365 days * 10,000. Debt = principal + ceil(N/D). Interest never compounds. Global interest integrates aggregate principal over the same intervals. Repayment retires interest first, then principal. Full interest payment retires the exact remaining numerator; rounding surplus becomes real vault cash.

Vault totalAssets = actual loan-token cash + total principal + floor(global current interest numerator / D). Individual debt rounds up; aggregate uncollected NAV rounds down. Tests compare exact numerators, cash, principal and collateral over multiple positions and mixed repayments. Rounding is measured in token base units; it does not create principal.

Supplier shares use OpenZeppelin virtual assets/shares with a six-decimal offset. maxWithdraw/maxRedeem are capped by actual cash. UI entry points add minimum minted-share / maximum burned-share bounds using a 0.5% quote tolerance. Standard ERC4626 methods remain available and require caller slippage handling. Direct donations do not credit a collateral position. Fee-on-transfer, rebasing and arbitrary callback tokens are unsupported: inbound/outbound sender and recipient balances must change exactly. These checks are not a proof against arbitrary malicious tokens. Only approved well-behaved assets could be considered in a future reviewed design.

## Ownership and authorization

A current NFT owner opens a position. Agent ID and original borrower are immutable. Only the original borrower adds/removes collateral. Borrowing additionally requires that this borrower STILL own the NFT. The borrower can explicitly authorize only the current assigned agent wallet; calls must match both that permission and the current assignment. Zero revokes lending permission. ERC721-approved transfer operators do not gain lending permission. Borrow proceeds always go to the original borrower, never an arbitrary recipient; autonomous operators initiate but do not gain custody of proceeds.

NFT transfer does NOT transfer debt, collateral rights or legal responsibility. It freezes new borrowing on the old position. The original borrower can protect/repay the old position and recover safe/free collateral. Anyone can repay. The new owner can create a separate position but cannot seize or borrow against old collateral. Reacquisition restores owner eligibility; operators still require a valid current wallet assignment. Agent history persists, with original borrower addresses retained per position.

## Prices and liquidation

Both oracle quotes use a common 1e18 quote unit. Quotes must be positive, <=1e36, have nonzero timestamps, not be future-dated, and be <=1 hour old. Borrowing and debt-bearing collateral release require valid quotes and max-LTV solvency. Repayment, protective collateral addition and debt-free collateral release do not require valid prices.

Anyone may liquidate when debt exceeds 70% of collateral value OR the 30-day loan term expires. An overdue but collateralized position can therefore be liquidated. Liquidation closes the whole position, bounded by caller maxRepay/minCollateralOut. With enough collateral, collect full debt and seize bonus-adjusted collateral; the original borrower retains remaining collateral rights. Otherwise collect floor(collateral value / 1.05), seize all collateral and recognize residual bad debt immediately. Supplier NAV absorbs the loss. Principal and interest claims are removed exactly once; repeated liquidation reverts. There is no hidden claim on an NFT buyer.

Fresh but wrong trusted prices remain dangerous. Feed failure blocks liquidation. Liquidator incentives/availability, asset liquidity, price gaps, MEV and outage policy are not solved by unit tests. No production feed or fallback has been integrated.

## Identity, reputation and financial memory

Identity score 1 means ERC721 existence only. It is not creditworthiness. Legacy AMEReceipt records remain authorized self-attestations; they are never imported for reputation credit. The engine is not made an assigned agent wallet to obtain receipt-writing authority.

AMELending emits uniquely numbered FinancialReceipt events for actual borrow, repay and liquidation transitions, atomically with exact token movement. History tracks actual principal returned, interest paid, completions, qualifying completions, late repayments and liquidations. There is no importReceipt, creditReceipt or setReputation method.

Completion is terminal per position. A qualifying completion must be on time, at least one day old, have paid actual interest, and have accumulated at least minimumBorrow * one day of principal-seconds exposure. Leaving a dust tail cannot age an otherwise instant repayment into a qualifying completion. Score = max(0, 10 * min(qualifying completions, 10) - 25 * min(liquidations + late repayments, 4)). It remains informational and can still be economically farmed using patient self-funding/Sybil behavior. It is NOT a trusted credit ranking and never changes collateral, rates, limits or authorization. Volume and arbitrary task/payment attestations confer no score.

Credit risk is separately calculated from actual debt, collateral, health factor, term and price validity.

## Reproduce locally

1. Contracts: `npm run node` in one terminal.
2. Contracts: `npm run deploy:local` for the existing identity/receipt fixture.
3. Contracts: `npm run lending:local` deploys test assets/oracle/market and records the full supply -> collateral -> borrow -> third-party repay -> release -> redeem lifecycle.
4. Frontend: `npm run contracts:sync`, then `npm run lending:sync:local`, `npm test`, `npm run dev`.
5. Contracts: `npm test`, `npm run typecheck`. Frontend: `npm run typecheck`, `npm run build:testnet`.

Evidence: deployments/lending-localhost.json. Local state is ephemeral. Oracle quotes expire after one hour. The frontend reads live state; it does not substitute fixture numbers. Public builds omit lending addresses until an approved, confirmed deployment exists. No dependencies were added.

## Testnet gate and mainnet boundary

### Verified public testnet activation

The current activation uses `scripts/activate-lending-testnet.ts`, not the older unrestricted-fixture deployment script below. It deploys only missing components, reconciles saved receipts/runtime hashes on retry, verifies both legacy identity runtime hashes and saves an administrator/risk manifest. The first token submission encountered an RPC propagation race in Hardhat's deployment wrapper; its successful receipt was recovered and reused, without redeployment. Subsequent deployments save transaction hashes immediately using the wallet deployment API.

Public fixtures are separate from local adversarial fixtures: AMEPublicTestToken allows only fixed self-claims every 24 hours, with an immutable finite supply cap and no arbitrary mint. AMEPublicTestOracle has immutable tokens and immutable synthetic quotes (tUSD=1, tCOL=2); anyone can refresh timestamps, but nobody can change quotes. The engine still rejects stale quotes after one hour. This is deliberately simulated pricing for valueless assets, not an external price feed or a mainnet design.

`scripts/verify-lending-testnet.ts` uses separately generated disposable funded wallets, stored outside the frontend. It records actual confirmed faucet, supply, collateral, borrow, repayment and withdrawal transactions, plus pause/unpause and negative authorization/LTV/solvency simulations. It pauses with active debt to prove repayment remains available. Any failure triggers a pause recovery attempt and records whether it was confirmed. Borrowing was enabled for public testing only after the complete controlled lifecycle passed; 200 tUSD was seeded. The original AMELending, AMEAgent and AMEReceipt Solidity code is unchanged.

Evidence: `deployments/lending-robinhood-testnet.json` and `deployments/lending-testnet-verification.json`. Contract tests: 52 passing. Instant test repayment correctly leaves reputation at zero; no score is fabricated. No MetaMask browser transaction was performed. Review and tests are not an independent security audit.

### Historical deployment gate

scripts/lending-testnet.ts is PREPARED, NOT executed. It requires explicit reviewed-implementation approval via AME_LENDING_TESTNET_APPROVED=YES_TEST_ASSETS_ONLY and a dedicated funded signer. It verifies chain 46630 and the existing identity runtime hash; deploys only valueless faucet tokens, a mock oracle and a PAUSED market; verifies receipts/runtime; and writes a journal. It does not install prices, create a public loan, import receipts, alter identity manifests or unpause borrowing. Any existing journal causes refusal until manual receipt reconciliation, preventing blind duplicate deployment after failure. Signer values must never be printed or placed in frontend variables.

Before testnet UI activation, verify immutable registry/assets/oracle, constructors, bytecode, guardian, pause state and start block. Review and approve the implementation, establish mock-price freshness operations, and explicitly decide whether to unpause this test-only market. The frontend remains unavailable without its own address/block.

No mainnet transaction was made. The new constructor rejects chains other than 31337 and 46630. Real-value use requires independent audit, economic review, reviewed asset/feed integrations, liquidation monitoring, more extensive adversarial/fuzz validation and a new deployment policy. Passing this bounded suite is not production-safety certification.
