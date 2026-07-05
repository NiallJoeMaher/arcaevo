/**
 * Unit tests for self-hosted admin auth: per-admin account verification
 * (src/lib/admin-auth.ts), the role gate (src/lib/auth.ts requireAdminRole),
 * the bootstrap-owner password-only path, and the access-log helper
 * (src/lib/admin-audit.ts).
 *
 * `next/headers` (cookie store) and `@/lib/db` (collections) are stubbed with
 * in-memory fakes so the crypto + logic run for real without a database.
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

vi.mock("@/lib/db", () => ({
  collections: {
    admins: async () => ({
      findOne: async (q: { email?: string; _id?: string }) => {
        for (const a of adminsStore.values()) {
          if (q.email && a.email === q.email) return a;
          if (q._id && a._id === q._id) return a;
        }
        return null;
      },
      insertOne: async (d: Admin) => {
        adminsStore.set(d._id, d);
        return { insertedId: d._id };
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

import {
  createAdmin,
  resolveBootstrapOwner,
  verifyAdminCredentials,
} from "@/lib/admin-auth";
import { createAdminSessionValue, requireAdminRole } from "@/lib/auth";
import { logAdminAccess } from "@/lib/admin-audit";

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "unit-test-session-secret");
  vi.stubEnv("ADMIN_PASSWORD", "change-me-local");
  adminsStore.clear();
  accessLog.length = 0;
  cookieValue = undefined;
});

afterEach(() => vi.unstubAllEnvs());

describe("verifyAdminCredentials", () => {
  it("accepts a valid email + password and returns the identity (email lowercased)", async () => {
    await createAdmin({
      _id: "adm_c",
      email: "Clin@Arcaevo.local",
      password: "pw-correct-horse",
      role: "clinician",
      name: "C",
    });
    const id = await verifyAdminCredentials("clin@arcaevo.local", "pw-correct-horse");
    expect(id).toEqual({
      adminId: "adm_c",
      role: "clinician",
      email: "clin@arcaevo.local",
    });
  });

  it("rejects a wrong password", async () => {
    await createAdmin({ _id: "adm_o", email: "o@a.local", password: "right", role: "ops" });
    expect(await verifyAdminCredentials("o@a.local", "wrong")).toBeNull();
  });

  it("rejects an unknown email (runs scrypt anyway — no timing enumeration)", async () => {
    expect(await verifyAdminCredentials("nobody@a.local", "whatever")).toBeNull();
  });

  it("rejects a disabled account even with the right password", async () => {
    const a = await createAdmin({ _id: "adm_d", email: "d@a.local", password: "right", role: "ops" });
    adminsStore.set(a._id, { ...a, disabledAt: new Date() });
    expect(await verifyAdminCredentials("d@a.local", "right")).toBeNull();
  });
});

describe("resolveBootstrapOwner (password-only path)", () => {
  it("binds to a seeded owner account when one exists", async () => {
    await createAdmin({
      _id: "adm_owner",
      email: "owner@arcaevo.local",
      password: "change-me-local",
      role: "owner",
    });
    expect(await resolveBootstrapOwner()).toEqual({
      adminId: "adm_owner",
      role: "owner",
      email: "owner@arcaevo.local",
    });
  });

  it("falls back to a synthetic owner identity when no account exists", async () => {
    const id = await resolveBootstrapOwner();
    expect(id.role).toBe("owner");
    expect(id.adminId).toBe("bootstrap-owner");
  });
});

describe("requireAdminRole (role gate)", () => {
  it("401s when there is no session", async () => {
    const res = await requireAdminRole("clinician", "owner");
    expect(res?.status).toBe(401);
  });

  it("allows a permitted role (owner on a clinician|owner action)", async () => {
    cookieValue = createAdminSessionValue({ adminId: "adm_owner", role: "owner" });
    expect(await requireAdminRole("clinician", "owner")).toBeNull();
  });

  it("allows the clinician role on the clinician sign-off gate", async () => {
    cookieValue = createAdminSessionValue({ adminId: "adm_clinician", role: "clinician" });
    expect(await requireAdminRole("clinician", "owner")).toBeNull();
  });

  it("403s a disallowed role (ops on a clinician-only action)", async () => {
    cookieValue = createAdminSessionValue({ adminId: "adm_ops", role: "ops" });
    const res = await requireAdminRole("clinician", "owner");
    expect(res?.status).toBe(403);
  });
});

describe("logAdminAccess", () => {
  it("writes the who/what/when/whose-record shape (no health values)", async () => {
    logAdminAccess({
      action: "result.review.signoff",
      adminId: "adm_owner",
      role: "owner",
      targetMemberId: "mem_0001",
      ip: "1.2.3.4",
    });
    await flush();
    expect(accessLog).toHaveLength(1);
    const row = accessLog[0];
    expect(row).toMatchObject({
      action: "result.review.signoff",
      adminId: "adm_owner",
      role: "owner",
      outcome: "success",
      targetMemberId: "mem_0001",
      ip: "1.2.3.4",
    });
    expect(row._id).toMatch(/^aal_/);
    expect(row.at).toBeInstanceOf(Date);
    // No health value fields leak into the audit row.
    expect(Object.keys(row).sort()).toEqual(
      ["_id", "action", "adminId", "at", "email", "ip", "outcome", "role", "targetMemberId"].sort()
    );
  });

  it("defaults optional fields to null and outcome to success", async () => {
    logAdminAccess({ action: "login", outcome: "failure", email: "x@a.local", ip: "9.9.9.9" });
    await flush();
    const row = accessLog.find((r) => r.outcome === "failure")!;
    expect(row).toMatchObject({
      adminId: null,
      role: null,
      targetMemberId: null,
      email: "x@a.local",
    });
  });
});
