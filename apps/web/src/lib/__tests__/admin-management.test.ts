/**
 * Unit tests for the OWNER-only admin-management route handlers
 * (src/app/api/v1/admin/admins/**). Covers the guards that matter most:
 *  - owner-only: ops/clinician get 403, no session gets 401;
 *  - the list response NEVER leaks passwordHash;
 *  - create rejects a duplicate email (409);
 *  - disable refuses self-lockout (400) and the last enabled owner (400).
 *
 * `next/headers` (cookie store) and `@/lib/db` (collections) are stubbed with
 * in-memory fakes — the crypto + guard logic run for real without a database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Admin, AdminAccessLog } from "@/lib/models";

const adminsStore = new Map<string, Admin>();
const accessLog: AdminAccessLog[] = [];
let cookieValue: string | undefined;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (cookieValue !== undefined ? { value: cookieValue } : undefined),
    set: () => {},
    delete: () => {},
  }),
}));

type Query = Partial<Record<"_id" | "email" | "role", string>> & {
  disabledAt?: null;
};

function matches(a: Admin, q: Query): boolean {
  if (q._id !== undefined && a._id !== q._id) return false;
  if (q.email !== undefined && a.email !== q.email) return false;
  if (q.role !== undefined && a.role !== q.role) return false;
  if (q.disabledAt === null && (a.disabledAt ?? null) !== null) return false;
  return true;
}
const all = (q: Query = {}) =>
  [...adminsStore.values()].filter((a) => matches(a, q));

vi.mock("@/lib/db", () => ({
  collections: {
    admins: async () => ({
      find: (q: Query = {}) => ({
        sort: () => ({ toArray: async () => all(q) }),
        toArray: async () => all(q),
      }),
      findOne: async (q: Query) => all(q)[0] ?? null,
      insertOne: async (d: Admin) => {
        adminsStore.set(d._id, d);
        return { insertedId: d._id };
      },
      countDocuments: async (q: Query) => all(q).length,
      updateOne: async (q: Query, update: { $set?: Partial<Admin> }) => {
        const doc = all(q)[0];
        if (doc && update.$set) Object.assign(doc, update.$set);
        return { matchedCount: doc ? 1 : 0 };
      },
    }),
    adminAccessLog: async () => ({
      insertOne: async (d: AdminAccessLog) => {
        accessLog.push(d);
        return { insertedId: d._id };
      },
    }),
  },
}));

import { createAdmin } from "@/lib/admin-auth";
import { createAdminSessionValue } from "@/lib/auth";
import { GET, POST } from "@/app/api/v1/admin/admins/route";
import { POST as disablePost } from "@/app/api/v1/admin/admins/[id]/disable/route";

function req(body?: unknown): Request {
  return new Request("http://t/", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const signIn = (adminId: string, role: "owner" | "ops" | "clinician") => {
  cookieValue = createAdminSessionValue({ adminId, role });
};

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "unit-test-session-secret");
  vi.stubEnv("ADMIN_PASSWORD", "change-me-local");
  adminsStore.clear();
  accessLog.length = 0;
  cookieValue = undefined;
});
afterEach(() => vi.unstubAllEnvs());

async function seedOwner(id = "adm_owner") {
  await createAdmin({ _id: id, email: `${id}@a.local`, password: "x", role: "owner" });
}

describe("GET /api/v1/admin/admins (list)", () => {
  it("401s with no session, 403s for ops/clinician", async () => {
    expect((await GET()).status).toBe(401);

    await createAdmin({ _id: "adm_ops", email: "ops@a.local", password: "x", role: "ops" });
    signIn("adm_ops", "ops");
    expect((await GET()).status).toBe(403);

    await createAdmin({ _id: "adm_cl", email: "cl@a.local", password: "x", role: "clinician" });
    signIn("adm_cl", "clinician");
    expect((await GET()).status).toBe(403);
  });

  it("NEVER returns passwordHash or the MFA secret/backup hashes (only mfaEnabled)", async () => {
    await seedOwner();
    await createAdmin({ _id: "adm_ops", email: "ops@a.local", password: "secret-pw", role: "ops" });
    // Give one admin real MFA state so we prove the sealed secret + backup
    // hashes never surface — only the mfaEnabled boolean does.
    const withMfa = adminsStore.get("adm_ops")!;
    adminsStore.set("adm_ops", {
      ...withMfa,
      mfa: {
        enabledAt: new Date(),
        secretEnc: {
          ciphertext: "SEALED-CIPHERTEXT-XYZ",
          iv: "SEALED-IV-XYZ",
          tag: "SEALED-TAG-XYZ",
        },
        backupCodeHashes: ["BACKUPHASH-AAA", "BACKUPHASH-BBB"],
      },
    });
    signIn("adm_owner", "owner");

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.admins.length).toBe(2);
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain("passwordHash");
    expect(serialised).not.toContain("scrypt");
    // The sealed secret + backup-code hashes must never appear anywhere.
    expect(serialised).not.toContain("secretEnc");
    expect(serialised).not.toContain("SEALED-CIPHERTEXT-XYZ");
    expect(serialised).not.toContain("BACKUPHASH-AAA");
    expect(serialised).not.toContain("backupCodeHashes");
    for (const a of body.admins) {
      expect(a).not.toHaveProperty("passwordHash");
      expect(a).not.toHaveProperty("mfa");
      expect(typeof a.mfaEnabled).toBe("boolean");
      expect(Object.keys(a).sort()).toEqual(
        ["createdAt", "disabledAt", "email", "id", "mfaEnabled", "name", "role"].sort()
      );
    }
    // The mfaEnabled flag reflects the underlying state.
    const opsRow = body.admins.find((a: { id: string }) => a.id === "adm_ops");
    expect(opsRow.mfaEnabled).toBe(true);
  });
});

describe("POST /api/v1/admin/admins (create)", () => {
  it("403s for a non-owner", async () => {
    await createAdmin({ _id: "adm_ops", email: "ops@a.local", password: "x", role: "ops" });
    signIn("adm_ops", "ops");
    const res = await POST(req({ email: "new@a.local", role: "ops", password: "0123456789" }));
    expect(res.status).toBe(403);
  });

  it("creates an admin (owner) and returns no passwordHash", async () => {
    await seedOwner();
    signIn("adm_owner", "owner");
    const res = await POST(
      req({ email: "New@A.local", role: "clinician", name: "New", password: "0123456789" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.admin.email).toBe("new@a.local"); // lowercased
    expect(body.admin).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(body)).not.toContain("scrypt");
  });

  it("409s a duplicate email", async () => {
    await seedOwner();
    await createAdmin({ _id: "adm_dupe", email: "dupe@a.local", password: "x", role: "ops" });
    signIn("adm_owner", "owner");
    const res = await POST(req({ email: "dupe@a.local", role: "ops", password: "0123456789" }));
    expect(res.status).toBe(409);
  });

  it("400s an invalid body (short password)", async () => {
    await seedOwner();
    signIn("adm_owner", "owner");
    const res = await POST(req({ email: "x@a.local", role: "ops", password: "short" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/admin/admins/[id]/disable", () => {
  it("403s for a non-owner", async () => {
    await createAdmin({ _id: "adm_ops", email: "ops@a.local", password: "x", role: "ops" });
    await seedOwner();
    signIn("adm_ops", "ops");
    const res = await disablePost(req(), params("adm_owner"));
    expect(res.status).toBe(403);
  });

  it("rejects disabling YOURSELF (self-lockout)", async () => {
    await seedOwner("adm_owner");
    await seedOwner("adm_owner2"); // a second owner so it's not a last-owner case
    signIn("adm_owner", "owner");
    const res = await disablePost(req(), params("adm_owner"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("self_disable");
    expect(adminsStore.get("adm_owner")!.disabledAt).toBeFalsy();
  });

  it("rejects disabling the LAST enabled owner", async () => {
    await seedOwner("adm_owner"); // the only enabled owner
    // Act as the synthetic bootstrap owner (no DB row ⇒ not counted).
    signIn("bootstrap-owner", "owner");
    const res = await disablePost(req(), params("adm_owner"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("last_owner");
    expect(adminsStore.get("adm_owner")!.disabledAt).toBeFalsy();
  });

  it("disables a non-last, non-self admin and logs it", async () => {
    await seedOwner("adm_owner");
    await createAdmin({ _id: "adm_ops", email: "ops@a.local", password: "x", role: "ops" });
    signIn("adm_owner", "owner");
    const res = await disablePost(req(), params("adm_ops"));
    expect(res.status).toBe(200);
    expect(adminsStore.get("adm_ops")!.disabledAt).toBeInstanceOf(Date);
    await new Promise((r) => setTimeout(r, 0)); // let fire-and-forget log flush
    expect(accessLog.some((e) => e.action === "admin.account.disable")).toBe(true);
  });

  it("404s an unknown admin id", async () => {
    await seedOwner();
    signIn("adm_owner", "owner");
    const res = await disablePost(req(), params("adm_nope"));
    expect(res.status).toBe(404);
  });
});
