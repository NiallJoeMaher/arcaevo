/**
 * Idempotent index creation for the hot lookups.
 *
 * Every `createIndex` is idempotent (Mongo no-ops when an equivalent index
 * already exists), so this can run on every boot. It is fire-and-forget from
 * instrumentation.ts `register()` — a request must NEVER block on it, and a
 * failure (e.g. a transient connection blip, or a conflicting legacy index)
 * must NEVER crash the server. Everything here is best-effort and wrapped.
 *
 * The `rate_limits` TTL index is created lazily in src/lib/rate-limit.ts and is
 * intentionally NOT duplicated here.
 */
import { collections } from "@/lib/db";

let started = false;

/**
 * Create all secondary indexes once per process. Safe to call repeatedly; the
 * `started` guard means concurrent boots only fire one pass. Never throws.
 */
export async function ensureIndexes(): Promise<void> {
  if (started) return;
  started = true;

  // Each entry is best-effort and isolated: one failing index must not stop the
  // others. `background`/uniqueness choices match how each field is queried.
  const tasks: Array<Promise<unknown>> = [];
  const push = (p: Promise<unknown>) =>
    tasks.push(p.catch(() => undefined /* legacy conflict / test fake — ignore */));

  try {
    const [
      sessions,
      users,
      magicLinkTokens,
      admins,
      memberships,
      testOrders,
      biomarkerReadings,
      adminAccessLog,
      outbox,
      shareLinks,
      consents,
    ] = await Promise.all([
      collections.sessions(),
      collections.users(),
      collections.magicLinkTokens(),
      collections.admins(),
      collections.memberships(),
      collections.testOrders(),
      collections.biomarkerReadings(),
      collections.adminAccessLog(),
      collections.outbox(),
      collections.shareLinks(),
      collections.consents(),
    ]);

    // Auth path — hit on every authenticated request.
    push(sessions.createIndex({ tokenHash: 1 }, { unique: true, name: "sessions_tokenHash" }));
    // Expired sessions self-clean (legacy rows have no expiresAt → never expire,
    // which a sparse TTL honours by simply not indexing them).
    push(
      sessions.createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, sparse: true, name: "sessions_ttl" }
      )
    );

    // Account lookups.
    push(users.createIndex({ email: 1 }, { unique: true, name: "users_email" }));
    push(admins.createIndex({ email: 1 }, { unique: true, name: "admins_email" }));

    // Magic-link sign-in: looked up by tokenHash, by codeHash, and by email.
    push(magicLinkTokens.createIndex({ tokenHash: 1 }, { name: "mlt_tokenHash" }));
    push(magicLinkTokens.createIndex({ codeHash: 1 }, { sparse: true, name: "mlt_codeHash" }));
    push(magicLinkTokens.createIndex({ email: 1 }, { name: "mlt_email" }));

    // Commerce + health lookups (per-member).
    push(memberships.createIndex({ memberId: 1 }, { name: "memberships_memberId" }));
    push(memberships.createIndex({ stripeSubscriptionId: 1 }, { sparse: true, name: "memberships_subId" }));
    push(testOrders.createIndex({ memberId: 1 }, { name: "test_orders_memberId" }));
    push(testOrders.createIndex({ vendorOrderId: 1 }, { sparse: true, name: "test_orders_vendorOrderId" }));
    // Baseline/verdict queries filter {memberId, code} and sort by takenAt.
    push(
      biomarkerReadings.createIndex(
        { memberId: 1, code: 1, takenAt: 1 },
        { name: "readings_member_code_takenAt" }
      )
    );

    // Share links (GP share token) + Art.9 consent audit.
    push(shareLinks.createIndex({ token: 1 }, { unique: true, name: "share_links_token" }));
    push(consents.createIndex({ userId: 1 }, { name: "consents_userId" }));

    // Admin access log — read by recency and by acting admin (DPIA R4).
    push(adminAccessLog.createIndex({ at: -1 }, { name: "aal_at" }));
    push(adminAccessLog.createIndex({ adminId: 1, at: -1 }, { name: "aal_adminId_at" }));

    // Outbox — scanned by template/recipient in ops tooling.
    push(outbox.createIndex({ to: 1, createdAt: -1 }, { name: "outbox_to_createdAt" }));

    await Promise.all(tasks);
  } catch {
    // A connection failure at boot must not take the server down; indexes will
    // be retried on the next process start.
  }
}
