# AME pre-token launch readiness

This is an engineering checkpoint, not token, market, or security approval. No production environment values, deployed contracts or signing permissions are changed by this release. Mainnet signing is absent, independently of token configuration.

## Capability inventory

| Surface | Classification | Verified implementation / limit |
| --- | --- | --- |
| App Router, homepage, Docs, Protocol V2, header | OPERATIONAL | Production route checks; original hero, CTA, diagrams and navigation retained. |
| Wallet adapter | OPERATIONAL | Mainnet-first configuration; chain-independent connection, explicit switches, rejection/disconnect/account-change tests. Actual browser MetaMask acceptance is still required. |
| Identity NFT | OPERATIONAL on testnet | AMEAgent runtime verification, simulation, duplicate-submission lock, receipt/event/transaction matching and owner reads. No mainnet identity deployment. |
| Identity ownership/delegation | OPERATIONAL | ERC-721 owner and assigned wallet; transfer clears assignment. Assignment is not evidence of key control or a financial authorization. |
| Core receipts | PARTIAL | Owner/assigned wallet may append attestations. The contract permits repeated data hashes and self-attestation; neither implies independently verified execution. |
| Agent directory/history | PARTIAL | Bounded/paginated events and current owner checks; no durable incremental index or guaranteed indexer SLA. Long histories can still be expensive. |
| Reputation | PARTIAL | Narrow deterministic testnet repayment score. General task-weighted scoring, independent verifiers and mainnet reputation are NOT IMPLEMENTED. |
| Lending Terminal V2 | OPERATIONAL code / BLOCKED public access | Existing testnet actions remain behind the unactivated holder gate. Minting does not require AME holdings. |
| Mainnet Morpho reads | OPERATIONAL | Two registry-bound candidates; core runtime, parameters, token precision, accounting and oracle-configuration reads. Fresh snapshots in `reports/launch-markets.json`. |
| Mainnet unsigned actions | PARTIAL | Six adapters, finite/reset allowance drafts, ownership checks, simulation, share bounds and quote-age checks; isolated fork lifecycle passes. |
| Mainnet signing | BLOCKED | No signing implementation; market/oracle/asset review, minimum-proceeds/deadline controls, wallet acceptance and explicit authorization are required. |
| Verified token recognition | PARTIAL / disabled | Server reader and tests implemented. Requires approved live contract, bytecode, metadata and deployment parameters. Header CA is display-only and is not activation evidence. |
| Holder verification | PARTIAL / disabled | Production uses the verified token snapshot; positive configured threshold required separately. No threshold invented. Public balance lookup is not wallet authentication. |
| Protected services | NOT IMPLEMENTED | No new privileged backend service is introduced. Future account-private analytics/service quotas must use signed ownership authentication, nonce expiry and replay prevention; do not reuse public eligibility as an authenticated session. |
| API reliability | PARTIAL | Strict bounded bodies, bounded caches/in-flight work, per-instance rate limits, no-store, timings, sanitized structured logs and RPC health. Fleet-wide WAF enforcement/alerts still need operator configuration. |
| RPC failover | PARTIAL | Verified token snapshots retry complete reads across up to three server-configured HTTPS providers, with chain checks and a shared 10-second deadline. Existing Morpho/identity clients retain their existing primary RPC behavior. |
| Monitoring | PARTIAL | Server API status/duration logs and browser CLS/LCP/INP/FCP/TTFB ingestion. Metrics omit wallet identifiers and arbitrary client payloads. No external alert routing, long-term aggregation or field percentile baseline is configured. |
| CI / release | OPERATIONAL | Locked dependencies; contract/frontend/type/build/production checks. Existing authenticated Vercel project and Git integration preserved. |

## Token reader and freshness contract

`/api/token-state` accepts only a wallet address. Clients cannot choose token, RPC, chain, spender or entitlement. It performs reads only. Every activated snapshot validates chain 4663, deployed runtime hash, symbol, decimals and a positive total supply no greater than the explicitly approved atomic maximum. ERC-20 allowances are inspected only for an optional reviewed spender; no approval is requested.

Balances, metadata, supply and allowance use one block two blocks behind the observed head. Block hash is checked again after reads. Two blocks are a reorg buffer, **not** a claim of chain finality. Head timestamps over 120 seconds old or more than 30 seconds in the future are rejected. Select chain-appropriate finality policy during approval.

Snapshot caching is 10 seconds, keyed by wallet and the entire approved configuration. Concurrent identical requests deduplicate; unchanged pinned blocks avoid redundant ERC-20 reads. Failed fresh reads clear success. Whole-snapshot failover does not combine metadata from one provider with balances from another. RPC responses are trusted observations, not independent consensus verification.

After a prior snapshot, incoming/outgoing Transfer logs are inspected over an overlap window of at most 64 blocks. Duplicate self-transfers deduplicate by block hash/transaction/log index. `recentWindowComplete` describes only that recent interval, never full token history. Gaps or log failures do not fabricate events: a fresh full balance snapshot remains authoritative. No persistent indexer is introduced.

The wallet panel reads only while open, connected and on chain 4663; account/network changes isolate query state. Active snapshots refresh every 15 seconds while visible. Unactivated configurations do not poll continuously. Holder prelaunch polling also stops, retaining manual refresh. RPC failures never become a zero balance or a fabricated non-holder result.

## Security findings and release gates

1. **Token information missing:** no official token source, supply/vesting, treasury, admin/proxy policy, deployment receipt or independently verified runtime has been supplied. The previous header CA must be independently confirmed against the eventual approved token. It is not consumed by the reader. Token reads/holder entitlements remain off.
2. **No authenticated privileged backend:** public token/holder queries do not establish address ownership. Existing lending signatures remain contract-authorized. Do not attach private data, higher API quotas or paid operations to these address-only endpoints. Useful future holder utilities are advanced agent analytics, reputation research and higher service limits; none is silently activated.
3. **Receipt trust / duplication:** the deployed core allows self-issued and repeated attestations. This release deduplicates displayed Morpho evidence with chain, source, block hash, transaction and log index, rejects mixed-reorg evidence and checks its anchor block. It does not retrofit independent verification into core receipts or award reputation for them. Changing deployed receipt semantics requires a separate reviewed contract decision.
4. **Morpho market approval remains blocked:** both candidates have 91.5% LLTV. USDe's fixed-primary/deviation-timelock assumptions and USDG/USD peg dependence require approval. syrupUSDG NAV/feed heartbeat, redemption delay and liquidation-depth assumptions remain unapproved. Token issuer/proxy/bridge controls need independent review. Source-service attestations are not an AME audit. See `MAINNET_ACCEPTANCE.md` and current read-only observations.
5. **Adapter boundaries:** exact-share withdrawal bounds share burn, but the direct core cannot enforce quoted minimum assets. The local quote deadline is not an onchain deadline. Verified existing bundle support, authorization and minimum-proceeds/deadline tests are required before signing. Token launch cannot satisfy these gates.
6. **Abuse controls:** the in-memory 60/minute client and 240/minute instance limits and 1024-key bound are best-effort serverless controls, not global quotas. Vercel's trusted platform forwarding header is used only on Vercel. Configure and test edge/WAF limits and alert ownership before unbounded public use; do not weaken limits to hide load failures.
7. **Development dependencies:** the current frontend npm audit returned zero advisories. The contract-development tree returned seven high and one low advisory, including transitive Hardhat/zod/follow-redirects and pinned solc/tmp dependencies. These are not shipped in the frontend. No automatic compiler change or major Hardhat downgrade is applied: isolate CI, keep real-value keys out, and review compatible toolchain fixes while reproducing the exact deployed bytecode before any mainnet deployment.
8. **Monitoring scope:** API timings and numeric web-vital reports are observable in Vercel logs. Browser reports are untrusted diagnostics, never authorization. No production error/alert SLA or long-duration concurrency guarantee has been established.

Morpho's primary [risk documentation](https://docs.morpho.org/learn/resources/risks/) distinguishes oracle, counterparty, liquidation and liquidity risks; its [deployment registry](https://docs.morpho.org/developers/contracts/addresses/) identifies protocol deployments. Core verification does not approve a market's external dependencies.

## Explicit token activation checklist

1. Obtain the owner's approved token contract/source, chain 4663 deployment receipt, deployment block, runtime hash, symbol, decimals, atomic maximum supply, mint/burn/admin/proxy permissions, treasury and vesting documentation. Confirm the header CA matches; never substitute another asset.
2. Independently reproduce source/runtime and inspect implementation/admin slots for proxies. A matching proxy shell alone is insufficient. Obtain independent token security review and explicit token-integration approval. No token deployment, mint or liquidity transaction is authorized by this checklist.
3. Supply server-only `AME_TOKEN_ADDRESS`, `AME_TOKEN_CHAIN_ID=4663`, `AME_TOKEN_RUNTIME_HASH`, `AME_TOKEN_DECIMALS`, `AME_TOKEN_SYMBOL`, `AME_TOKEN_MAX_SUPPLY`, `AME_TOKEN_DEPLOYMENT_BLOCK` and reviewed HTTPS primary/fallback RPCs. Optionally supply a reviewed allowance spender; this grants no approval. Leave `AME_TOKEN_VERIFIED` unset during staging.
4. After approval, enable `AME_TOKEN_VERIFIED=1` in a controlled preview first. Verify non-holder/holder/large balances, metadata mismatch, wrong chain, timeout, fallback, reorg, transfer refresh, account change and disconnection. Check the pinned block and compare with an independent provider. Use actual deployed token data, not test fixtures presented as AME.
5. Keep `AME_HOLDER_THRESHOLD` unset until tokenomics and an exact positive human-unit threshold are approved. Activating verified reads alone does not unlock entitlements. Review the scope of the existing lending product gate separately; token ownership never replaces market collateral, risk controls or contract authorization.
6. Complete actual browser-wallet acceptance, secret review, WAF/monitoring and incident ownership. Public balance queries need no signature; future authenticated service operations require signed account proof with expiry/nonces. Obtain explicit production configuration approval before updating Vercel.
7. Release the approved token configuration separately and record observed block/hash, reviewers and rollback deployment. Do not change `NEXT_PUBLIC_AME_NETWORK`, identity contract addresses or mainnet signing controls as part of token activation.

## Rollback and incident response

- On suspicious metadata/runtime, provider disagreement or stale data: stop activation, leave `AME_TOKEN_VERIFIED` unset (or set `0`) and unset the holder threshold; deploy the previously verified frontend/configuration through the existing project. Do not display cached success as current.
- Preserve diagnostic timestamps/block hashes and sanitized logs. Never log keys, seed phrases, private RPC URLs or wallet-authentication signatures. Do not request seed phrases to recover a tester session.
- Token reader errors fail closed; holders receive unavailable/locked, not invented balances. Frontend rollback cannot pause a permissionless market or undo transactions.
- Keep mainnet signing disabled throughout response. Escalate token-admin/treasury and market incidents to their actual authorized owners. No emergency financial transaction, admin call or token permission change is preapproved.

## Browser wallet acceptance — NOT VERIFIED

Use an actual MetaMask session with explicit tester consent: connect on Ethereum, unsupported chain, Robinhood mainnet and testnet without automatic switching; inspect detected chain/address; reject then accept explicit switches; change accounts; disconnect; verify no stale account data. On mainnet inspect activated token balance/supply/allowance against explorer and a second provider and transfer-driven refresh only after separate real-value approval.

For identity, enter `/deploy`, confirm testnet 46630, inspect exact contract/arguments and simulation, reject a prompt, retry, test duplicate clicks, insufficient gas and RPC loss, confirm a testnet receipt, extract the real token ID, verify owner/metadata/explorer and `/agents`. Check replaced/reverted/pending recovery. Do not send a mainnet NFT or lending transaction. Testnet workflow requires separate tester approval for the wallet prompt; automated local/fork tests are not browser acceptance.

## Performance measurement and budgets

Use `node scripts/launch-benchmark.mjs http://127.0.0.1:3119` for 24 controlled read requests at concurrency 4. An explicit `--public` permits only six read requests at concurrency 2. No write RPC or financial transaction is generated. `Server-Timing` and structured `ame_api` events expose endpoint status/duration; numeric `ame_web_vital` events expose CLS/LCP/INP/FCP/TTFB without account or URL identifiers.

Record p50/p95 and errors from measured reports, not invented live-user statistics. Regression budgets: compare the same machine/origin/cache state against `reports/launch-baseline.json`; investigate endpoint p95 over twice that baseline or any unexpected 5xx/429 in the bounded test. Cold health requests include upstream RPC time; cached health and disabled-token checks must be compared separately. These are diagnostic release budgets, not an SLA. Field Core Web Vitals and real-wallet submission/confirmation percentiles remain unverified until actual users and approved wallet tests provide samples.

### Local measurement limitation

The development machine clock was approximately 11 minutes behind both the observed chain head and Vercel HTTP Date. The local 24-request/concurrency-4 baseline returned 16 successful disabled-token/holder responses and 8 correctly rejected health responses (503). This is not a clean load pass. The clock guard was not relaxed and no system clock setting was changed. The initial run also lacked the environment's system CA option; local verification uses Node `--use-system-ca`, never disabled TLS validation. Production health must be checked separately on Vercel's clock. Recorded `measuredAt` / `observedAt` strings from this machine are host-clock observations, not trusted UTC; onchain block timestamps are reported independently.
