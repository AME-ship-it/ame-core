# Lending interface and deployment state

The approved Home.tsx, SiteHeader.tsx, global CSS, mascot and existing Web3 modules are unchanged. `/lending` is a new route with isolated CSS. ProductShell adds only a product-footer lending link; the independent homepage footer is unchanged.

AME Lending is deployed on Robinhood Chain Testnet using valueless tUSD/tCOL and fixed, clearly labeled mock quotes. AMELending is `0x3A0EeC960E3dD696DC5AEbB04f92CDcfBf308dF6`, deployment block 147554173. Existing identity and receipt contracts remain unchanged. No APR, TVL, balances, health factors or history are shown without live contract reads.

Optional public build variables:
- NEXT_PUBLIC_AME_LENDING_ADDRESS: confirmed AMELending address on selected chain.
- NEXT_PUBLIC_AME_LENDING_DEPLOYMENT_BLOCK: actual deployment block for financial receipt history.
- NEXT_PUBLIC_AME_TEST_FAUCET=1: enable the deployed capped public-testnet token faucets and fixed mock-oracle timestamp refresh. Do not enable for arbitrary token contracts.

They must be supplied together, separately from existing identity variables. Mainnet lending is unconditionally disabled. build:testnet accepts the optional pair only when valid; without it the page remains unavailable. Existing Vercel settings remain Next.js, Node 24.x, npm run build / Webpack. No contract compilation or signer is needed to publish the unavailable UI.

Local workflow: in contracts run the existing node, deploy:local, then lending:local. In frontend run contracts:sync and lending:sync:local. npm test then runs existing identity regressions plus local lending SDK reads. The optional local SDK cases skip only when no lending address is configured. No RPC or wallet browser is mocked as a real MetaMask validation.

The UI displays actual vault liquidity, supplier claim/withdrawable cash, simple APR, utilization, risk limits, original borrower, current NFT owner/assigned wallet, collateral, debt, health and engine history. All reads share a snapshot block. Invalid/stale oracle risk values show unavailable; repayment remains callable because the contract does not require quotes. A configured-but-incompatible registry or missing bytecode produces an error, not sample state. History is explicitly limited to the latest 5,000 blocks; lifetime counters come directly from the engine. Production indexing/pagination is not implemented.

Actions simulate first, request finite approvals if needed, wait for success, and verify replacement transaction sender/target/calldata before claiming completion. A controller lock blocks concurrent actions. Supply/withdraw quotes enforce 0.5% share slippage. Confirmed PositionOpened events select new positions. Repayment values are maxima, not requested overpayments. Browser reload never automatically resubmits an action; inspect the retained wallet transaction history before retrying. Dedicated real-wallet lending QA remains NOT VERIFIED.

The core design, accounting equations, transfer behavior, liquidation losses and known risks are documented in ../contracts/LENDING.md. The contract constructor supports only local 31337 and testnet 46630. Deployment started paused; borrowing was enabled only after the controlled testnet lifecycle passed. Real MetaMask browser QA remains NOT VERIFIED.

## Public tester flow

Connect on Robinhood Chain Testnet with testnet ETH for gas. Claim 1,000 tUSD and 100 tCOL (per-token, per-wallet 24-hour cooldown, with finite global supply caps). Supply tUSD, create an AME identity, open a position, approve/add tCOL, then borrow within the contract's collateral and liquidity limits. Repayment amounts are maxima and include accrued simple interest. Repay before releasing collateral; withdraw only available vault cash. Every action requires a wallet confirmation.

Fixed mock quotes are 1 tUSD = 1 synthetic unit and 1 tCOL = 2 synthetic units. They are not market data. Quotes expire after one hour; the UI's Refresh mock test quotes action lets anyone refresh timestamps but cannot change prices. Existing oracle validation remains enforced by the engine. Faucet limits are wallet-based, not Sybil resistance. Assets and vault shares have no intended real value.

Selected position IDs are saved locally by market/network/wallet; balances, debt and history are always reread onchain after refresh. Recent event history is limited to 5,000 blocks, while lifetime counters remain available. Testnet transaction evidence is in `../contracts/deployments/lending-testnet-verification.json`; deployment receipts, runtime hashes, administrator and risk parameters are in `lending-robinhood-testnet.json` in the same directory. No private signer information is included.

## Verified public RPC regression repair (2026-11-02)

The additional read-only public verification discovered that the existing AME owner-discovery query now spans 11,268,088 blocks while the official RPC accepts at most 10,000,000 inclusive blocks. lib/agents.ts was minimally changed to use lib/log-ranges.ts for both Transfer discovery and AgentMinted timestamp lookups. Return values, ownership checks, wallet logic and mint submission remain unchanged. Range tests check exact inclusive boundaries, no gaps/overlap and propagation of RPC failures. All five public deployment/read tests then passed; no public transaction was sent. An indexer is still appropriate for very large histories.

Final local results: 50 contract tests, 38 frontend tests, both typechecks, the complete local RPC lending lifecycle, 10 configured production route/runtime checks and 5 public identity/receipt checks. These do not certify production safety or real-wallet browser approval.

## Lending Terminal V2

The existing transaction simulation, finite approvals, share-slippage bounds, receipt confirmation and replacement checks are retained. A focused Supply/Borrow/Repay/Withdraw/Add collateral/Remove collateral panel adds token-specific units, guarded MAX amounts, original-borrower/operator checks and explicit simulation/wallet/pending/confirmed/error states. Contract simulation remains authoritative for collateral solvency. Advanced liquidation uses its own explicitly denominated maximum repayment input.

Market-history charts read at most 16 actual archived block snapshots per range, in bounded batches. Liquidity and borrowed principal are separate series; each point carries its actual block timestamp. No price series, OHLC candles or fabricated balances are generated. Missing archive reads remain unavailable and the UI reports the coverage. Portfolio allocation compares wallet balance and supplied claim in the same loan-token units, without synthetic cross-asset USD valuation.

The Robinhood Mainnet view verifies chain ID 4663 and reads the latest block, gas price and connected address's native balance using the existing network metadata. It is read-only: no wallet switching, signatures, testnet-address reuse or mainnet lending actions. Existing mainnet lending guards remain unchanged. The production environment continues to select the deployed testnet market. GitHub workflow publication is postponed and independent of manual Vercel deployment.
