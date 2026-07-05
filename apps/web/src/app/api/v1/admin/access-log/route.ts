/**
 * GET /api/v1/admin/access-log — owner-only viewer over the admin access log
 * (DPIA R4 / GDPR Art.32 accountability, docs/MOCKED_APIS.md §3). Returns the
 * most recent rows, newest first, capped at 200.
 *
 * The log stores the FACT of access only — who (adminId/email/role) did what
 * (action) to whose record (targetMemberId), when (at) and from where (ip) —
 * and NEVER any health value, so exposing it to an owner adds no new Art.9
 * surface. No secrets live in this collection.
 */
import { currentAdmin, requireAdminRole } from "@/lib/auth";
import { logAdminAccess } from "@/lib/admin-audit";
import { collections } from "@/lib/db";

const MAX_ROWS = 200;

export async function GET() {
  const denied = await requireAdminRole("owner");
  if (denied) return denied;

  const log = await collections.adminAccessLog();
  const rows = await log.find().sort({ at: -1 }).limit(MAX_ROWS).toArray();

  const admin = await currentAdmin();
  logAdminAccess({
    action: "admin.access_log.read",
    adminId: admin?.adminId ?? null,
    role: admin?.role ?? null,
  });

  return Response.json({
    entries: rows.map((r) => ({
      id: r._id,
      at: r.at,
      action: r.action,
      adminId: r.adminId ?? null,
      email: r.email ?? null,
      role: r.role ?? null,
      outcome: r.outcome,
      targetMemberId: r.targetMemberId ?? null,
      ip: r.ip ?? null,
    })),
    count: rows.length,
  });
}
