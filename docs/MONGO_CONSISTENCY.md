# MongoDB read-after-write consistency

Arcaevo's web app runs on MongoDB Atlas. In production the cluster may span
multiple regions (an EU primary plus Asia/USA secondaries) so reads can be
served close to the user. This document explains how the app stays **correct**
whether reads come from the primary or from a lagging secondary replica.

## The risk

A **secondary replica applies writes asynchronously**, so it can lag the primary
by anywhere from milliseconds to several seconds. If the connection string opts
reads into the replicas (`readPreference=secondary` / `secondaryPreferred` /
`nearest`), a read issued **immediately after a write** can land on a replica
that has not yet received that write and **miss it**:

- a member signs in (session row inserted) then immediately calls an authed
  API → the session lookup misses → "not signed in";
- a magic link is issued then verified within the same second (fast tap, or an
  email-scanner prefetch) → the token lookup misses → "invalid link";
- `POST /checkout` writes a `pending` membership, the Stripe webhook fires a
  moment later → `findMembership` misses → the paid membership never activates;
- an upload is created then its confirm screen posts straight back → the upload
  lookup misses → "no upload on your account".

With the **driver default** read preference (`primary`) none of this happens —
reads and writes both hit the primary, so the app is already consistent today.
The risk only appears **if** the founder points the connection string at the geo
secondaries. The hardening below makes the app safe **either way**.

## How the app is hardened

### 1. Client durability defaults (`src/lib/db.ts`)

The shared `MongoClient` is constructed with:

```ts
new MongoClient(mongoUri(), {
  writeConcern: { w: "majority" },
  retryWrites: true,
  retryReads: true,
});
```

- **`w: "majority"`** — a write returns only once a **majority** of replicas have
  acknowledged it. This makes writes durable across a region/node loss *and*
  guarantees a subsequent **primary** read observes the write (the basis for the
  pinned reads below).
- **`retryWrites` / `retryReads`** — the driver transparently retries once on a
  transient network blip or a replica-set **failover/election** (routine on a
  multi-region cluster), so a step-down doesn't surface as a user-facing error.

No client-level `readPreference` is set on purpose — the **connection string**
decides where non-critical reads go.

### 2. Critical read-after-write reads pinned to PRIMARY

`db.ts` exports a shared constant:

```ts
export const PRIMARY_READ = { readPreference: "primary" as const };
```

In the Node driver a **per-operation** `readPreference` overrides the
client/URI default for that one call. We pass `PRIMARY_READ` on exactly the
reads that must observe a just-written doc:

| File | Call site | Why it must be consistent |
| --- | --- | --- |
| `src/lib/member-auth.ts` | `memberFromSessionToken` → `sessions.findOne` | sign-in then an immediate authed API call must find the new session |
| `src/lib/member-auth.ts` | `refreshSession` → `sessions.findOne` | a freshly minted (e.g. watch-handoff) session may be refreshed at once |
| `src/lib/member-auth.ts` | `consumeMagicLink` → `magicLinkTokens.findOne` | issue-then-verify within a second (fast tap / scanner prefetch) |
| `src/lib/member-auth.ts` | `consumeMagicLinkByCode` → `magicLinkTokens.find` | same, for the typed 6-char code path |
| `src/lib/referral.ts` | `creditReferralOnActivation` / `extendActiveMembership` → `memberships.findOne({status:"active"})` | reads the membership the webhook activated a moment earlier (money path) |
| `src/app/api/v1/webhooks/stripe/route.ts` | mock-path membership lookup + `findMembership` | the webhook must see the `pending` membership `POST /checkout` just wrote |
| `src/app/api/v1/uploads/bloodwork/confirm/route.ts` | `bloodworkUploads.findOne` | the confirm request reads the upload the previous request just created |

Idempotency ledgers (`processed_webhook_events`) and the referral
`pending → credited` / held-balance transitions use atomic `findOneAndUpdate` /
upsert, which are **primary operations by nature** — they never decide from a
secondary — so they need no extra pin.

### 3. What is deliberately LEFT on the URI's read preference

To keep the geo replicas useful, **non-critical** reads are *not* pinned — they
can tolerate a few seconds of lag: admin lists (results queue, KPIs, access
log, support), members list, results/insights history, share-link GP summary
reads, gift lookups, and the magic-link **resend-throttle** read (worst case: an
extra email). If reads are pointed at secondaries, this is the traffic that
benefits from them.

## Recommended production connection string

Append the durability options to `MONGODB_URI` (they mirror the client defaults,
belt-and-braces, and make the intent visible in the secret):

```
mongodb+srv://<user>:<pass>@<cluster>/arcaevo?retryWrites=true&w=majority
```

- **If you do NOT set a secondary read preference** (recommended default): every
  read is served from the **primary** and the whole app is fully consistent —
  the pins above are simply no-ops.
- **If you DO add** `readPreference=secondaryPreferred` (or `nearest`) to use the
  Asia/USA replicas for read scaling: the app is **still correct**, because the
  auth/payment/upload read-after-write paths pin themselves to primary while the
  rest happily read from the nearest replica.

## Alternative: causally-consistent sessions

If you later want **even the pinned reads** served from replicas (to fully
offload the primary), switch those flows to a **causally-consistent client
session** (`client.startSession({ causalConsistency: true })`) and thread it
through the write and the following read. Causal consistency guarantees a
session "reads its own writes" from a secondary by waiting for the replica to
catch up to the write's timestamp — at the cost of a little added read latency
and the plumbing of passing a session handle through each flow. Pinning to
primary is simpler and was chosen for now; causal sessions are the documented
upgrade path.
