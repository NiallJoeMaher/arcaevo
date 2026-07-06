/**
 * Unit tests for GET /api/v1/admin/waitlist/export (Task 7b):
 *  - requireAdmin gate: 401 with no/garbage session cookie;
 *  - authenticated: 200 text/csv attachment with the exact header row,
 *    newest-first rows, RFC-4180 + formula-injection-safe fields;
 *  - GDPR/DPIA-R4: every export writes a "waitlist.export" row (with count)
 *    to admin_access_log — and never the entries themselves.
 *
 * Same idiom as admin-management.test.ts: `next/headers` and `@/lib/db` are
 * stubbed in-memory; the HMAC session + guard logic run for real. The session
 * uses the synthetic "bootstrap-owner" identity, which skips the admins-DB
 * lookup (auth.ts SYNTHETIC_ADMIN_IDS).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WaitlistEntry } from "@/lib/models";

type LogDoc = { _id: string; action: string; count?: number } & Record<
  string,
  unknown
>;

const waitlistDocs: WaitlistEntry[] = [];
const accessLog: LogDoc[] = [];
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
    // currentAdmin() only hits `admins` for non-synthetic ids; present for safety.
    admins: async () => ({ findOne: async () => null }),
  },
}));

import { createAdminSessionValue } from "@/lib/auth";
import { GET } from "@/app/api/v1/admin/waitlist/export/route";

const req = () =>
  new Request("http://t/api/v1/admin/waitlist/export", {
    headers: { "x-forwarded-for": "1.2.3.4" },
  });

/** logAdminAccess is fire-and-forget — let its detached insert settle. */
const flushLog = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "unit-test-session-secret");
  waitlistDocs.length = 0;
  accessLog.length = 0;
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
    }
  );
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/v1/admin/waitlist/export", () => {
  it("401s with no session cookie and with a forged cookie, and logs nothing", async () => {
    expect((await GET(req())).status).toBe(401);
    cookieValue = "garbage.signature";
    expect((await GET(req())).status).toBe(401);
    await flushLog();
    expect(accessLog.length).toBe(0);
  });

  it("returns a no-store text/csv attachment with the exact header row", async () => {
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

    const lines = (await res.text()).split("\r\n");
    expect(lines[0]).toBe(
      "name,email,routingKey,county,planInterest,position,createdAt"
    );
    // Newest first; missing name/planInterest are empty fields.
    expect(lines[2]).toBe(
      ",sinead@example.ie,T12,Cork,,1,2026-06-01T10:00:00.000Z"
    );
    // Formula-injection-hardened AND RFC-4180-quoted (name contains a comma).
    expect(lines[1]).toBe(
      "\"'=HYPERLINK(\"\"http://evil\"\"), Bobby\",evil@example.ie,H91,Galway,performance,1,2026-06-02T10:00:00.000Z"
    );
  });

  it("records the export in admin_access_log (action + count, never the data)", async () => {
    cookieValue = createAdminSessionValue({
      adminId: "bootstrap-owner",
      role: "owner",
    });
    await GET(req());
    await flushLog();

    expect(accessLog.length).toBe(1);
    const entry = accessLog[0];
    expect(entry.action).toBe("waitlist.export");
    expect(entry.adminId).toBe("bootstrap-owner");
    expect(entry.role).toBe("owner");
    expect(entry.ip).toBe("1.2.3.4");
    expect(entry.count).toBe(2);
    // The log stores the FACT of the export only — no emails/names.
    expect(JSON.stringify(entry)).not.toContain("example.ie");
  });
});
