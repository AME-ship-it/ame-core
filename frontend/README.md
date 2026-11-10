# AME — Vercel and public testnet readiness

Next.js App Router, TypeScript, Tailwind, Wagmi and Viem. Node.js 24.x. See VERCEL.md for production setup and environment requirements.

## Local setup

In the sibling ../ame-contracts project:

```sh
npm ci
npm run compile
npm run node
```

Keep that terminal running. In a second terminal in the contract project:

```sh
npm run deploy:local
```

Then from this frontend directory:

```sh
npm ci
npm run contracts:sync
npm run dev
```

contracts:sync reads the compiled AMEAgent ABI/runtime bytecode and deployment manifest into lib/generated/agent.ts. Run it after every deployment, then rebuild/restart the frontend. Local runtime-code checks reject missing/incompatible contracts. Restarting Hardhat clears local state; these identities are not public deployments.

## Configuration

lib/chains.ts owns network configuration; lib/contracts.ts owns address, ABI and deployment start block. Components contain no contract addresses. Development defaults to localhost (31337); production defaults to Robinhood Chain Testnet (46630) and rejects localhost.

Copy .env.example to .env.local for overrides. NEXT_PUBLIC_AME_NETWORK supports localhost, testnet and mainnet. Robinhood networks require an explicit NEXT_PUBLIC_AME_AGENT_ADDRESS and NEXT_PUBLIC_AME_AGENT_DEPLOYMENT_BLOCK; local addresses do not fall back to public networks. Public RPC overrides are supported. Environment changes require a rebuild. No private keys belong in these variables.

## Routes

- / preserves the approved visual composition. Main CTA routes to /deploy; hero data remains clearly illustrative.
- /deploy checks wallet, network and contract, simulates mint, requests the transaction, waits for confirmation, decodes the real AgentMinted event, verifies owner and links to /agent/[id].
- /agent/[id] reads owner, assigned wallet and metadata. Creation time comes from the mint event's block. Missing IDs and RPC failures have separate states.
- /agents derives candidates from Transfer events, then verifies current ownerOf. Account/network changes and periodic refresh update the list. Full-history reads suit local development; large histories/RPC range limits may need future pagination.

Optional agent wallet defaults explicitly to the owner, because the contract requires a nonzero address. Metadata is an inline JSON URI created for the real mint. The contract assigns the ID.

REGISTERED means NFT existence, not active execution. UNRATED, NOT TRACKED and NOT LOADED are explicit availability labels. The core does not store reputation, task counts, volume or earnings. Receipt counts are not loaded; no receipt UI or reputation calculation was added. No zero metrics are fabricated.

## Transaction recovery

Disconnected/wrong-network states prevent minting. Signature request, rejection, submitted, pending, confirmed, reverted, RPC failure and unknown failure are distinct. A controller lock prevents concurrent clicks. The submitted hash and original owner are saved in localStorage. Reload rechecks instead of submitting again. Pending/unknown transactions retain their hash and offer RECHECK TRANSACTION. Confirmed/reverted attempts can be explicitly reset. Repriced transactions follow replacement hashes; unrelated replacements do not report successful minting.

Real approval requires a wallet-enabled browser. Mobile needs an injected wallet browser and a reachable RPC; 127.0.0.1 on a separate phone points to that phone. No tunnel or public node exposure was configured.

## QA

With synchronized local contracts running:

```sh
npm test
npm run typecheck
npm run build
```

25 frontend tests: 9 connector tests, 9 local-EVM integration tests and 7 production configuration tests. Production HTTP route checks add 7 tests via npm run test:routes. npm run test:flow runs only integration tests; it creates/transfers development NFTs and mines an intentionally reverted transaction. The injected test bridge is not MetaMask.

Real MetaMask QA remains pending and was not executed inside Codex. Browser checks cover disconnected controls, real read-only profiles, refresh persistence, invalid IDs, responsive layout and console/hydration errors. See QA.md and ../contracts/REVIEW.md.

No public Robinhood deployment, backend, database, indexer, receipts UI, trading, reputation engine, AI runtime or token mechanics were implemented.

## Phase 06 — Production readiness update

See VERCEL.md for current hosting instructions and environment requirements. Production builds now default to Robinhood Testnet (46630), reject localhost selection, and require explicit public contract address/deployment-block configuration. Localhost remains the default only for development/test execution. Do not carry a localhost .env.local override into a production build.

The routes /activity, /treasury and /score deliberately show NOT AVAILABLE states. They do not implement new product logic or fabricate live data. Missing public contracts disable minting/reads visibly while keeping all routes renderable.

META MASK QA: NOT VERIFIED


## Phase 07 configuration update

Testnet deployment is currently BLOCKED: signer unavailable. See VERCEL.md for signer setup, resumable deployment and verified-manifest env export. No deployed testnet addresses are claimed.

Local deployment data no longer enters runtime modules. contracts:sync writes ABI/bytecode to source and local addresses to ignored .env.development.local. npm run dev loads that development file; npm test explicitly loads it. Production never does. Both AMEAgent and AMEReceipt address/block fields are centralized in lib/contracts.ts.

After a confirmed testnet deployment, env:testnet generates exact public .env.vercel-preview values and build:testnet explicitly builds with them. Neither command creates a signer or invents addresses.

META MASK QA: NOT VERIFIED

## Confirmed public testnet deployment

Both AME contracts are now deployed and verified on Robinhood Chain Testnet 46630. .env.vercel-preview contains the exact public values; npm run build:testnet successfully builds with them. npm run test:testnet runs read-only public verification. See VERCEL.md and testnet-verification.json for addresses, deployment blocks and executed checks. No public NFT was minted during deployment verification.

META MASK QA: NOT VERIFIED
