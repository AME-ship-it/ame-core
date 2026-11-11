# AME Tasks V1

Tasks V1 implements deterministic, user-assisted activity verification for the verified mainnet AMEAgent registry. It does not run an autonomous agent or affect lending, financial reputation, $AME permissions or contract state.

## Release gate

Production XP and completion writes are disabled by explicit product instruction. No approved durable store is configured. `/tasks` provides live read-only contract/transaction evidence and analysis checking. It never treats these reads as completed tasks or awards XP. Profile XP/history reports unavailable, rather than fabricated zeroes, when storage is absent.

The backend includes a Redis REST adapter with atomic Lua allocation. Unit tests exercise the service and adapter transport; the real Redis integration test remains unverified without a dedicated isolated Redis instance. Do not enable writes based on memory-store tests.

## Tasks and authorization

- Wallet Verification: 10 XP. Sign an expiring, single-use challenge as the current NFT owner or assigned wallet.
- Onchain Research: 20 XP. Submit the target contract plus exact block number/hash, runtime hash, code byte length and native balance in wei. At least two subsequent blocks, no older than 15 minutes.
- Transaction Analysis: 30 XP. Submit a real confirmed transaction and exact block number/hash, status, execution gas used, effective gas price, gas fee in wei, log count and ordered raw-log digest. Blob transactions, receipts over 256 logs, or raw-log references over 16 KiB are explicitly unsupported. The reference reader shows actual ordered raw event logs and explorer links.

A valid address/hash alone is insufficient: the complete structured report is graded server-side against actual RPC reads. The reference reader computes chain facts but never awards XP. Reading those facts is not represented as autonomous execution.

Authorization binds chain 4663, the verified registry, agent ID, current NFT owner, assigned wallet, ownership epoch, submitting wallet, origin, purpose, nonce, five-minute expiry and canonical submission hash. The epoch is the actual latest Transfer event including block hash, transaction hash and log index. Owner/assigned-wallet changes invalidate pending challenges. A transfer away and back creates a new epoch. Unconfirmed ownership transfers fail closed.

At completion, authorization is read again. Claims from former ownership epochs cannot add to the current score. Historical submissions remain attributed to their original submitting wallet. ERC-721 approved transfer operators are not automatically task executors; only NFT owner or assigned wallet qualifies.

## Persistence and evidence integrity

Redis stores expiring challenges, single-use claims, immutable attempt records, ownership-epoch completion slots, global evidence reservations and the history index. One Lua operation checks reward/evidence uniqueness and writes record, history and reward together. All keys share a Redis cluster hash tag. Each type earns once per ownership epoch, capped at 60. Research targets and transaction hashes are single-reward resources across all agents/epochs; a new snapshot of the same target cannot farm XP. Repeated client requests cannot increment a score twice. Score is computed from server-verified unique task completions, not client numbers.

Evidence uses sorted canonical JSON and keccak256 content hashes, chain-aware resource keys, pinned block hashes and verification version `ame-tasks-v1.0`. Records include original structured analysis, reproducing source references, authorization block/hash, timestamps and lifecycle transitions: STARTED, SUBMITTED, VERIFYING, VERIFIED/REJECTED. Later reorganizations remain possible despite confirmation checks; records preserve issuance context and do not promise irreversible finality. No mainnet AMEReceipt transaction is issued or claimed.

RPC timeouts/failures reject verification without XP. Rejected attempts are retained once persistence is enabled. If a persistence response is ambiguous, inspect history rather than assume success or resubmit automatically. History reads expose the last 100 attempts; older immutable records remain retained. Identity transfer-log scans are bounded to 100 pages of 100,000 blocks, then fail closed pending an indexer/range update. IP/global per-instance API limits are reused; configured Redis also limits challenge/submission traffic across instances. Metrics log route/status/duration without signatures or wallet payloads.

## API / executor contract

`GET /api/tasks` returns task definitions and write/persistence availability. `?agentId=...` returns current authority, current-epoch Task XP and recent history when durable storage is available.

`POST /api/tasks` accepts strict JSON actions:

- `reference`: confirmed snapshot block reference.
- `observe`: `type`, `target`; returns live chain facts, `awardedXP: 0`, `persisted: false`.
- `inspect`: `type`, `submission: {target, analysis}`; grades a complete report without persistence or reward.
- `start`: `agentId`, `wallet`, `type`, `submission`; persists a bound challenge and returns its exact personal-sign message. Wallet task submission is `{}`.
- `submit`: `challengeId`, `signature`; verifies signature, replay state, authorization and evidence, then atomically records the attempt/reward.

The exported `TaskExecutor` interface is future-compatible with signed executors; no autonomous worker is active. There are no custodial keys, financial approvals or transactions in this API.

## Enabling durable writes later

Use approved server-only `KV_REST_API_URL` + `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. Never prefix credentials with NEXT_PUBLIC_. Use a durable, non-evicting Redis configuration with persistence/backups, TLS and sufficient capacity. Premature eviction invalidates replay/history guarantees. Provisioning storage and enabling writes is a separate release gate, not automatic in this release.

First run the real isolated Redis test using `AME_TASKS_TEST_REDIS_ISOLATED=1`, `AME_TASKS_TEST_REDIS_URL` and `AME_TASKS_TEST_REDIS_TOKEN` against a dedicated approved test instance:

```
node --use-system-ca --experimental-strip-types --test tests-integration/tasks-redis.mjs
```

This writes test records and must never point at production. Verify concurrent awards, replay, durability/retention, security and production connectivity before explicitly setting server-only `AME_TASKS_WRITES_ENABLED=1` and deploying. Keep it unset now. Disabled storage is the exact blocker to persistent completion and XP, not a claim of operational recording.

## Validation

Run the existing frontend and contract suites, `tests/tasks.test.mjs`, TypeScript, production build and production route/API tests. Read-only mainnet tests verify research/transaction snapshots, invalid targets, and no writes. Desktop/mobile QA must check navigation, inputs, disabled-write state and evidence results. Actual MetaMask task signatures and production Redis durability are not verified until performed against configured storage. No financial transactions are needed.
