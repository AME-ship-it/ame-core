# Mainnet activation acceptance record

Status: NOT APPROVED. No real-value transaction or mainnet deployment is authorized. Production signing remains absent, not controlled by an environment variable.

## Market-specific findings (2026-11-09)

Exact token/oracle/IRM addresses, bytecode hashes, decimals, liquidity, utilization, owners and timestamped rounds are recorded in `contracts/deployments/morpho-activation-review.json`. Both markets use 91.5% LLTV and AdaptiveCurveIrm at `0x2BD3d5965B26B51814AC95127B2b80dD6CcC0fa1`. Core and IRM runtime were independently matched through Sourcify; this is a source-service attestation, not an AME security audit.

### USDe collateral / USDG loan — signing BLOCKED

- USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` has 6 decimals; USDe `0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34` has 18. The oracle price scale is 10^24 for parity, not 10^36 human-token units. Morpho valuation uses collateral base units times price divided by 10^36.
- Oracle `0xE64849bd4AD03DfaBbe02bb521de19997a19055f` is an EIP-1167 clone targeting `0x6A16d6fe1bA26E6BA52fdA03972b1FE2e31cA729`. Its implementation runtime is source-matched to `MetaOracleDeviationTimelock` through Sourcify. Primary `0x68B60430a1E2d663cCD975Be31d3d31EBa8Ee501` exposes zero feed/vault addresses and scale 10^24; backup `0xceE05FD68fE4799dbfBB9aD14D74E073c7a194B0` uses the 8-decimal USDE/USD feed `0xd9B1f2958298F25bf1289B5aaB7fB6d1B7416c95` with scale 10^16. Both imply the correct collateral-to-loan base-unit scale.
- Observed configuration: primary selected; 0.5% relative deviation threshold; 57,600-second challenge; 86,400-second healing. The matched source requires permissionless challenge/accept calls to switch after persistent deviation; it does not automatically switch just because a timestamp expires. Its `price()` also falls back when the selected oracle reverts. The 16-hour challenge is not an upper bound on switching latency if nobody acts.
- A timestamped backup does not make the fixed primary fresh or protect lenders immediately during a depeg. The backup quotes USDe/USD while the loan is USDG: assuming USDG equals USD needs explicit approval. No approved heartbeat, sequencer-outage policy or stress-liquidation analysis is recorded.
- USDG is issuer-controlled and upgradeable; pause/blocklist/mint controls can impair transfers. USDe is a bridged OFT with an owner, bridge permissions and synthetic-dollar backing/custody/funding risks. The source match of USDeOFT does not approve its bridge governance.
- Smallest corrective action: obtain and review the operator/provider freshness policy, full oracle dependency sources and challenge monitoring/liquidation assumptions, then explicitly approve or reject this existing market. Its immutable market parameters cannot be made safer by a UI change.

### syrupUSDG collateral / USDG loan — signing BLOCKED

- Collateral `0x40858070814a57FdF33a613ae84fE0a8b4a874f7` and loan USDG both use 6 decimals.
- Oracle `0x152c638fad68913739Ee19Ba8eF47fAEB09DCa91` reads `BASE_FEED_1 = 0x3bEdEA9CE3ead0Db4EA60dC497568DEdDe85dBa3`, other feeds/vaults zero, scale 10^18. Its 18-decimal exchange-rate answer multiplied by 10^18 gives the Morpho 10^36 price scale.
- Maple publishes feed `0xDd194C66aDcb422F188a04434e4824D70c151cF0`. Independent RPC inspection found that it and the market's feed point to the same aggregator `0xD972eB40C14C8aBA1c44c1DF6e0A6e1d592C1012`, expose the same description/decimals, and returned the same answer/update timestamp. Different proxy phase IDs must not be compared as if they were raw aggregator round IDs.
- Observed update was 2026-11-08T19:20:50Z, about 23.5 hours before the review snapshot. This age alone cannot establish stale/healthy status: Maple describes a scheduled heartbeat but no approved numeric heartbeat/deviation limit was verified. Full oracle/feed source matches and administrator permissions remain unapproved.
- syrupUSDG is credit-backed and bridged via CCIP. NAV/exchange-rate feeds need not reflect secondary-market discounts, defaults or immediate exit liquidity. Maple describes withdrawal delays, including up to 30 days, which can impair timely liquidation at NAV. Morpho liquidity is not proof of collateral liquidation depth.
- Smallest corrective action: obtain the numeric heartbeat/deviation schedule and source/admin verification from the feed provider; review NAV markdown, redemption delay and liquidation liquidity assumptions before approving this market.

## Adapter changes and remaining gate

All six unsigned actions are now exercised through the actual adapter on isolated mainnet forks for BOTH markets. Each action simulates before a fork-only send; receipts are checked and a fresh contract snapshot verifies the result. Tests cover allowances, owner rejection, health reverts, full-share repayment and withdrawal share burns. Public broadcasts: zero.

Withdraw now specifies exact shares, bounding the share burn in the core. The core has no minimum-assets argument, so minimum proceeds are explicitly unenforced. Do not activate withdraw signing until a reviewed, already-deployed protocol Bundle is verified for this chain and its minimum-proceeds/deadline/authorization controls are fork-tested. Do not add a new wrapper contract. The other direct core calls also have no onchain quote deadline; the 60-second expiry is a simulation guard only.

Full repayment approvals use debt plus the selected tolerance, not an arbitrarily larger entered maximum. Approvals are finite and reset different existing allowances. Simulation validates market parameters, function, account, recipient, approval spender/token/budget, withdrawal share bound and quote age. RPC simulation errors propagate to the existing error UI. Inputs/account/market changes invalidate displayed simulation results; a fresh snapshot is read before preparing another call.

READ_ONLY means no successful action call for the current input. LIVE_SIMULATION is shown only after successful `eth_call`, never for APPROVAL_REQUIRED. Neither state enables SIGNING_ENABLED. No mainnet signing, pending-transaction or confirmed-mainnet receipt is fabricated. Signing/confirmation lifecycle remains intentionally uninstalled until the prerequisites below pass.

## Agent attribution

Positions are keyed to the connected wallet's address and exact market. Protocol Borrow/Repay events are filtered by that onBehalf address. There is no configured mainnet AME NFT/authorization registry. Testnet NFTs cannot prove mainnet agent ownership. Mainnet reputation/receipts remain disabled. Before agent attribution, verify chain-specific NFT ownership, explicit owner/operator delegation, debt behavior on NFT transfer, and replay-resistant event-to-receipt binding. Preserving the existing testnet ownership restrictions is not evidence that mainnet attribution exists.

## Actual browser-wallet acceptance — NOT RUN

Run the following with an actual MetaMask installation on an isolated Robinhood-mainnet fork first. Do not share seed phrases/private keys. A real mainnet transaction needs separate explicit authorization specifying market/action/token/amount.

| Check | Required evidence | Current status |
| --- | --- | --- |
| Connect/reload/disconnect/account change | MetaMask account matches displayed owner; no unsolicited signatures | NOT VERIFIED with actual MetaMask |
| Mainnet select, reject/add/switch, wrong chain | chain 4663, approved RPC/explorer, no testnet address reuse; rejected switch stops preparation | NOT VERIFIED with actual MetaMask; production view does not switch the wallet |
| Balances and allowance | Compare exact token units and core spender with RPC/explorer | RPC/fork PASS; browser wallet NOT VERIFIED |
| Approval prompt and rejection | Exact token/core/budget; no unlimited allowance; reject leaves action unsent | Fork/unit PASS; actual prompt NOT VERIFIED |
| Action prompt and rejection | Correct chain/market/onBehalf/receiver/amount or shares; no signature on READ_ONLY | Unsigned/fork PASS; actual prompt NOT VERIFIED |
| Pending, replacement/cancel/revert | Never show success before a successful finalized receipt; cancellation/revert cannot issue an AME receipt | Mainnet signer absent; NOT VERIFIED |
| Confirmation and refresh | Confirm canonical target/event/account; refresh balance, allowance, collateral and debt; no stale result after account/network change | Fork adapter/receipt/readback PASS; actual browser NOT VERIFIED |
| Production gate | Six disabled actions; no mainnet wallet/signing request; simulation failure never unlocks writes | Verify on released frontend; no environment bypass exists |

Approval requires market-specific oracle/token/liquidation review, adapter minimum-proceeds/deadline controls, verified identity design for agent operations, actual browser-wallet acceptance and explicit real-value authorization. A fork pass cannot substitute for any of these.

Primary references: [Paxos addresses](https://docs.paxos.com/guides/stablecoin/usdg/mainnet), [USDG controls](https://github.com/paxosglobal/usdg-contract/blob/master/README.md), [Ethena addresses](https://docs.ethena.fi/technical-design/key-addresses.md), [Ethena risk overview](https://docs.ethena.fi/), [Maple chain addresses/feeds](https://docs.maple.finance/integrate/crosschain/syrupusd-crosschain.md), [Maple liquidity/credit disclosure](https://maple.finance/transparency), [Morpho Bundles](https://docs.morpho.org/developers/contracts/bundles/).
