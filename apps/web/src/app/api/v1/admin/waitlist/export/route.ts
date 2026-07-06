/**
 * GET /api/v1/admin/waitlist/export — CSV download of EVERY waitlist entry
 * (Task 7b). The /admin/waitlist demand view shows aggregates; this is how the
 * founder actually contacts people when an area opens ("one email when your
 * area opens" — §14 X5), so it returns the individual rows, newest first,
 * uncapped.
 *
 * GDPR: this discloses personal data (name + email) in bulk, so — per the
 * DPIA-R4 pattern used by every other admin read of member data — the export
 * is role-gated to owner|ops (models.ts role split: ops owns waitlist work;
 * a clinician's remit is result review, not bulk marketing PII) and each
 * download is recorded in `admin_access_log` ("waitlist.export",
 * adminId/role/ip + row count; never the data itself). The audit write is
 * AWAITED before the response is built: on serverless the function can
 * freeze right after responding, which would race a detached insert and
 * drop the mandatory audit row. The /admin/waitlist PAGE stays un-role-gated
 * like the other ops pages (only /admin/access-log gates by role in-page);
 * the page shows at most 200 rows on screen — the bulk disclosure is here.
 *
 * CSV safety: fields go through src/lib/csv.ts — RFC-4180 escaping plus
 * formula-injection hardening (leading =+-@ is apostrophe-prefixed), since
 * names are attacker-controlled form input destined for a spreadsheet.
 */
import { currentAdmin, requireAdminRole } from "@/lib/auth";
import { logAdminAccessSettled } from "@/lib/admin-audit";
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
  // Segment marker: "true" = launch-gate join from an ELIGIBLE area (waiting
  // for sales to open), empty = genuine expansion demand. Keeps the export as
  // honest as the /admin/waitlist aggregates.
  "eligibleAtJoin",
] as const;

export async function GET(req: Request) {
  // Owner|ops only (401 signed-out, 403 clinician) — see the header comment.
  const denied = await requireAdminRole("owner", "ops");
  if (denied) return denied;

  const entries = await collections
    .waitlist()
    .then((c) => c.find().sort({ createdAt: -1 }).toArray());

  const admin = await currentAdmin();
  // Awaited (unlike the fire-and-forget siblings, by design): a serverless
  // freeze after the response would otherwise race the insert and lose the
  // audit row for a bulk PII download. logAdminAccessSettled never throws,
  // so a logging failure still doesn't break the export.
  await logAdminAccessSettled({
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
      e.eligibleAtJoin ? "true" : "",
    ])
  );

  const stamp = new Date().toISOString().slice(0, 10);
  // Leading UTF-8 BOM (F8): Excel opens BOM-less UTF-8 CSVs as ANSI and
  // garbles Irish names (Sinéad → SinÃ©ad). Added here — not in the csv
  // helper — because the BOM is a transport/file concern, not part of the
  // RFC-4180 document itself.
  return new Response("\uFEFF" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="arcaevo-waitlist-${stamp}.csv"`,
      // Personal data — never let a shared cache retain it.
      "Cache-Control": "no-store",
    },
  });
}
