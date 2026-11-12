# AME Tasks V2

Tasks V2 implements deterministic, user-assisted activity verification for the verified mainnet AMEAgent registry. It does not run an autonomous agent or affect lending, financial reputation, $AME permissions or contract state.

## Guided tester experience

The public terminal uses agent selection, readable chain properties, ordinary answer controls and server-side grading. No JSON editing is required. Contract research asks for an interpretation of runtime size and the limits of code evidence. Transaction analysis checks network-fee arithmetic and attribution. Fetching evidence never awards XP.

Short-lived AES-256-GCM sealed sessions bind the site origin, chain evidence, agent ID, ownership epoch and expiry. Correct-answer keys are not sent to the browser. The server rechecks ownership, freshness and canonical chain evidence when grading. `AME_TASKS_GUIDE_SECRET` is a server-only 32-byte hex key; it must never be prefixed with NEXT_PUBLIC_. The secret is independent from database configuration and cannot enable XP.

Identity attestation supports an expiring, purpose-bound read-only wallet signature without durable storage. It grants no session, completion, XP or permission; repeated verification is an idempotent proof check. Persistent completion still uses the existing single-use Redis challenge and reward controls. Raw research/transaction `start` requests are rejected at the public API; `record-guided` requires passing server-side grading before the existing authorized signing flow.

Browser tests are in `tests-e2e/tasks-guided.mjs`, runnable through the supported browser harness without installing new dependencies. They select an actual NFT, analyze live evidence and submit ordinary inputs. Real wallet signing must be tested separately with the owner; the disconnected-wallet browser test does not certify MetaMask acceptance.

## Release gate

Production XP and completion writes are disabled by explicit product instruction. No approved durable store is configured. `/tasks` provides live read-only contract/transaction evidence and analysis checking. It never treats these reads as completed tasks or awards XP. Profile XP/history reports unavailable, rather than fabricated zeroes, when storage is absent.

The backend includes a Redis REST adapter with atomic Lua allocation. Unit tests exercise the service and adapter transport; the real Redis integration test remains unverified without a dedicated isolated Redis instance. Do not enable writes based on memory-store tests.

## Tasks and authorization

- Identity Attestation (wallet verification): 10 XP. Sign an expiring, single-use challenge as the current NFT owner or assigned wallet.
- Onchain Research: 20 XP. Submit the target contract plus exact block number/hash, runtime hash, code byte length and native balance in wei. At least two subsequent blocks, no older than 15 minutes.
- Transaction Analysis: 30 XP. Submit a real confirmed transaction and exact block number/hash, status, execution gas used, effective gas price, gas fee in wei, log count and ordered raw-log digest. Blob transactions, receipts over 256 logs, or raw-log references over 16 KiB are explicitly unsupported. The reference reader shows actual ordered raw event logs and explorer links.

A valid address/hash alone is insufficient: the complete structured report is graded server-side against actual RPC reads. The reference reader computes chain facts but never awards XP. Reading those facts is not represented as autonomous execution.

Authorization binds chain 4663, the verified registry, agent ID, current NFT owner, assigned wallet, ownership epoch, submitting wallet, origin, purpose, nonce, five-minute expiry and canonical submission hash. The epoch is the actual latest Transfer event including block hash, transaction hash and log index. Owner/assigned-wallet changes invalidate pending challenges. A transfer away and back creates a new epoch. Unconfirmed ownership transfers fail closed.

At completion, authorization is read again. Claims from former ownership epochs cannot add to the current score. Historical submissions remain attributed to their original submitting wallet. ERC-721 approved transfer operators are not automatically task executors; only NFT owner or assigned wallet qualifies.

## Persistence and evidence integrity

Redis stores expiring challenges, single-use claims, immutable attempt records, ownership-epoch completion slots, global evidence reservations and the history index. One Lua operation checks reward/evidence uniqueness and writes record, history and reward together. All keys share a Redis cluster hash tag. V2 adds an atomic lifetime category lock per identity, preventing transfer-driven XP farming; new-policy maximum is 140 across six categories. Historical V1 records retain their recorded amounts. Research targets and transaction hashes are single-reward resources across all agents/epochs; a new snapshot of the same target cannot farm XP. Repeated client requests cannot increment a score twice. Score is computed from server-verified unique task completions, not client numbers.

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

## V2 verification and persistence

Classification (20 XP) uses ERC-165 validity probes plus ERC-721 advertised support; ERC-20 compatibility and proxy safety are not inferred. Events (25 XP) decode confirmed AMEAgent Transfer logs using the reviewed ABI and emitter runtime. Risk assessment (35 XP) pins allowlisted Morpho assets, LLTV, oracle code hash, supply, debt and utilization; questions concern threshold implications, never investment advice. Unsupported ABIs/markets fail closed.

`task-index-v1` = round(100 × distinct verified current-epoch categories / 6). Historical XP sums immutable committed rewards; policy updates never reprice existing records. Index and XP are not financial reputation. `credit-review.ts` is an internal, read-only integration boundary with financial use explicitly disabled.

A dedicated Upstash Free database was created with eviction off and no payment method. Production env credentials are encrypted and server-only. XP writes stay disabled until genuine authorized wallet completion acceptance succeeds. Free-tier quota exhaustion fails closed; no automatic paid upgrade is authorized.

Run `tests-integration/tasks-v2-redis.mjs` with isolated test credentials. It uses a random hash-tag namespace, performs 72 concurrent fixture grants, verifies deduplication, transfer farming, epoch totals and fresh-client recovery, then deletes only its own fixture namespace. Fixture XP is not genuine agent activity.
