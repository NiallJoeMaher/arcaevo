/**
 * GET /api/v1/admin/waitlist/export — CSV download of EVERY waitlist entry
 * (Task 7b). The /admin/waitlist demand view shows aggregates; this is how the
 * founder actually contacts people when an area opens ("one email when your
 * area opens" — §14 X5), so it returns the individual rows, newest first,
 * uncapped.
 *
 * GDPR: this discloses personal data (name + email) in bulk, so — per the
 * DPIA-R4 pattern used by every other admin read of member data — the export
 * is requireAdmin-gated and each download is recorded in `admin_access_log`
 * ("waitlist.export", adminId/role/ip + row count; never the data itself).
 *
 * CSV safety: fields go through src/lib/csv.ts — RFC-4180 escaping plus
 * formula-injection hardening (leading =+-@ is apostrophe-prefixed), since
 * names are attacker-controlled form input destined for a spreadsheet.
 */
import { currentAdmin, requireAdmin } from "@/lib/auth";
import { logAdminAccess } from "@/lib/admin-audit";
import { serializeCsv } from "@/lib/csv";
import { collections } from "@/lib/db";
import { clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const HEADER = [
  "name",
  "email",
  "routingKey",
  "county",
  "planInterest",
  "position",
  "createdAt",
] as const;

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const entries = await collections
    .waitlist()
    .then((c) => c.find().sort({ createdAt: -1 }).toArray());

  const admin = await currentAdmin();
  logAdminAccess({
    action: "waitlist.export",
    adminId: admin?.adminId ?? null,
    role: admin?.role ?? null,
    ip: clientIp(req),
    count: entries.length,
  });

  const csv = serializeCsv(
    HEADER,
    entries.map((e) => [
      e.name ?? "",
      e.email,
      e.routingKey,
      e.county,
      e.planInterest ?? "",
      String(e.position),
      e.createdAt.toISOString(),
    ])
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="arcaevo-waitlist-${stamp}.csv"`,
      // Personal data — never let a shared cache retain it.
      "Cache-Control": "no-store",
    },
  });
}
