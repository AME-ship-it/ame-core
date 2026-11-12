# AME utility credits — implementation and authorization boundary

Status: ledger implementation available; production issuance and spending disabled.

Task XP rewards verified activity under the existing six-category policy. The
Task Reputation Index is round(100 × distinct verified categories in the current
NFT ownership epoch / 6). Historical XP retains prior owners' attributed work.
Neither metric represents creditworthiness, money or borrowing capacity.

AME Credits are reserved for future application utility. No grant purpose,
spend purpose, pricing, issuer authorization or wallet-signature integration has
been approved. There is no XP/$AME/USD/credit exchange rate. Credits are not
transferable, redeemable for money or lending collateral. No public credit
mutation endpoint is installed and no production credits are issued.

`lib/tasks/credits.ts` implements integer balances, an immutable transaction
history, finite per-operation limits, atomic insufficient-funds checks,
idempotency conflict detection and single-use authorization IDs in Redis Lua.
Accounts bind chain 4663, registry, agent ID, wallet and ownership epoch.
Transfers therefore do not silently transfer another wallet's utility account.
Record and balance keys have no expiration. Redis server time records each
commit; transaction hashes bind the entire intent and server-owned policy.

Before installing a production policy or endpoint, separately approve the exact
utility and limits, and integrate a server-side verifier for an expiring wallet
signature over every intent field plus current NFT authority. The required
`authorize` callback is a trusted server boundary, never a client boolean.
Validate the intent again immediately before mutation. A failed operation writes
nothing. A retry returns the original result only after authorization passes.

Real-store tests use isolated QA keys and fixture credits only. They verify
parallel grants, overspend races, replay, epoch isolation and process restart
recovery. Passing them does not approve a production issuance policy.

Morpho borrowing capacity remains determined solely by actual assets,
collateral, oracle, LLTV and market liquidity. Mainnet financial signing remains
disabled independently of Tasks, Reputation and Credits.
