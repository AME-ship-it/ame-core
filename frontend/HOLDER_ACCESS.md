# $AME holder access

The AME lending application now requires a server-verified ERC-20 balance before loading its terminal. This is a product access rule, separate from NFT ownership, agent creditworthiness, protocol permissions and mainnet activation. No token or token address is invented by this implementation.

## Pre-launch

Leave `AME_TOKEN_ADDRESS`, `AME_HOLDER_THRESHOLD` and `AME_TOKEN_CHAIN_ID` unset. `/lending` shows a locked wallet-connection screen; a connected wallet receives `PRE_LAUNCH` and the launch notice. It never loads the terminal or exposes an acquisition link. Partial or invalid configuration produces `CONFIGURATION_ERROR`, not a non-holder result. No existing public deployment/environment value needs to change for this release.

## Configuration-only activation

Set server-only production environment values, then redeploy the existing application:

- `AME_TOKEN_ADDRESS`: the actual, confirmed ERC-20 address.
- `AME_HOLDER_THRESHOLD`: a positive decimal token amount in human units (for example, an integer amount or exact fractional amount). Never floating-point/scientific notation. Precision exceeding the real token decimals is rejected rather than rounded.
- `AME_TOKEN_CHAIN_ID`: the actual EVM token chain. It is independent of the lending/wallet network. There is no fallback to Robinhood.
- `AME_TOKEN_URL`: optional real official HTTPS acquisition destination. Omit it to hide Get $AME.
- `AME_TOKEN_RPC_URL`: optional HTTPS RPC override; required for chains outside the default Ethereum, Base, Arbitrum, Optimism, Polygon, BNB Chain, Avalanche and existing Robinhood network metadata. Verify its `eth_chainId` before activation. RPC credentials remain server-only.

Never use `NEXT_PUBLIC_` for these settings. No production token settings should be copied from local test fixtures. Non-EVM tokens are not supported by this ERC-20 verifier.

## Trust boundary and API

`POST /api/holder-access` accepts JSON `{walletAddress, refresh?, intent?}`. `intent` is `status` (default) or `action`. Unknown keys, including holder flags and client token/threshold/chain overrides, return 400. Zero and malformed wallet addresses are rejected. Responses use `Cache-Control: private, no-store`.

The server selects the token, threshold and RPC from its environment, checks the RPC chain, pins bytecode/decimals/balance reads to one block, and compares atomic bigint units. Normal results include wallet, atomic balance/threshold strings, token decimals, actual chain/token, checked block/time, expiry, `isHolder` and `access`. Access has only two values: `locked` or `unlocked`. Pre-launch and failures use `isHolder: null`, not false. RPC failures return 503 `VERIFICATION_UNAVAILABLE`; configuration failures return 503 `CONFIGURATION_ERROR`. Neither claims the wallet is a non-holder.

The process-local cache lasts at most 30 seconds, is bounded to 256 entries, and keys wallet + chain + token + threshold + RPC + acquisition URL. Concurrent requests share reads with a bounded in-flight set. Failed fresh reads evict prior success. Manual refresh bypasses cached results. Serverless instances have independent caches; this is not a durable entitlement store.

Action requests always refresh independently of a client refresh flag and return 403 for locked wallets. Every existing first-party testnet approval/write requires this fresh authorization, followed by a current connected-account/network check before the wallet request. The frontend also rejects expired, mismatched-account, inconsistent or failed responses. Mainnet previews are gated too; mainnet signing remains disabled. Wallet disconnect/change, API errors and expired status close the UI. No localStorage value, frontend boolean or signature unlocks access.

Balance lookup is public, read-only eligibility discovery, not wallet authentication. Anyone can query a public wallet's balance. A positive result is not proof that the caller owns that wallet; actual write authority remains the wallet signature and existing contract checks. There is no new custodial account, private key store or signed-in session.

## Limits and user safety

This gate controls AME's application and its access/action-preparation endpoint. Existing immutable AME contracts and permissionless Morpho contracts cannot be made holder-only by a frontend release. Their direct RPC/explorer/third-party access is unchanged. Do not advertise contract-level holder enforcement or treat a balance response as authorization for a privileged server transaction. Any future financial server API must bind authenticated ownership and repeat the balance check itself.

Eligibility is a point-in-time observation; selling/transferring tokens between checks is possible, particularly across chains. This does not change lending solvency or authorization checks. If eligibility disappears while a transaction is pending, do not resubmit blindly: inspect wallet activity and the confirmed receipt. The interface locks after loss of eligibility; existing debts/positions still exist onchain and contract-level repay/withdrawal permissions are unchanged. Do not activate real-value lending without reviewing this access-loss behavior and preserving a debt-management exit path.

## Verification

The tests cover absent/malformed configuration, disconnected/mismatched wallets, RPC failures, wrong chain/bytecode/decimals, zero/below/equal/above/large balances, exact unit scaling, spoofed flags, action denial, fresh-action checks, cache expiry/refresh and token acquisitions. A local test uses the existing valueless tUSD ERC-20 fixture and actual chain reads; it is not a fabricated production $AME token. Production route tests ensure the disconnected public page has no terminal and the pre-launch endpoint denies actions.

Real-token acceptance remains required at launch: confirm the token contract/chain/decimals and threshold, connect a real holder and non-holder wallet, check Get $AME's destination, refresh after a transfer, and confirm network/account changes and existing wallet rejection handling. Merely checking a balance needs no signature. Production must remain locked until real configuration is supplied.
