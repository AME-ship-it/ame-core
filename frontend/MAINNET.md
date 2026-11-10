# Robinhood Mainnet integration checkpoint

## Delivered scope

Chain 4663 is read through the centralized Robinhood RPC configuration. The lending terminal reads two explicitly registered Morpho Blue candidates directly; it does not deploy a wrapper, use testnet addresses on mainnet, or enable a mainnet signer. All six mainnet action buttons are disabled. The separate simulation control uses unsigned calldata and `eth_call` only. Sequential approvals cannot persist through independent `eth_call` requests; these return APPROVAL_REQUIRED rather than claiming the action was simulated.

Canonical core: `0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010`. Each read checks chain identity, pinned runtime hash, immutable market parameters, enabled IRM/LLTV, dependency bytecode and asset decimals. See `contracts/deployments/morpho-robinhood-mainnet.json` for addresses, hashes and timestamped observations. Dependency code presence is not independent verified-source reproduction or an audit.

Loan asset: USDG (6 decimals). Candidate collateral: USDe (18 decimals), syrupUSDG (6 decimals). Both markets have 91.5% LLTV. Liquidity is the minimum of accrued market supply minus borrow and actual core loan-token cash. Borrow APR annualizes the contract rate. Supply APY projects constant utilization/rate with compounding after market fees; it is not a guaranteed yield. Accounting uses integer rounding, virtual shares/assets and projected interest. These are direct market shares, not ERC-4626 vault shares.

Connected-wallet balances, allowances, positions and bounded Borrow/Repay history come from canonical contracts. No testnet NFT is mapped to mainnet positions. No mainnet financial receipt or reputation is fabricated. Existing testnet identity and lending remain separate and unchanged.

## Integration choice

Direct Morpho Blue has the smallest scope for supply, borrow, repay, withdraw and collateral operations: one canonical singleton with published interfaces and security reviews. Vault V2 adds curator/adapter dependencies and does not itself supply the full borrowing lifecycle; Midnight introduces maturity and different interfaces. Other wrappers introduce additional permissions. Deploying AME's custom testnet engine would require a production oracle design and formal review first; its chain restrictions and mock-price protections remain intact.

Official references:

- [Deployment addresses and versioned source](https://docs.morpho.org/developers/contracts/addresses/)
- [Blue source v1.0.0](https://github.com/morpho-org/morpho-blue/tree/v1.0.0)
- [Published security reviews](https://docs.morpho.org/get-started/resources/audits/)
- [Protocol risks](https://docs.morpho.org/learn/resources/risks/)
- [Oracle responsibilities](https://help.morpho.org/en/articles/12879577-oracles-on-morpho)

The official security-review list includes OpenZeppelin, Spearbit and Cantina Blue reviews. This does not approve AME's adapter, these assets or their external oracles. Explorer APIs rejected source queries during discovery; exact deployed-source reproduction remains pending.

## Activation blockers

1. Approve token issuers, proxy/admin permissions, IRM and oracle implementations after exact source/bytecode comparison. USDe's oracle returned a price but no standard timestamped feed breakdown was verified. The syrupUSDG feed observation needs an approved heartbeat/freshness and provider policy. Neither market is approved for signing.
2. Review oracle integrity/depeg behavior, liquidation incentives and execution under stressed liquidity, bad-debt allocation and solvency. Liquidation is permissionless below LLTV; liquidator availability is not guaranteed. A healthy current snapshot does not establish liquidation reliability.
3. Complete independent adapter review and fork adversarial tests, including stale prices, share/asset slippage, reverts, interest changes, fee accrual, token behavior and RPC failures. Withdrawal maximum-share enforcement needs a reviewed protocol-supported guard/bundle before signing. The current unsigned withdraw fixes assets but cannot enforce a maximum share burn.
4. Review authorization, fee administration, external upgrades and emergency response. Blue's direct core does not provide an AME pause switch; AME can stop its own UI, not permissionless protocol access. Do not add unsafe wrappers to imitate unavailable controls.
5. Specify mainnet agent identity, verified owner/operator delegation, NFT transfer with debt, position ownership and receipt issuance backed by finalized protocol events. No mainnet identity contract is configured, so association remains disabled.
6. Only after market/security approval, implement reviewed wallet chain switching, signing, approval confirmations, replacement/revert handling, receipt finality and post-transaction refresh. Obtain explicit authorization before any real-value broadcast. Real MetaMask browser QA remains NOT VERIFIED.

## Verification

`frontend/tests/morpho-mainnet.test.mjs` tests all six unsigned adapters, finite/reset allowances, ownership/chain/limit rejection, full-share repayment, rounding and fail-closed signing. `contracts/scripts/verify-morpho-fork.ts` executes supply, collateral, borrow, full repay and withdrawals against actual core bytecode on an isolated chain-4663 fork, with authorization/health rejection checks. Fork token funding uses local storage overrides only. The report records zero public broadcasts. The fork lifecycle tests direct protocol calls; unsigned adapter encoding is tested separately.

No mainnet private key, signer, unlimited approval or environment toggle enabling writes is introduced. Mainnet reads require no new environment variables. Production remains on the existing testnet wallet configuration; the mainnet terminal reads the same connected EVM address without a signature or chain switch.
