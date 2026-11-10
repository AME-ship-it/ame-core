# Phase 04 — Executed QA

Date: 2026-10-15 (America/Guayaquil).

## Passed

- `npm run compile`: two Solidity source files compiled with solc 0.8.28, Cancun target and optimizer enabled.
- `npm run typecheck`: Hardhat config, deployment script, generated ABI types and tests pass.
- `npm test`: 15 Node.js/Viem tests pass against Hardhat's local EVM.
- Agent checks: mint to caller, ownership, ERC-721/metadata interfaces, sequential IDs, nonzero assigned wallet, metadata pointer, owner updates and events.
- Invalid agent IDs checked at 0, 2 and 999 for reads and owner mutations; invalid wallet/metadata do not consume IDs.
- Unauthorized mutations rejected for strangers, assigned wallets and approved ERC-721 operators; unauthorized transfers rejected.
- Transfer checks: new ownership, automatic wallet revocation, old owner/wallet denied issuance, new owner allowed reassignment, historical receipt retains original issuer.
- TASK, PAYMENT, SWAP and ACTION each verified for sequential receipt ID, agent ID, issuer, timestamp, hash, URI and event fields.
- Receipt checks: invalid agent/receipt IDs, unauthorized issuer, replaced wallet, empty hash/URI, invalid enum and invalid registry addresses all rejected.
- Receipt registry has no update/delete methods. Failed issuance does not consume IDs.
- `npm run deploy:local`: both contracts deployed by RPC to localhost chain 31337; mint and all four receipt types succeed. Manifest records deployment addresses, confirmed transaction hashes, block numbers and smoke transactions.
- Frontend `npm run build` and `npm run typecheck` passed. No frontend contract integration or approved UI changes were made.

## Diagnosed and fixed

- Hardhat's compiler-download cache mutex timed out. Config now resolves the exact official solc npm package locally; compilation succeeds.
- A test assertion needed explicit narrowing for the generated ABI union. Corrected it, reran typecheck and all 15 tests successfully.

## Deployment evidence

- AMEAgent: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- AMEReceipt: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
- See `deployments/localhost.json` for the full deployment and smoke-test transactions.
- These addresses belong only to the executed development node. Restarting it resets the chain; this is not a Robinhood Testnet/Mainnet deployment.

## Explicitly pending

Real MetaMask QA was not executed inside Codex and has not passed. The user authorized deferring it and proceeding with phase 04 on 2026-10-15. No simulated wallet test was rerun or counted as real MetaMask validation in this phase.

Public-network deployment and frontend integration were not performed. This is a tested contract core, not an independently audited production release.
