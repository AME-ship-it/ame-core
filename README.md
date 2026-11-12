# AME Protocol

**Credit infrastructure for autonomous machines.**

AME Protocol develops onchain identity, financial reputation and lending infrastructure for agents on Robinhood Chain. This repository contains the existing AME application, Solidity contracts, tests and deployment tooling.

[Application](https://ame-rosy.vercel.app) · [Lending](https://ame-rosy.vercel.app/lending) · [Official GitHub](https://github.com/AME-ship-it/ame-core) · [Official X](https://x.com/ame_runtime)

## Current status

**Robinhood Chain Testnet (46630):** identity NFT minting, valueless-token faucets and the controlled lending lifecycle have been verified with actual testnet transactions. The Deploy Agent flow simulates minting, checks confirmed events and ownership, and exposes agent profiles and discovery. An identity NFT does not itself run an autonomous AI agent or grant financial authority. Real MetaMask browser signing remains **NOT VERIFIED**. The custom lending contracts have **not undergone an independent security audit**.

**Robinhood Chain Mainnet (4663):** AMEAgent is deployed at `0x3E5D2c59fc968DAE8Fc58AB1B46F3b3eB03d969c` (block 112023846). The existing website identity flow uses this registry, with mint simulation, confirmed-event token IDs, ownership checks and chain-specific directory/profile reads. Deployment was manually signed in MetaMask; the first mainnet browser-wallet mint remains unverified. See [deployment evidence and configuration](frontend/IDENTITY_MAINNET.md).

The lending terminal reads existing Morpho Blue USDG loan markets with USDe and syrupUSDG collateral. It provides onchain market metrics, balances, positions and unsigned simulation tooling. Mainnet signing, borrowing and reputation writes remain disabled pending market-specific security validation, browser-wallet acceptance and explicit authorization. No real-value lending is enabled by this repository.

- **Identity:** AMEAgent ERC-721 records ownership, assigned agent wallet and owner-controlled metadata. Transfers clear the previous wallet assignment.
- **Receipts:** AMEReceipt stores authorized attestations. AMELending separately emits engine-generated financial receipts for actual borrowing, repayment and liquidation; arbitrary attestations do not create credit history.
- **Reputation:** deterministic informational scores use qualifying repayment history and liquidation/late-payment penalties. Instant repayment earns no positive score. Scores do not relax collateral or authorization controls and are not trusted creditworthiness ratings.
- **Lending:** isolated ERC-4626 vault with 50% initial LTV, 70% liquidation threshold, 5% simple borrow APR, 5% liquidation bonus and a 30-day loan term. Supplier withdrawals are limited by available cash and suppliers bear realized credit losses.
- **Test assets:** capped tUSD/tCOL self-claims with per-wallet 24-hour cooldowns. These assets have no intended real value. Fixed mock quotes are not market data, expire after one hour and can be refreshed through the lending UI without changing prices.

## Architecture

```text
frontend/   Next.js App Router, React, Tailwind/CSS modules, Wagmi and Viem
contracts/  Solidity 0.8.28, Hardhat 3, OpenZeppelin 5.6.1, deployment scripts/tests
.github/    CI and review ownership
```

Use Node.js **24.x** and npm. Each workspace has its own committed lockfile; no additional monorepo tooling is required.

## Local development

From the repository root:

```sh
npm --prefix contracts ci
npm --prefix frontend ci
npm --prefix contracts run compile
npm --prefix contracts run node
```

Keep the local node running. In another terminal:

```sh
npm --prefix contracts run deploy:local
npm --prefix contracts run lending:local
npm --prefix frontend run contracts:sync
npm --prefix frontend run lending:sync:local
npm --prefix frontend run dev
```

Fixtures deploy only to local chain 31337 and exercise lending before writing local manifests. Sync commands generate ignored development environments and public ABI modules. Local state resets when the node restarts. Never send real funds to Hardhat accounts.

## Checks

With the local node and fixtures available:

```sh
npm --prefix contracts run typecheck
npm --prefix contracts run compile
npm --prefix contracts test
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run env:testnet
npm --prefix frontend run build:testnet
```

`build:testnet` exports public deployment configuration into the build process; `npm run build` uses Webpack explicitly. Frontend integration tests require the local node and must not be reported as passing when skipped. CI creates local fixtures and needs no deployer key or live-chain transactions.

## Environment and deployment

Both workspaces provide placeholder-only `.env.example` files. Do not put signer credentials anywhere in `frontend/` or in a `NEXT_PUBLIC_*` variable. Generate public testnet values from committed confirmed manifests with `npm --prefix frontend run env:testnet`. This writes an ignored `.env.vercel-preview` for local build verification; it does not change Vercel settings.

Required public values: `NEXT_PUBLIC_AME_NETWORK`, `NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL`, AME agent/receipt addresses and deployment blocks, lending address/deployment block, and `NEXT_PUBLIC_AME_TEST_FAUCET=1` for the deployed capped test fixtures. See [environment template](frontend/.env.example).

The existing Vercel application uses framework Next.js, Node 24.x, root **frontend**, and build command **npm run build**. Its existing Git connection and environment configuration are managed separately; publishing this official repository does not automatically migrate that connection or enable previews. No contract deployment is required for frontend builds or PRs.

Canonical evidence:

- [Identity and receipt deployment](contracts/deployments/robinhood-testnet.json)
- [Lending/assets/oracle deployment and risk parameters](contracts/deployments/lending-robinhood-testnet.json)
- [Confirmed testnet lending lifecycle](contracts/deployments/lending-testnet-verification.json)
- [Lending design and limitations](contracts/LENDING.md)
- [Frontend integration](frontend/LENDING.md)
- [Holder access, launch configuration and trust boundaries](frontend/HOLDER_ACCESS.md)
- [Pre-token launch audit, activation checklist, rollback and performance boundaries](frontend/LAUNCH_READINESS.md)
- [Verified AME token recognition and disabled premium entitlements](frontend/TOKEN_ACTIVATION.md)
- [Mainnet read-only integration](frontend/MAINNET.md)
- [Mainnet activation and wallet acceptance checklist](frontend/MAINNET_ACCEPTANCE.md)
- [Deploy Agent behavior, QA and identity deployment procedure](frontend/DEPLOY_AGENT_QA.md)
- [Frontend deployment requirements](frontend/VERCEL.md) (the monorepo Vercel root is `frontend`)

## Security and review

No private keys, wallet files, credentials, private RPC URLs, local environments or build caches belong here. Public addresses, ABIs, transaction hashes and chain configuration are intentionally included. Public deployment scripts require explicit authorization; CI never executes them. Mock pricing, economic, liquidation and Sybil limitations remain unresolved for real-value use.

Use `feature/*` branches, PRs and review as described in [Security and review](SECURITY.md). No repository-wide license has been selected; existing file-level notices are preserved.

## AME Tasks V2

The `/tasks` terminal provides live mainnet contract research and transaction-analysis tools, wallet-authorized task verification, and profile history integration. Six guided task categories define 10/20/30/20/25/35 Task XP (140 across the current policy). Versioned rewards preserve historical amounts; current ownership-epoch XP is separate from historical activity, with lifetime category locks against transfer farming. A dedicated free Redis store is configured and real-store concurrency/restart tests pass. Production XP writes remain disabled pending genuine wallet-signed completion acceptance. Evidence reads and analysis checks award no XP. Task XP grants no financial permissions and is separate from repayment reputation. See [Tasks V2 architecture, API and release gates](frontend/TASKS.md).
