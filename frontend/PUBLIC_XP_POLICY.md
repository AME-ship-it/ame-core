# Public Task XP eligibility

Production access mode: `AME_TASKS_ACCESS_MODE=eligible-nft` with
`AME_TASKS_WRITES_ENABLED=1` and durable Redis configured.

There is no agent, wallet or tester allowlist, aggregate award cap, enrollment
process or scheduled reward window in this mode. `AME_TASKS_WRITE_SCOPE` is not
used and is removed from production configuration. The legacy scoped mode is
retained for isolated development/security tests only.

Anyone may investigate evidence in `/tasks`. To record XP, the connected wallet
must be the current NFT owner or explicitly assigned agent wallet, verified
against the reviewed AMEAgent runtime on Robinhood Mainnet (4663). Merely
holding $AME is not authorization. The server generates a five-minute challenge
bound to the origin, registry, agent, current ownership epoch, wallet, task,
submission hash and reward policy. Signing requires the user's wallet approval.

All six existing reward amounts are unchanged. One reward per category per NFT
lifetime, globally unique evidence per category, ownership epoch attribution,
canonical RPC verification, single-use nonces, signature expiration and rate
limits remain enforced. NFT transfers do not reset category rewards. Atomic Lua
commits completion, evidence reservation and score history together. Public
mode has no global five-award counter or time limit.

A persistent policy-wide Redis control is checked before challenge generation,
before verification and inside the atomic write. It is an emergency service
stop, not a per-user approval. No request can enable it. Disabling it or the
server feature flag prevents new writes while retaining recorded XP/history.
Policy changes invalidate outstanding challenges; users request a fresh one.

XP, the activity index, Credits and Morpho remain independent. This policy
does not enable credit issuance, financial authorization or mainnet lending.

Automated real-store tests use generated fixture signers in isolated namespaces
to verify independent owners, more than five awards, authorization rejection,
ownership changes, duplicate/replay protection and the atomic emergency stop.
They do not count as external MetaMask acceptance. A genuine independent user
must manually sign a valid production task before external acceptance is claimed.
