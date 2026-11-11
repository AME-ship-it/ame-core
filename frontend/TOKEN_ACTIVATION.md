# AME token read activation

Approved scope: recognize the supplied token, read actual balances and identify positive-balance holders. No premium policy, lending privilege, approval, swap, liquidity operation or financial signing is activated.

## Verified deployment

- Chain: Robinhood Chain Mainnet, 4663.
- Contract: `0x5C5607A98E663e74590386dC7fa46DE3Cc7EB1B1`.
- Name / symbol: Ame AI / AME. Decimals: 18.
- Initial supply: 1,000,000,000 AME (1,000,000,000,000,000,000,000,000,000 atomic units). The configured maximum is this constructor supply; voluntary burns may reduce the current supply.
- Runtime hash: `0x483c2d9468763e46cf53697f4b6d461c5b9464214d675356f8411221da1e26aa`; 3,248 runtime bytes.
- Deployment block: 111920000. Launch transaction: `0x5d0ab08693260eb6164b592ae2b3e7aa69d61220d0c97bf6610793ae8287f8db`.
- Factory: `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e`. Bonding curve: `0x643eA4a6C540E26CfF04e7BC7f130B8810bB784B`.

`PonsV2LauncherToken` was compiled independently with official Solidity 0.8.35 using the exact settings and sources published in the Sourcify-verified launch router compilation. Runtime bytes, including metadata, match after substituting the three compiler-declared immutable addresses; each address matches its live getter. The token has no owner, external mint, pause, blacklist or upgrade function. `burn` affects the caller's own balance; `burnFrom` requires allowance. ERC-1967 implementation/admin/beacon slots are zero, and the matched token source has no delegatecall or external control hook.

The constructor-only mint and factory `TokenLaunched` event establish launch provenance; historical state at the deployment block is unavailable on the non-archive RPC. Initial mint and subsequent Transfer events were read directly. See [verification evidence](reports/token-activation-verification.json). This source/runtime match is not an independent security audit of the launchpad, curve, economic design or trading liquidity.

The observed factory phase is the active native-quote bonding curve, not a registered graduated Uniswap pool. Curve trading fees and factory administration are separate from token transfer permissions. No AME trading or liquidity action is integrated by this release; unrelated permissionless pools are not exhaustively enumerated. The Blockscout domain was blocked by the local WebShield filter; it was not bypassed. Read-only Etherscan token links use the separate Robinhood explorer.

## Recognition versus entitlements

`/api/token-state` returns `HOLDER` when the verified atomic balance is positive, `NON_HOLDER` when it is zero, and `UNAVAILABLE` on verification failure. All ERC-20 reads remain pinned to a checked block and hash; bounded Transfer monitoring and cache refresh retain the existing safeguards. Recent Transfer requests cover at most 2,048 blocks with an overlap, including an initial recent window; larger gaps reconcile the actual balance and mark the event window incomplete rather than inventing history. This window accommodates the observed fast block cadence and 15-second wallet refresh.

With no `AME_HOLDER_THRESHOLD`, `/api/holder-access` reports actual membership and **always keeps `access: locked`**. Positive holders receive `ENTITLEMENTS_DISABLED`; protected action preparation returns 403. Basic identity minting remains available on its existing testnet without token holdings. No threshold, premium service or credit privilege has been invented.

Mainnet Morpho signing and reputation writes remain disabled in code. Token activation cannot change those gates. A configured future threshold requires separate approval and does not substitute for authentication, account authorization, oracle review, collateral or market solvency.

## Release and rollback

Only the eight verified `AME_TOKEN_*` read parameters are applied to the existing production project. RPC override/fallbacks, allowance spender, acquisition URL and holder threshold remain unset. No private keys are required or stored. The previous production deployment and pre-change environment inventory are preserved privately.

Before accepting the release, verify both a positive-balance address and a zero-balance address, metadata/hash/block consistency, premium-action rejection, live health and all public routes. Tests use `AME_QA_TOKEN_ACTIVE=1` only in the QA process; it is not an application activation variable.

If verification or health fails, roll production traffic back to the saved prior deployment and remove only the newly added token read variables. Do not modify unrelated environment values, ownership, Git integration or deployed contracts. Actual MetaMask acceptance remains NOT VERIFIED until performed by a real wallet holder. Never ask for a seed phrase or private key.
