/**
 * Unit tests for GET /api/v1/admin/waitlist/export (Task 7b):
 *  - role gate (F4): 401 with no/garbage session cookie; 403 for a clinician
 *    (bulk marketing-PII export is ops work, not result review); 200 for
 *    ops and owner — requireAdminRole("owner","ops");
 *  - authenticated: 200 text/csv attachment with a single leading UTF-8 BOM
 *    (F8 — Excel misreads BOM-less UTF-8 as ANSI), the exact header row,
 *    newest-first rows, RFC-4180 + formula-injection-safe fields;
 *  - GDPR/DPIA-R4: every export writes a "waitlist.export" row (with count)
 *    to admin_access_log — and never the entries themselves. The write is
 *    AWAITED before the response (F7 — serverless freeze-after-response
 *    would otherwise race the detached insert), so the row is visible as
 *    soon as GET resolves, no flush needed.
 *
 * Same idiom as admin-management.test.ts: `next/headers` and `@/lib/db` are
 * stubbed in-memory; the HMAC session + guard logic run for real. The owner
 * session uses the synthetic "bootstrap-owner" identity (skips the admins-DB
 * lookup); ops/clinician sessions resolve against the stubbed `admins` docs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WaitlistEntry } from "@/lib/models";

type LogDoc = { _id: string; action: string; count?: number } & Record<
  string,
  unknown
>;

const waitlistDocs: WaitlistEntry[] = [];
const accessLog: LogDoc[] = [];
/** Real (non-synthetic) admin accounts for the role-gate tests. */
const adminDocs: { _id: string; role: string; disabledAt?: Date }[] = [];
let cookieValue: string | undefined;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (cookieValue !== undefined ? { value: cookieValue } : undefined),
    set: () => {},
    delete: () => {},
  }),
}));

vi.mock("@/lib/db", () => ({
  PRIMARY_READ: { readPreference: "primary" },
  collections: {
    waitlist: async () => ({
      find: () => ({
        sort: (spec: Record<string, 1 | -1>) => ({
          toArray: async () => {
            const [[k, dir]] = Object.entries(spec);
            return [...waitlistDocs].sort((a, b) => {
              const av = a[k as keyof WaitlistEntry] as Date;
              const bv = b[k as keyof WaitlistEntry] as Date;
              return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
            });
          },
        }),
      }),
    }),
    adminAccessLog: async () => ({
      insertOne: async (d: LogDoc) => {
        accessLog.push(d);
        return { insertedId: d._id };
      },
    }),
    // currentAdmin() hits `admins` for non-synthetic ids (ops/clinician).
    admins: async () => ({
      findOne: async (filter: { _id: string }) =>
        adminDocs.find((d) => d._id === filter._id) ?? null,
    }),
  },
}));

import { createAdminSessionValue } from "@/lib/auth";
import { GET } from "@/app/api/v1/admin/waitlist/export/route";

const req = () =>
  new Request("http://t/api/v1/admin/waitlist/export", {
    headers: { "x-forwarded-for": "1.2.3.4" },
  });

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "unit-test-session-secret");
  waitlistDocs.length = 0;
  accessLog.length = 0;
  adminDocs.length = 0;
  cookieValue = undefined;
  waitlistDocs.push(
    {
      _id: "wait_0001",
      email: "sinead@example.ie",
      routingKey: "T12",
      county: "Cork",
      position: 1,
      createdAt: new Date("2026-06-01T10:00:00Z"),
    },
    {
      _id: "wait_0002",
      email: "evil@example.ie",
      routingKey: "H91",
      county: "Galway",
      position: 1,
      createdAt: new Date("2026-06-02T10:00:00Z"),
      name: '=HYPERLINK("http://evil"), Bobby',
      planInterest: "performance",
    },
    // Launch-gate join from an ELIGIBLE area (F3): segment column = "true".
    {
      _id: "wait_0003",
      email: "dara.dublin@example.ie",
      routingKey: "D08",
      county: "Dublin",
      position: 1,
      createdAt: new Date("2026-06-03T10:00:00Z"),
      eligibleAtJoin: true,
    }
  );
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/v1/admin/waitlist/export", () => {
  it("401s with no session cookie and with a forged cookie, and logs nothing", async () => {
    expect((await GET(req())).status).toBe(401);
    cookieValue = "garbage.signature";
    expect((await GET(req())).status).toBe(401);
    expect(accessLog.length).toBe(0);
  });

  it("403s a clinician session — bulk marketing-PII export is ops work, not result review (F4)", async () => {
    adminDocs.push({ _id: "adm_clin", role: "clinician" });
    cookieValue = createAdminSessionValue({
      adminId: "adm_clin",
      role: "clinician",
    });
    const res = await GET(req());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("forbidden");
    expect(accessLog.length).toBe(0); // denied ⇒ no export, no audit row
  });

  it("200s an ops session (requireAdminRole owner|ops)", async () => {
    adminDocs.push({ _id: "adm_ops", role: "ops" });
    cookieValue = createAdminSessionValue({ adminId: "adm_ops", role: "ops" });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
  });

  it("returns a no-store text/csv attachment: single leading UTF-8 BOM + exact header row", async () => {
    cookieValue = createAdminSessionValue({
      adminId: "bootstrap-owner",
      role: "owner",
    });
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="arcaevo-waitlist-\d{4}-\d{2}-\d{2}\.csv"$/
    );

    // F8: exactly one BOM, at byte position 0 — Excel opens BOM-less UTF-8
    // as ANSI and garbles Irish names (Sinéad → SinÃ©ad). Read raw bytes:
    // the Fetch spec makes Response.text() STRIP a leading BOM, so text()
    // could never prove it's on the wire.
    const bytes = Buffer.from(await res.arrayBuffer());
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = bytes.toString("utf8"); // Buffer#toString keeps the BOM char
    expect(text.match(/\uFEFF/g)).toHaveLength(1);

    const lines = text.slice(1).split("\r\n"); // strip the BOM; rows unchanged
    expect(lines[0]).toBe(
      "name,email,routingKey,county,planInterest,position,createdAt,eligibleAtJoin"
    );
    // Newest first: the launch-area (eligibleAtJoin) row carries "true" in
    // the segment column so the CSV can tell the segments apart (F3).
    expect(lines[1]).toBe(
      ",dara.dublin@example.ie,D08,Dublin,,1,2026-06-03T10:00:00.000Z,true"
    );
    // Formula-injection-hardened AND RFC-4180-quoted (name contains a comma).
    expect(lines[2]).toBe(
      "\"'=HYPERLINK(\"\"http://evil\"\"), Bobby\",evil@example.ie,H91,Galway,performance,1,2026-06-02T10:00:00.000Z,"
    );
    // Missing name/planInterest/eligibleAtJoin are empty fields.
    expect(lines[3]).toBe(
      ",sinead@example.ie,T12,Cork,,1,2026-06-01T10:00:00.000Z,"
    );
  });

  it("records the export in admin_access_log BEFORE responding (action + count, never the data)", async () => {
    cookieValue = createAdminSessionValue({
      adminId: "bootstrap-owner",
      role: "owner",
    });
    await GET(req());

    // F7: the audit write is AWAITED (serverless freeze-after-response would
    // race a detached insert) — the row must exist as soon as GET resolves.
    expect(accessLog.length).toBe(1);
    const entry = accessLog[0];
    expect(entry.action).toBe("waitlist.export");
    expect(entry.adminId).toBe("bootstrap-owner");
    expect(entry.role).toBe("owner");
    expect(entry.ip).toBe("1.2.3.4");
    expect(entry.count).toBe(3);
    // The log stores the FACT of the export only — no emails/names.
    expect(JSON.stringify(entry)).not.toContain("example.ie");
  });
});
