# Phase 06 — Vercel and public testnet readiness

## Verified scope

The frontend can build and serve without Hardhat, a wallet provider, or a configured public contract. A missing public AMEAgent deployment is a visible unavailable state. No local contract address or fake agent state is substituted.

No Vercel deployment or public-chain contract deployment was performed in this phase.

## Vercel project settings

- Root Directory: this frontend directory (`outputs/ame` if the repository contains the complete workspace).
- Framework Preset: Next.js. `vercel.json` declares the preset and `npm run build`.
- Node.js: 24.x, pinned in package.json and supported by Vercel.
- Install: npm ci (package-lock.json included).
- Build: npm run build. Keep the default Next.js output directory; do not configure static export.
- No Solidity compilation or sibling contract checkout is needed for deployment. The compiled ABI is already generated into frontend source.

## Production and Preview environment

| Variable | Value / requirement |
| --- | --- |
| NEXT_PUBLIC_AME_NETWORK | `testnet` recommended. An unset value defaults to testnet in production builds. |
| NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL | Optional override; defaults to the official public HTTPS testnet RPC. Use a browser-compatible/CORS-enabled public endpoint. |
| NEXT_PUBLIC_AME_AGENT_ADDRESS | Real AMEAgent address deployed on the selected chain. Leave empty until one exists. No placeholder or localhost address is filled automatically. |
| NEXT_PUBLIC_AME_AGENT_DEPLOYMENT_BLOCK | Actual block number where that AMEAgent was deployed. Required alongside its address for event-derived reads. |
| NEXT_PUBLIC_ROBINHOOD_MAINNET_RPC_URL | Optional future mainnet RPC override; mainnet is never selected by default. |

All NEXT_PUBLIC values are public build-time inputs. Redeploy after changes. Do not put private keys or server-only credentials in these values. Public RPC defaults are rate-limited infrastructure, not an availability guarantee.

Missing/malformed/zero contract addresses and missing/invalid deployment blocks disable contract operations with a visible message. Invalid network names, localhost production selection, and non-HTTPS/loopback public RPC URLs fail configuration validation instead of silently using local development resources.

Local development retains `npm run dev` and localhost chain 31337. To select it explicitly, use a development-only .env.local with NEXT_PUBLIC_AME_NETWORK=localhost. Remove/change that override before a production build. Never copy the localhost setting into Vercel Production or Preview.

## Routes

| Route | Current behavior |
| --- | --- |
| / | Approved home composition and explicitly illustrative hero; configuration indicator uses the existing system line. |
| /deploy | Existing wallet flow; visible contract-unavailable status and disabled mint if deployment is absent. |
| /agents | Wallet-dependent ownership list; no contract reads when configuration is missing. |
| /agent/[id] | Real profile reads only when configured. Missing config is not disguised as an agent-not-found result. |
| /activity | Explicit NOT AVAILABLE state; no receipts UI or invented history. |
| /treasury | Explicit NOT AVAILABLE state; no fake balances or trading. |
| /score | Explicit NOT AVAILABLE state; no reputation calculation or fake score. |

## Checks

With the local development node/deployment available for the existing integration tests:

```sh
npm run typecheck
npm test
npm run build
npm run start
```

In another terminal, with that production server running and no testnet contracts configured:

```sh
npm run test:routes
```

Executed: typecheck PASS, 25 frontend tests PASS, production build PASS, 7 production HTTP-route tests PASS. All seven routes were also inspected in the production browser. Console/hydration checks were clean; the missing-contract deploy state was reviewed at desktop and 320px without horizontal overflow. The public testnet RPC returned eth_chainId 0xb626 (46630).

The unit suite includes production-default/configuration isolation checks. Existing local integration tests execute real transactions on Hardhat; they do not verify public-testnet contracts or MetaMask browser approval.

## Remaining work

META MASK QA: NOT VERIFIED

Real MetaMask QA was not executed inside Codex. This remains documented and is not an engineering blocker for this readiness phase. No new browser access was requested.

No public contract address is configured. To enable public onchain reads/minting, deploy the reviewed contract to Robinhood Chain Testnet, record the actual address/block, configure Vercel Preview/Production and rebuild. Public minting cannot be claimed tested until that deployment and its wallet flow are verified. Large event histories may still require pagination beyond the current local-oriented owner enumeration.

References: [Vercel Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Next.js public environment values](https://vercel.com/academy/nextjs-foundations/env-and-security), [Robinhood network configuration](https://docs.robinhood.com/chain/connecting/).

## Phase 07 — Testnet deployment integration (signer pending)

Deployment status: BLOCKED: signer unavailable.

No public deployment was attempted. The user is configuring AME_TESTNET_PRIVATE_KEY locally in the contracts project. Its value is never printed, copied into the frontend or stored in deployment artifacts. The current preflight evidence is ../contracts/deployments/robinhood-testnet.status.json; this is NOT a deployed-contract manifest.

After configuring a dedicated funded testnet signer, run from the contracts project:

```sh
npm run preflight:testnet
npm run deploy:testnet
```

The deploy command loads the ignored contracts-project .env, uses Node's system CA trust store, checks chain 46630 and funding, deploys the unchanged AMEAgent, then AMEReceipt with the confirmed agent address as its sole constructor argument. It confirms two blocks, records each transaction hash immediately, saves confirmed addresses/blocks/runtime hashes, verifies receipts/deployer/code and checks AMEReceipt.agentRegistry. Partial/pending records allow resumption. No test mint or receipt is automatically written on public testnet.

Only after the actual completed deployments/robinhood-testnet.json exists, from this frontend project:

```sh
npm run env:testnet
npm run build:testnet
```

This exports .env.vercel-preview containing only exact public chain/RPC/agent-address/receipt-address/deployment-block values from that confirmed manifest. Enter those values in Vercel Preview and rebuild. No placeholder addresses or deployment blocks are generated when deployment evidence is missing.

Production runtime now imports only generated ABI/bytecode, never a local deployment file. Local configuration is generated into ignored .env.development.local by contracts:sync and is loaded only by development/test commands. Production's Wagmi transport contains only its selected public chain; no Hardhat fallback is present. Receipt config is mapped independently and contractsConfigured reports whether both deployments are configured.

Verified: 19 contract/preflight tests; 27 frontend tests; contract and frontend typechecks; production build; 7 production routes plus production bundle scan. All passed. Testnet RPC connectivity, chain 46630 and gas price were read successfully using the official endpoint. Mint constructor/calldata and ABI compatibility are tested; actual testnet contract bytecode, minting and agent reads remain unverified until deployment.

META MASK QA: NOT VERIFIED

## Phase 07 — Actual deployed testnet configuration

The previous signer blocker is resolved. Both contracts are confirmed on chain 46630:

| Contract | Address | Deployment block |
| --- | --- | --- |
| AMEAgent | 0xAC214EeDeA040f247962C87eF779dEBdBc86727c | 136170413 |
| AMEReceipt | 0x66dEb73680BD9B3FEEF932ec683B31492C11B94e | 136170473 |

The exact public Vercel Preview values are now in .env.vercel-preview. Enter those six NEXT_PUBLIC values in the Preview environment. No private key belongs in Vercel.

npm run build:testnet passed with the real values. The new build-testnet.mjs launcher passes public values through the child process environment, avoiding the Next.js worker incompatibility with a parent --env-file flag. The default unconfigured build remains available for safe missing-env checks.

Executed verification:
- 19 contract tests PASS and contract typecheck PASS; Solidity unchanged.
- 27 frontend tests PASS and frontend typecheck PASS.
- 5 read-only public testnet checks PASS via npm run test:testnet: deployment receipts, creation bytecode/constructors, runtime bytecode/hash, registry binding, exact frontend ABI/config, mint calldata, nonexistent ID and owner-event reads.
- 8 configured production route/runtime checks PASS. For this configured build run tests with AME_QA_CONTRACTS_CONFIGURED=1.
- Production browser: /deploy has no missing-contract warning, and /agent/1 reads the real testnet registry and correctly reports not found. No agent has been minted by these deployment checks. Console/hydration checks were clean.

Report: testnet-verification.json. Manifest: ../contracts/deployments/robinhood-testnet.json.

No Vercel-hosted Preview URL has been published yet. The production artifact and exact public environment are ready for that publication.

META MASK QA: NOT VERIFIED

## 2026-10-18 — Build recovery and AME V2 baseline

Development and production now explicitly use Webpack: `npm run dev` runs `next dev --webpack --hostname 127.0.0.1`; `npm run build` runs `next build --webpack`. `npm run build:testnet` uses the same bundler and loads the existing public testnet environment. The previous Turbopack failure occurred while starting the PostCSS worker (worker exited before connecting); no CSS or Web3 logic was changed.

Vercel root: this existing `outputs/ame` frontend directory. Node: 24.x. Build: `npm run build`. Keep the default Next.js output directory. Vercel must receive the following public build-time variables (the ignored `.env.vercel-preview` is not automatically loaded by `next build`):

| Variable | Existing testnet value |
| --- | --- |
| NEXT_PUBLIC_AME_NETWORK | testnet |
| NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL | https://rpc.testnet.chain.robinhood.com |
| NEXT_PUBLIC_AME_AGENT_ADDRESS | 0xAC214EeDeA040f247962C87eF779dEBdBc86727c |
| NEXT_PUBLIC_AME_AGENT_DEPLOYMENT_BLOCK | 136170413 |
| NEXT_PUBLIC_AME_RECEIPT_ADDRESS | 0x66dEb73680BD9B3FEEF932ec683B31492C11B94e |
| NEXT_PUBLIC_AME_RECEIPT_DEPLOYMENT_BLOCK | 136170473 |

Local integration test prerequisites, in order: run `npm run node` in the sibling contracts workspace; in another terminal there run `npm run deploy:local`; in this frontend run `npm run contracts:sync`, then `npm test`. Only local deployment records and development-only environment values change. Stop the test node when finished; its state is ephemeral and must be recreated next time. Public deployment values must remain unchanged.

The Webpack build reports unresolved optional connector-package warnings from Wagmi's connector exports. They are not suppressed and do not fail the build; the application uses the existing injected connector. No dependencies or wallet logic were changed. META MASK QA: NOT VERIFIED. Real-wallet QA is separate from build readiness. No Vercel or public-chain deployment was performed during recovery.
