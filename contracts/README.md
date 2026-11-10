# AME — Phase 04 Smart Contract Core

Standalone Solidity/Hardhat project. The approved Next.js frontend is untouched and does not import these contracts, ABIs or deployment addresses.

## Run

Use Node.js 22.13+ (Node.js 24 was used for validation).

```sh
npm ci
npm run compile
npm run typecheck
npm test
```

Start the local node in one terminal, then deploy from another terminal in this directory:

```sh
npm run node
```

```sh
npm run deploy:local
```

The deployment script only targets localhost, verifies chain ID 31337, deploys both contracts, mints a sample agent, writes all four receipt types and saves transaction hashes in `deployments/localhost.json`. It creates a new pair of contracts on every run. Local node state is ephemeral; restarting the node clears the deployments. No public-chain deployment configuration or private keys are used.

## Toolchain

Hardhat 3.19.0, OpenZeppelin Contracts 5.6.1, Viem 2.57.7 and solc 0.8.28. Compiler settings: Cancun EVM, optimizer enabled, 200 runs. The exact solc npm package is resolved locally to avoid reliance on Hardhat's shared compiler-download cache. The package lock records dependency versions.

## Agent identity

`AMEAgent` is an OpenZeppelin ERC-721 named AME Agent, symbol AME.

- `mint(agentWallet, metadataURI)` mints to the caller. Minting is free and permissionless in this core phase; IDs start at 1 and increase globally.
- Wallets must be nonzero and metadata pointers must be nonempty. Assignment links an address; it does not create a wallet or custody funds. The same address may be assigned to multiple agents.
- `ownerOf`, `agentWalletOf`, and `tokenURI` revert for nonexistent agents, including ID 0.
- Only the current NFT owner can call `setAgentWallet` or `setMetadataURI`. ERC-721-approved operators and assigned agent wallets cannot edit these fields.
- ERC-721 transfers are supported. A transfer to another owner clears the assigned wallet and emits `AgentWalletUpdated`. The new owner must explicitly assign a wallet. Self-transfers preserve the wallet. Metadata remains attached to the agent.
- `AgentMinted`, `AgentWalletUpdated`, and `AgentMetadataUpdated` expose changes alongside standard ERC-721 events.
- Mint and owner mutations use OpenZeppelin ReentrancyGuard. No admin, upgrades, burn, fees, supply caps, or reputation computation are added.

## Activity receipts

`AMEReceipt` is an append-only registry, not a transferable receipt NFT. Its constructor binds an immutable deployed agent registry.

- `createReceipt(agentId, receiptType, dataHash, metadataURI)` accepts TASK=0, PAYMENT=1, SWAP=2 or ACTION=3.
- Only the agent's current owner or currently assigned wallet may issue receipts. Approved NFT operators do not gain this permission.
- Each record stores agent ID, type, original issuer, block timestamp, nonzero data hash and nonempty metadata pointer. Receipt IDs start at 1 and increase globally.
- `ReceiptCreated` includes the receipt ID, agent ID, issuer, type, hash and metadata pointer. `getReceipt` reverts for missing receipt IDs.
- Existing records cannot be edited or deleted. Old wallets lose issuance rights when replaced or cleared on transfer; historical records retain their original issuer.
- Receipts are authorized attestations. The contracts do not independently execute or verify tasks, payments or swaps, enforce metadata availability, or calculate reputation. Repeated attestations are allowed; no deduplication policy is assumed.

## QA status

See `QA.md` for the executed checks. Real MetaMask QA was explicitly deferred by the user because no MetaMask-enabled browser is accessible inside Codex. It remains pending, was not executed inside Codex, and is not marked passed. The contract tests execute against Hardhat's local EVM and do not substitute for real-wallet QA or establish Robinhood Testnet deployment compatibility.

Official references used: [Hardhat](https://hardhat.org/docs/getting-started), [Hardhat Viem testing](https://hardhat.org/docs/guides/testing/using-viem), [OpenZeppelin ERC-721](https://docs.openzeppelin.com/contracts/5.x/api/token/erc721).

## Phase 07 — Robinhood Testnet deployment

Current status: BLOCKED: signer unavailable. No public deployment was attempted. Real MetaMask QA remains NOT VERIFIED.

The contracts-project .env.example documents AME_TESTNET_RPC_URL and AME_TESTNET_PRIVATE_KEY. Configure a funded dedicated testnet signer in the local environment or ignored .env, never in frontend NEXT_PUBLIC variables or chat. The scripts never print signer data.

npm run preflight:testnet performs read-only checks and writes deployments/robinhood-testnet.status.json. The status file is not a deployment manifest. Verified: official RPC reachable, chain ID 46630, block and gas-price reads. The Node --use-system-ca flag uses existing OS certificate trust; TLS verification stays enabled.

npm run deploy:testnet is only to be executed after the signer is available. It confirms chain 46630 and funding, deploys AMEAgent without constructor args, deploys AMEReceipt with the actual agent address, confirms two blocks, verifies code/receipt/deployer/registry binding and saves deployments/robinhood-testnet.json. Transaction hashes are checkpointed in robinhood-testnet.pending.json; repeated runs verify completed records and resume pending hashes. A deployed status requires both verified records. No public sample NFTs or receipt activity are created by this script.

The confirmed manifest contains schema version, network/chain ID, deployer, and per-contract address, deployment transaction, block and runtime code hash. It never contains a private key. No confirmed manifest exists while the signer is absent.

From the frontend, npm run env:testnet exports exact public Vercel values only after a completed manifest exists. npm run build:testnet requires that generated .env.vercel-preview file.

Compile/typecheck pass. Tests now total 19: the 15 original core tests plus constructor, calldata and structured-manifest tests. These checks do not prove a public deployment or real MetaMask interaction.

## Phase 07 — Confirmed public deployment

Status: deployed and bytecode verified on Robinhood Chain Testnet, chain 46630.
Deployer: 0x1641E156Ed5578ec1Bd4a25AD8A15Aba916A88B7.
Balance before deployment: 0.01 ETH. Verified balance after deployment: 0.0099813205 ETH.

AMEAgent: 0xAC214EeDeA040f247962C87eF779dEBdBc86727c
Transaction: 0x9b12d335ceff71cd3ed1120b3e8d0a5724cf3901b2076c369380e0ece01d55fc
Block: 136170413. Runtime bytecode: 5265 bytes.

AMEReceipt: 0x66dEb73680BD9B3FEEF932ec683B31492C11B94e
Transaction: 0x08a892e536db388d1e0d83108cd491bb71f00ee3f45ec2c277ca70e8fbffe1fa
Block: 136170473. Runtime bytecode: 2305 bytes.

Both deployment receipts succeeded and were confirmed. Public verification matched deployment transaction input against the exact compiled creation bytecode and constructor arguments, matched runtime hashes, checked deployer and block, and read AMEReceipt.agentRegistry pointing to the deployed AMEAgent. No Solidity logic changed. No additional public NFT or receipt was created by deployment or verification.

Confirmed public evidence: deployments/robinhood-testnet.json. Status file updated to deployed. Contract typecheck and all 19 tests passed again. The deployer private key remains only in the ignored local .env and was never printed or exported.

META MASK QA: NOT VERIFIED
