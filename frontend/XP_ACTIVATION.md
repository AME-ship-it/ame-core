# XP controlled activation runbook

Production signing acceptance starts at https://www.ame.guru/tasks. Connect the real NFT owner/assigned wallet on chain 4663, select the NFT and a task, and use **Verify wallet proof (no XP)**. Acceptance endpoints use real short-lived Redis challenges and nonce claims, verify signatures and pinned evidence, and return a proof without calling the award operation. Verification signatures cannot be submitted as recording signatures. They grant no login, financial permission or completion. A successful proof is retained server-side for 24 hours under `acceptance:<challengeId>` for operator confirmation, including verifier, signature/message hashes, ownership epoch and timestamps; it is not task history or XP. The five-minute signing challenge and replay checks remain unchanged. Receipts are review records, not reusable authorizations.

Never enable a reward window before genuine browser-wallet acceptance and explicit approval of the exact agent, wallet, epoch, task, maximum award count and expiry. Do not use generated accounts as MetaMask acceptance.

## Server-only scope

`AME_TASKS_WRITES_ENABLED=1`, valid `AME_TASKS_WRITE_SCOPE`, and an explicitly opened Redis scope-control key are all required. Leave both unset until approval. The JSON scope contains:

- `id`: approval identifier, 8–80 lowercase letters/numbers/hyphens.
- `startsAt`, `expiresAt`: explicit ISO times; maximum window 24 hours.
- `maxAwards`: aggregate award cap across the entire scope (1 for first acceptance).
- `agents`: exact `{agentId,wallet,epoch,tasks}` entries. Epoch must match the current verified NFT Transfer epoch. Tasks use `wallet/research/transaction/classification/events/risk`.

Scope validation uses Redis time, including an atomic deadline and quota check inside the same Lua transaction that records XP. Start and submit re-check the scope, wallet, epoch and kill switch. Scope hashes are bound to signed challenges; changing the scope invalidates pending recording challenges. The first controlled scope must authorize exactly one agent/wallet/epoch/task and `maxAwards:1`. Never enable a global flag alone. The Redis key `{ame-tasks-v1}:activation-state:<scope-hash>` must equal `enabled`; it is closed by default. After explicit approval, the operator opens only that exact scope with an expiry. Setting it to `disabled` is an immediate kill switch checked inside the award transaction, including requests from old deployments. Removing the environment flag is an additional kill switch that takes effect on deployment. The scope deadline also closes automatically without redeployment. The aggregate counter is never reset by closing/reopening the same scope.

After approved recording: read the immutable record and profile, refresh, retry the signed submission (expect replay rejection and zero added XP), verify the scope counter is one, and close the window. Only after these gates pass may an explicitly approved tester allowlist be configured; no unbounded global access is supported. Preserve lifetime category/evidence locks and original reward versions. Do not alter token or lending permissions.

## RPC reliability

Task reads coalesce simultaneous authority reads without caching completed authority across requests. Read requests get at most two rounds across configured HTTPS providers, with a 4-second per-provider timeout and 250ms between rounds. Known transient HTTP/RPC faults, including historical-state unavailability, may retry once; reverts, invalid parameters and write methods do not. Optional server-only `AME_TASKS_RPC_URLS` is a JSON array of at most two approved HTTPS RPC URLs; fallback has no additional retry loop. Do not invent a provider or expose credentials. Every result still undergoes chain, runtime, freshness and canonical block checks. Sanitized failure categories are logged without URLs, signatures or RPC payloads.

## Release gates

Real Redis integration uses isolated namespaces and cleans only its own fixture keys. The scope test submits 24 simultaneous, independently keyed awards and requires exactly one commit, then verifies an expired scope fails. These are fixtures, not real agent completions. Real MetaMask proof, first live award approval and persistent end-to-end acceptance must be reported separately from automated tests.
