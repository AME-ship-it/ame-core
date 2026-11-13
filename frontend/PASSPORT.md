# Passport 3.0

Routes: `/passport`, `/passport/[agentId]`, public GET-only
`/api/passport/[agentId]`, and `/passport/[agentId]/opengraph-image`.

No enrollment, wallet session, token holding, signature or write permission is
required to read a Passport. Wallet discovery reuses the existing mainnet NFT
Transfer index and ownerOf verification; users can always enter an agent ID.
Multiple owned identities link to separate permanent Passport URLs.

## Sources and verification boundaries

The reviewed mainnet AMEAgent registry and existing Tasks chain reader verify
chain ID 4663, runtime bytecode, current owner, assigned wallet, canonical
Transfer history and ownership epoch. Metadata is read at that ownership block.
Inline JSON is parsed as text; arbitrary external metadata URLs are not fetched.
Mint events provide creation block/time when retrievable. Missing metadata or
mint history is labelled independently of ownership.

The existing Tasks service is the sole source of XP, current-epoch counts,
historical XP, category coverage, Reputation Index and score history. Passport
does not award XP or maintain another ledger. Record content hashes, identity,
epoch, policy and configured reward values are checked before metrics are
displayed. A concurrent ownership change aborts the fresh snapshot.

Activity remains server-attested Redis data, not an onchain proof. The Tasks
server checked wallet signatures during submission, but raw historical
signatures are not retained publicly; Passport cannot independently recover
them. Record integrity checks are not a claim of a tamper-proof public ledger.
Prior-epoch achievements remain historical and do not become the new owner's
personal capabilities. No financial privileges follow from Passport metrics.

## Freshness and failures

Public API and profile reads have no completed ownership/activity server cache.
Concurrent identical reads are coalesced. Immutable mint details are cached in
a bounded map, with the mint block hash checked again before reuse. RPC retries
use the existing bounded read-only transport. API requests use existing rate
limits; no caller selects an RPC endpoint or registry.

Browser profiles refresh every 30 seconds; Verify Passport forces a fresh read.
Successful task recording invalidates the Passport query and links to the public
profile. Failed refreshes retain a clearly labelled stale snapshot. Snapshots
older than 90 seconds cannot show a fresh ownership label. Unavailable activity
shows unavailable metrics, never invented zero XP. Invalid IDs and missing NFTs
have distinct error states.

Social images use a fresh read and the original mascot. Image responses require
revalidation; social platforms may cache previews independently. Their numbers
are snapshots, not a promise of real-time third-party refresh. Only public NFT
and task data enters metadata. Copy and X sharing never submit a post for users.

## Acceptance boundaries

Read-only live checks use real identities and existing task records; no NFT mint,
transfer, signature or XP award is fabricated for Passport testing. Automated
tests cover invalid IDs, missing persistence, corrupt records, transfer epochs,
metric synchronization, API restrictions and PNG metadata. Genuine browser
wallet connection/discovery, creating a new NFT, and a real ownership transfer
require the user's wallet; report them unverified unless actually performed.

No new environment variables, database, paid service, contracts, rewards,
Credits issuance or Morpho signing permission is introduced.
