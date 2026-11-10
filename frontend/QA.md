# QA — Phase 03 Web3 Core

## Passed

- Production build: `npm run build` (Next.js 16.4.1).
- TypeScript: `npm run typecheck`.
- Nine automated tests: `npm test`.
- Actual Wagmi injected connector tested against an isolated EIP-1193 test provider: correct default configuration, connection, wrong network, rejected switch, successful switch, changed account, disconnect, rejected connection/retry, missing provider, session restoration without a second permission request, account revocation, adding unknown chain, wallet-side chain changes, pending/offline/generic error messages.
- Production browser: disconnected wallet/network states, provider-unavailable feedback and retry dialog.
- Desktop and mobile 320px: visual review and no horizontal overflow.
- Browser production console: no warnings, errors or hydration errors observed.
- Public Robinhood Testnet RPC: `eth_chainId` returned `0xb626` (46630).
- Existing home route and agent mock labeling retained. No contracts or signature/transaction requests added.

## Requires manual wallet validation

The available in-app browser has no MetaMask provider. Therefore real MetaMask approval/rejection, real chain switching, extension reload persistence and physical mobile wallet connection have NOT been manually verified. Automated provider tests are explicitly simulations, not evidence of a real-wallet session.

1. Open AME in a browser with MetaMask, or its mobile in-app browser.
2. Connect, reject once, retry and approve; confirm shortened address.
3. Start on another network; confirm WRONG NETWORK, switch to Robinhood Chain Testnet and approve adding it if needed.
4. Reject one switch; verify feedback and retry.
5. Change account/network in MetaMask; confirm UI updates.
6. Reload while connected; verify restoration without a fresh permission prompt.
7. Disconnect, reload and confirm the app stays disconnected.
8. Check mobile layout for the connected and switching states, and check console.

Real MetaMask validation remains pending and was not executed inside Codex. On 2026-10-15 the user explicitly deferred this browser-blocked QA and authorized phase 04 contract development. This does not mark wallet QA as passed or authorize public deployment.

## Phase 03.5 — Real MetaMask QA attempt

Status: DEFERRED BY USER — real MetaMask provider unavailable in the accessible browser environment; real-wallet QA was not executed inside Codex and has not passed.

Observed on 2026-10-15:
- Browser inventory exposes only Codex In-app Browser and Codex MCP Apps.
- Explicit attempt to open Chrome returned: Browser is not available: chrome.
- No real MetaMask connection, approval, rejection, account rendering, chain switch, reload persistence or connected responsive state was validated in this phase.
- Previous simulated-provider tests are not counted as real-wallet validation.
- Application source and approved UI remain unchanged. No contracts or product features were started.
- Build/typecheck results above belong to phase 03; they were not rerun because application source and dependencies are unchanged.

Required to resume: make a browser with installed, unlocked MetaMask accessible to Codex. Wallet unlocking or initial wallet setup must be completed by the user. Once available, rerun the complete requested real-wallet checklist and record actual results before declaring this phase passed.


## Phase 04.5 + 05 — Contract review and real local mint

Contract review: no critical issue found within scope. Both Solidity sources unchanged; see ../contracts/REVIEW.md. Existing 15 contract tests passed again. Hardhat compile reported no contract changes.

Frontend: /deploy, /agent/[id] and /agents implemented. Chain defaults to local 31337. Generated ABI/deployment manifest feed lib/contracts.ts; public-network switching requires explicit deployment configuration.

Executed:
- Frontend build PASS; /, /deploy, /agents and /agent/[id] generated successfully.
- Frontend typecheck PASS.
- 18 frontend/connector tests PASS: 9 existing connector tests updated for localhost, plus 9 actual local-EVM integration tests.
- Real mint through Wagmi action/shared controller: ID from AgentMinted, owner verified, optional assigned wallet and inline metadata persisted.
- Omitted wallet defaults to owner; concurrent controller submission blocked; resumed confirmation does not mint again.
- Rejected transaction, wrong chain, invalid wallet, invalid/nonexistent ID, event-derived ownership after transfer, mined revert and RPC failure tested.
- Browser: /deploy disconnected state and disabled mint; /agent/1 real owner/wallet/URI/block timestamp; reload retains onchain data; numeric missing ID and invalid-string ID show clean not-found states.
- Desktop and 320px profile visually reviewed; no horizontal overflow. Production browser console showed no warnings/errors or hydration failures.

Availability, not fake metrics: REGISTERED derives from existence. createdAt derives from the mint event's block. Reputation is UNRATED; tasks, volume and earnings are NOT TRACKED. Receipt counts are NOT LOADED. No fake zeros or runtime activity are claimed. Agent enumeration scans Transfer history and checks ownerOf; large deployments need future RPC pagination.

MetaMask QA remains pending. No real MetaMask browser transaction, approval/rejection or connected success-screen interaction was executed inside Codex. Automated injected transport tests use real local transactions but do not certify MetaMask QA. Connected success/transaction UI is implemented; real-wallet browser QA is still required.

Local deployment addresses and transaction evidence are in ../contracts/deployments/localhost.json. Local chain state resets when its node restarts. No Robinhood public deployment was made.

Final verification: deploy and profile screens also reviewed at 320px; agents-to-deploy navigation works, no horizontal overflow, production console remained clear. Final build and typecheck rerun after the retry-state adjustment both passed.

## Phase 06 — Vercel + public testnet readiness

META MASK QA: NOT VERIFIED

Real MetaMask QA was not executed inside Codex and is not marked passed. The user explicitly authorized continuing despite that environment limitation. No browser access request was made for MetaMask in this phase.

Passed:
- Frontend typecheck.
- Full frontend suite: 25/25 (18 existing connector/local-EVM tests plus 7 production configuration tests).
- Optimized production build: /, /deploy, /agents, /agent/[id], /activity, /treasury and /score generated successfully.
- Production HTTP route checks: 7/7 at /, /deploy, /agents, /agent/1, /activity, /treasury and /score.
- All seven routes inspected in the browser against that production build with no public contracts configured. Visible unavailable configuration; no console warnings/errors or hydration issues observed.
- Desktop and 320px deployment state reviewed; no horizontal overflow.
- Official public Testnet RPC eth_chainId returned 0xb626 (46630).

Config changes: production defaults to testnet; localhost is rejected in production and public RPC URLs require remote HTTPS. Missing/invalid address or deployment block is visible and disables operations rather than throwing a rendering error. Public networks never inherit the local deployment address. Node 24.x pinned; Vercel framework/build settings and .env.example included.

/activity, /treasury and /score are honest unavailable-module pages, not implemented receipt, treasury or score features. No live contract state, balances or metrics were invented. Existing approved visual composition, CSS, asset and motion files were not redesigned.

No Vercel publication or Robinhood contract deployment was executed. Actual public address/deployment block remain required to enable public minting and reads. Details in VERCEL.md.

## Phase 07 — Testnet signer handoff

BLOCKED: signer unavailable

No testnet deployment command was executed. A funded signer was not available in the contracts project environment or .env at the final presence-only check. No private key was read into model output, printed or copied into frontend values. No contract address, transaction hash, block or deployer identity was fabricated.

Independent QA passed:
- Contract compile: up to date, unchanged Solidity.
- Contract project typecheck PASS; 19 tests PASS (15 core tests plus constructor/calldata/manifest validation).
- Frontend typecheck PASS; 27 tests PASS (including independent receipt env mapping and exact compiled ABI compatibility).
- Production build PASS with Testnet default and no public contract addresses.
- 8 production checks PASS: 7 HTTP routes and a bundle scan excluding local RPC endpoints, chain 31337, localDeployment, local manifest path and Windows workspace paths.
- Public Testnet RPC verified chain 46630, block access and gas price. Node's system certificate store resolved a local TLS trust issue without disabling certificate verification.

Deployment scripts/manifest journal and exact-env exporter are ready. export-testnet-env refuses to generate values without a completed confirmed manifest. Actual testnet bytecode existence, contract ownership/profile reads, and live public mint remain NOT VERIFIED because deployment has not happened.

Structured non-deployment status: ../contracts/deployments/robinhood-testnet.status.json.

META MASK QA: NOT VERIFIED

## Phase 07 — Public deployment completed

Previous signer/funding blockers resolved. Both contracts are confirmed on actual Robinhood Chain Testnet 46630, with nonempty bytecode verified. No public deployment was simulated and no local chain was used as a fallback.

AMEAgent: 0xAC214EeDeA040f247962C87eF779dEBdBc86727c, block 136170413.
AMEReceipt: 0x66dEb73680BD9B3FEEF932ec683B31492C11B94e, block 136170473.
Deployment tx hashes and runtime hashes are in ../contracts/deployments/robinhood-testnet.json. Constructor tx inputs match compiled artifacts; AMEReceipt.agentRegistry matches AMEAgent.

Exact production env generated to .env.vercel-preview and loaded into the successful npm run build:testnet. Fixed the --env-file/Next worker incompatibility by using a child environment launcher rather than forwarded Node flags.

Passed again: 19 contract tests, 27 frontend tests, both typechecks, production build, 5 actual read-only public testnet checks, 8 configured production route/runtime checks. Local regression tests remain isolated regressions, not public deployment evidence. Public evidence is testnet-verification.json and confirmed chain receipts/code.

Browser verifies /deploy recognizes the real config and /agent/1 reads public testnet then returns not found. Owner discovery queried Transfer logs from block 136170413 and correctly found no deployer-owned agents. No fake metrics or public sample mint were added. Event decoding regression passes with the ABI proven to match deployed creation input; no public AgentMinted event was fabricated.

META MASK QA: NOT VERIFIED

No Vercel-hosted deployment was executed; exact Preview env and build are ready.

## 2026-10-18 — Build recovery verified

- Production build: PASS via `npm run build` (`next build --webpack`), with all six existing `.env.vercel-preview` public values loaded into the process environment as on Vercel. All seven functional routes compile.
- Frontend suite: 27/27 PASS after starting the existing local Hardhat node, running the existing local deployment script, and synchronizing the local development environment.
- Contract suite: 19/19 PASS, no Solidity changes or compilation required.
- Public testnet verification: 5/5 PASS, including both deployed runtime hashes and registry binding on chain 46630. Public addresses unchanged; no public transactions sent.
- Configured production HTTP routes and bundle isolation: 8/8 PASS. Client chunks contain no local RPC endpoint, Hardhat chain ID, local deployment imports or Windows workspace paths.
- All 15 protected Web3, ABI, public configuration, Solidity and public manifest files match their pre-recovery SHA-256 hashes.
- Default development, production and explicit testnet-build commands now use Webpack consistently. Optional Wagmi connector module warnings remain visible and nonfatal. No dependencies installed.
- Temporary local test state is ephemeral. Recreate the local node/deployment and synchronize before future integration runs.
- META MASK QA: NOT VERIFIED. This is separate from build readiness.
- AME V2 visual redesign may proceed. No UI redesign, Vercel publication or public-chain deployment was performed.
