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
 */
import { collections } from "@/lib/db";
import { newId } from "@/lib/ids";
import type { AdminRole } from "@/lib/models";

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
}

/**
 * Append an access-log record. Fire-and-forget — returns immediately; the
 * insert runs detached and can never throw into the caller.
 */
export function logAdminAccess(entry: AdminAccessEntry): void {
  void (async () => {
    try {
      const col = await collections.adminAccessLog();
      await col.insertOne({
        _id: newId("aal"),
        at: new Date(),
        action: entry.action,
        adminId: entry.adminId ?? null,
        email: entry.email ?? null,
        role: entry.role ?? null,
        outcome: entry.outcome ?? "success",
        targetMemberId: entry.targetMemberId ?? null,
        ip: entry.ip ?? null,
      });
    } catch {
      // Best-effort: never break the audited request. (No credential/health
      // data is in `entry`, so there is nothing sensitive to fall back on.)
    }
  })();
}
