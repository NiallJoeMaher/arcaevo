/**
 * Admin access log — DPIA R4 / GDPR Art.32 accountability.
 *
 * Records WHO (adminId/email/role) accessed WHAT (action) of WHOSE record
 * (targetMemberId), WHEN (at) and from where (ip). It stores the *fact* of
 * access only — NEVER any health value — so the log itself is not a new Art.9
 * store. It is what turns "someone with the shared password could see
 * everything" into "we can prove who accessed what" (ADMIN_AUTH_OPTIONS.md).
 *
 * Writes are FIRE-AND-FORGET: a logging failure must never break (or slow) the
 * request it is auditing, so the insert is not awaited by callers and swallows
 * its own errors. The trade-off is that a hard DB outage can drop a log line;
 * acceptable for an audit trail whose write path is best-effort by design.
 *
 * Exception: bulk-PII disclosures (the waitlist CSV export) use the awaitable
 * `logAdminAccessSettled` — on serverless (Vercel) the function can freeze the
 * moment the response is returned, which would race the detached insert and
 * silently drop the one audit row GDPR actually mandates. It still swallows
 * its own errors, so a logging failure never breaks the audited request.
 */
import { collections } from "@/lib/db";
import { newId } from "@/lib/ids";
import type { AdminAccessLog, AdminRole } from "@/lib/models";

export interface AdminAccessEntry {
  /** Dotted action key, e.g. "login" | "results.queue.read" | "result.review.signoff". */
  action: string;
  adminId?: string | null;
  email?: string | null;
  role?: AdminRole | null;
  outcome?: "success" | "failure";
  /** The member whose Art.9 record was touched, when applicable. */
  targetMemberId?: string | null;
  ip?: string | null;
  /**
   * How many records a bulk read/export touched (e.g. "waitlist.export").
   * Stored on the log doc only when provided — like eligibility's changeLog,
   * it lives outside the v2-frozen zod schema (models.ts) by design. Never
   * the data itself, only the size of the disclosure.
   */
  count?: number;
}

/**
 * Awaitable append of an access-log record — resolves once the insert has
 * settled (written or swallowed). Never rejects: a logging failure must never
 * break the audited request. Use this ONLY where the write must land before
 * the response goes out (bulk-PII exports on serverless — see module doc);
 * everything else stays on the fire-and-forget `logAdminAccess`.
 */
export async function logAdminAccessSettled(
  entry: AdminAccessEntry
): Promise<void> {
  try {
    const col = await collections.adminAccessLog();
    // `count` rides outside the v2-frozen zod schema (see AdminAccessEntry).
    const doc: AdminAccessLog & { count?: number } = {
      _id: newId("aal"),
      at: new Date(),
      action: entry.action,
      adminId: entry.adminId ?? null,
      email: entry.email ?? null,
      role: entry.role ?? null,
      outcome: entry.outcome ?? "success",
      targetMemberId: entry.targetMemberId ?? null,
      ip: entry.ip ?? null,
    };
    if (entry.count !== undefined) doc.count = entry.count;
    await col.insertOne(doc);
  } catch {
    // Best-effort: never break the audited request. (No credential/health
    // data is in `entry`, so there is nothing sensitive to fall back on.)
  }
}

/**
 * Append an access-log record. Fire-and-forget — returns immediately; the
 * insert runs detached and can never throw into the caller.
 */
export function logAdminAccess(entry: AdminAccessEntry): void {
  void logAdminAccessSettled(entry);
}
