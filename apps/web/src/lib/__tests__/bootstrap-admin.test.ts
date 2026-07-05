/**
 * Unit tests for the first-boot admin bootstrap (ensureBootstrapAdmin,
 * src/lib/admin-auth.ts). The seed script wipes data and is never run in
 * production, so the initial owner must be auto-created from ADMIN_EMAIL /
 * ADMIN_PASSWORD when the `admins` collection is empty — otherwise no one can
 * sign in to /admin (chicken-and-egg).
 *
 * `@/lib/db` is stubbed with an in-memory fake that enforces the unique-key
 * behaviour the real Mongo relies on (duplicate `_id` throws code 11000) so the
 * concurrency guard runs for real, and scrypt runs for real (no crypto mock).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Admin } from "@/lib/models";

const adminsStore = new Map<string, Admin>();
// When true, countDocuments lies and reports the collection empty even though a
// row exists — used to simulate a racing cold-start that inserts AFTER our
// empty-count check but BEFORE our insert (so insertOne then throws E11000).
let forceEmptyCount = false;

vi.mock("@/lib/db", () => ({
  PRIMARY_READ: { readPreference: "primary" },
  collections: {
    admins: async () => ({
      countDocuments: async () => (forceEmptyCount ? 0 : adminsStore.size),
      findOne: async (q: { email?: string; _id?: string }) => {
        for (const a of adminsStore.values()) {
          if (q.email && a.email === q.email) return a;
          if (q._id && a._id === q._id) return a;
        }
        return null;
      },
      insertOne: async (d: Admin) => {
        if (adminsStore.has(d._id)) {
          // Mirror Mongo's unique-`_id` collision (E11000) so the concurrency
          // guard's duplicate-key handling is exercised for real.
          throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
        }
        adminsStore.set(d._id, d);
        return { insertedId: d._id };
      },
    }),
  },
}));

import { ensureBootstrapAdmin, verifyAdminCredentials } from "@/lib/admin-auth";

beforeEach(() => {
  adminsStore.clear();
  forceEmptyCount = false;
  vi.unstubAllEnvs();
});

afterEach(() => vi.unstubAllEnvs());

describe("ensureBootstrapAdmin", () => {
  it("creates a valid owner when admins is empty and env is set", async () => {
    vi.stubEnv("ADMIN_EMAIL", "accounts@arcaevo.com");
    vi.stubEnv("ADMIN_PASSWORD", "s3cret-initial-pw");

    const result = await ensureBootstrapAdmin();
    expect(result).toEqual({ created: true, email: "accounts@arcaevo.com" });

    const admin = adminsStore.get("adm_accounts@arcaevo.com");
    expect(admin).toBeDefined();
    expect(admin!.role).toBe("owner");
    expect(admin!.name).toBe("Owner");
    expect(admin!.disabledAt).toBeNull();
    // A real scrypt hash (member-auth format), never the raw password.
    expect(admin!.passwordHash).toMatch(/^scrypt:16384:8:1:/);
    expect(admin!.passwordHash).not.toContain("s3cret-initial-pw");

    // The created account can actually log in with ADMIN_PASSWORD.
    const id = await verifyAdminCredentials(
      "accounts@arcaevo.com",
      "s3cret-initial-pw"
    );
    expect(id).toEqual({
      adminId: "adm_accounts@arcaevo.com",
      role: "owner",
      email: "accounts@arcaevo.com",
    });
  });

  it("lowercases the email from env", async () => {
    vi.stubEnv("ADMIN_EMAIL", "  Accounts@Arcaevo.com  ");
    vi.stubEnv("ADMIN_PASSWORD", "pw");
    const result = await ensureBootstrapAdmin();
    expect(result).toEqual({ created: true, email: "accounts@arcaevo.com" });
    expect(adminsStore.get("adm_accounts@arcaevo.com")).toBeDefined();
  });

  it("no-ops (never overwrites) when an admin already exists", async () => {
    adminsStore.set("adm_existing", {
      _id: "adm_existing",
      email: "someone@arcaevo.com",
      passwordHash: "scrypt:existing",
      role: "clinician",
      name: "Existing",
      createdAt: new Date(0),
      disabledAt: null,
    });
    vi.stubEnv("ADMIN_EMAIL", "accounts@arcaevo.com");
    vi.stubEnv("ADMIN_PASSWORD", "pw");

    const result = await ensureBootstrapAdmin();
    expect(result).toEqual({ created: false, reason: "admins-exist" });
    // Untouched: still exactly the one pre-existing (non-owner) account.
    expect(adminsStore.size).toBe(1);
    expect(adminsStore.get("adm_existing")!.role).toBe("clinician");
    expect(adminsStore.has("adm_accounts@arcaevo.com")).toBe(false);
  });

  it("no-ops when ADMIN_EMAIL is unset", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "pw");
    const result = await ensureBootstrapAdmin();
    expect(result).toEqual({ created: false, reason: "env-missing" });
    expect(adminsStore.size).toBe(0);
  });

  it("no-ops when ADMIN_PASSWORD is unset", async () => {
    vi.stubEnv("ADMIN_EMAIL", "accounts@arcaevo.com");
    const result = await ensureBootstrapAdmin();
    expect(result).toEqual({ created: false, reason: "env-missing" });
    expect(adminsStore.size).toBe(0);
  });

  it("is idempotent — a second call after creation no-ops", async () => {
    vi.stubEnv("ADMIN_EMAIL", "accounts@arcaevo.com");
    vi.stubEnv("ADMIN_PASSWORD", "pw");
    expect((await ensureBootstrapAdmin()).created).toBe(true);
    expect(await ensureBootstrapAdmin()).toEqual({
      created: false,
      reason: "admins-exist",
    });
    expect(adminsStore.size).toBe(1);
  });

  it("swallows a concurrent-create duplicate-key race as a no-op", async () => {
    vi.stubEnv("ADMIN_EMAIL", "accounts@arcaevo.com");
    vi.stubEnv("ADMIN_PASSWORD", "pw");
    // Simulate the racing cold-start: its row already exists in the store (so
    // OUR insertOne will collide with E11000), but countDocuments is forced to
    // report the collection empty so we get past the empty-count guard and reach
    // the insert. The guard must treat the collision as the desired end state.
    adminsStore.set("adm_accounts@arcaevo.com", {
      _id: "adm_accounts@arcaevo.com",
      email: "accounts@arcaevo.com",
      passwordHash: "scrypt:racer",
      role: "owner",
      createdAt: new Date(),
      disabledAt: null,
    });
    forceEmptyCount = true;
    const result = await ensureBootstrapAdmin();
    expect(result).toEqual({ created: false, reason: "concurrent-create" });
    // The racer's row is left intact (never clobbered).
    expect(adminsStore.get("adm_accounts@arcaevo.com")!.passwordHash).toBe(
      "scrypt:racer"
    );
  });
});
