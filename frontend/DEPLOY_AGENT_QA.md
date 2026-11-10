# Deploy Agent acceptance and mainnet identity review

## Implemented and verified

Deploy Agent mints the existing AMEAgent ERC-721 on Robinhood Testnet 46630 at `0xAC214EeDeA040f247962C87eF779dEBdBc86727c`. It does not deploy an executable AI process or a new contract per agent. NFT existence, owner, assigned wallet and tokenURI are contract state. Tasks, earnings, autonomous execution and computed reputation are not implemented; no synthetic values are reported.

The frontend simulates the exact mint, verifies the connected owner/network again before wallet submission, and waits for a successful receipt. Confirmation checks the reviewed runtime, transaction target/sender/value/calldata, expected arguments, one matching AgentMinted event, matching zero-address ERC-721 Transfer, and receipt-block ownerOf. The assigned token ID comes only from that event. Profile reads separately report current ownership. Repriced transactions are tracked; cancellations/substitutions do not become success. Submitted hashes persist across reloads. Ambiguous send failures block another mint until the user recovers the hash or explicitly checks wallet activity and clears the uncertainty.

Name/description are bounded plain strings encoded in inline JSON. Preview code never fetches arbitrary tokenURIs or renders metadata as HTML. Metadata is mutable by the current NFT owner, not a permanent immutable claim. An assigned wallet is only an address record: it does not prove control, create a wallet, or grant lending permission. On the existing core receipt contract, it CAN issue activity attestations; those attestations are not verified financial outcomes.

Directory discovery uses paginated Transfer logs followed by ownerOf checks. A mint invalidates the owner's directory cache; directory/profile queries refresh every 15 seconds. RPC failures do not become an empty directory. If mint history alone is unavailable, the profile can still show verified current owner/wallet/metadata and labels the missing history.

Public transaction evidence: `contracts/deployments/agent-mint-qa.json`. This test uses an existing disposable testnet CLI signer. It is not MetaMask browser evidence. No mainnet transaction was broadcast.

## Exact manual MetaMask checklist — NOT VERIFIED

1. Open `https://ame-rosy.vercel.app/deploy` in a browser with actual MetaMask. Click CONNECT WALLET, select MetaMask and approve only the intended test wallet. Check that the displayed owner equals the selected account. No transaction/signature is required merely to connect.
2. Select Robinhood Testnet: chain ID 46630 (`0xb626`), RPC `https://rpc.testnet.chain.robinhood.com`, ETH currency, explorer `https://explorer.testnet.chain.robinhood.com`. Reject a switch first: mint must remain unavailable. Then approve the switch and confirm the displayed network. Use testnet ETH only; contract mint fee is zero but gas is required.
3. Enter name/description. Leave agent wallet empty for the connected owner, or deliberately assign a nonzero address. An assigned address does not prove ownership/control. Invalid and zero addresses must fail before a transaction prompt. Do not assign an untrusted attestation writer.
4. Click DEPLOY AME. Inspect MetaMask: chain 46630; target `0xAC214EeDeA040f247962C87eF779dEBdBc86727c`; function `mint(address,string)`; first argument is the displayed assigned wallet; second is the inline JSON; native value 0. Reject once: no success/ID, no mint and a clear rejection. Retry deliberately.
5. While simulation/signature is pending, change the selected account or network. A pre-send mismatch must abort, or MetaMask must reject the old account/chain request. AME must never report an unverified success. Double-click must not submit a second transaction.
6. Approve one TESTNET transaction. While pending, the button must be disabled and the actual hash visible. Reload and verify that the same hash resumes; do not resubmit. Speed-up must track repricing; cancellation or a different replacement must not show success.
7. After successful confirmation, compare AgentMinted and Transfer logs on the explorer. Confirm the actual token ID, caller/recipient, agentWallet and metadataURI. Compare ownerOf at the receipt block; current profile ownership may later differ after a legitimate transfer.
8. Open VIEW AGENT and `/agents` with the owner connected on testnet. Verify ID/name/description/onchain pointer, current owner, assigned wallet and mint explorer link. Open the direct `/agent/{actual-id}` URL in another tab. Never infer an NFT's existence from a manually entered URL alone.
9. Test insufficient gas using an unfunded TESTNET account; no success should appear. Test RPC unavailability: a known submitted hash must remain recoverable. For SUBMISSION UNKNOWN, inspect MetaMask Activity and recover its hash; clear uncertainty only if no transaction was broadcast.
10. Transfer the test NFT deliberately in a separate TESTNET wallet action if testing transfers. Verify it leaves the original owner's directory, appears for the new owner, clears agentWallet, and shows current metadata/ownership. Historical receipts must not become proof of the new owner's financial performance.

Actual connection prompts, signature rejection, browser pending/replacement handling and mobile MetaMask remain NOT VERIFIED until this checklist is performed. Automated injected-provider tests are separate evidence.

## Mainnet identity contract review

- Mint: permissionless, nonpayable, zero protocol fee; sender is NFT recipient. No allowlist, cap, anti-spam policy or administrator exists. Users pay gas. Mainnet spam/cost/product policy requires approval.
- Transfers: standard ERC-721 transfer/approval semantics; no exposed burn function. Transfers to a different owner clear the assigned wallet, revoking its core receipt-writing authority. Self-transfers retain it. Approved ERC-721 operators may transfer NFTs but cannot use the owner-only metadata/wallet setters just by being approved.
- Metadata: nonempty URI enforced by contract only; arbitrary schemes and mutable owner updates are allowed. Frontend inline JSON is self-contained but does not make externally minted metadata safe or immutable. Ownership does not certify metadata truth or execution capability.
- Operator: agentWallet is an attestation-writer address, not an autonomous financial operator. A registry assignment cannot prove key ownership. No signature-based financial delegation is implemented by this contract.
- Reputation/finance: AMEReceipt records arbitrary authorized attestations, not proof of execution/payment. Old records remain after NFT transfer. Existing testnet lending preserves original borrower ownership and restricts new borrowing after NFT transfer; it does not transfer debt/collateral to an NFT buyer. No testnet history is silently mapped to mainnet NFTs. Mainnet reputation/financial writes remain disabled.
- Administration: AMEAgent has no protocol admin, fee setter, pause function or upgrade path. Each current NFT owner can update its metadata and assigned wallet. Standard ERC-721 approvals and malicious receiver callbacks still require deployment/security review; passing regression tests is not an independent audit.

## Reproducible mainnet preparation — no broadcast performed

From the existing `contracts` directory:

```powershell
node --use-system-ca scripts/identity-mainnet.mjs --prepare
```

This verifies chain 4663, recompiles the exact existing build input with installed solc 0.8.28, compares creation/runtime bytecode, estimates gas and writes public `deployments/identity-mainnet.plan.json` and `identity-mainnet.standard-json.json`. Constructor arguments are empty; only AMEAgent is planned. No receipt, lending contract, financial permission or environment setting is deployed/changed.

The tool has a separate `--broadcast-approved <approval-file>` mode, which MUST NOT be invoked without the user's explicit mainnet deployment approval. It requires a dedicated `AME_MAINNET_IDENTITY_PRIVATE_KEY` in process memory (never a testnet/disposable key), and an expiring approval file binding `action: DEPLOY_AME_AGENT_ONLY`, `chainId: 4663`, `digest` from the plan, checksummed `deployer`, `maxTotalFeeWei`, `expiresAt` and `allowBroadcast: true`. Approval-file presence alone is not user authorization. The tool persists a deterministic pending hash before broadcast and refuses to repeat an uncertain deployment. Existing pending/final records are verified rather than recreated.

After an explicitly authorized deployment:

```powershell
node --use-system-ca scripts/identity-mainnet.mjs --verify <address> <deployment-tx-hash>
```

Verification checks chain, successful creation receipt/address, exact constructor input, runtime hash and name. Submit the exported standard JSON using compiler `0.8.28+commit.7893614a`, Cancun, optimizer 200 runs, empty constructor arguments and the build input's exact source paths to a supported explorer/Sourcify verifier. Record public source-verification evidence separately; runtime matching alone is not public source verification or an audit. No production frontend mainnet identity addresses are configured by this tool.

Remaining mainnet gates: approve mint/metadata/operator policy and contract review; authorize a specific deployer and ETH budget; then verify the resulting deployment and source. Autonomous execution, mainnet lending and reputation permissions are outside this identity deployment and remain disabled.
