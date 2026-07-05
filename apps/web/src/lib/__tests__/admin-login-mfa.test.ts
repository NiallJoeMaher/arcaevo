/**
 * Integration test of the TWO-STEP admin login across the real route handlers
 * (POST /api/v1/admin/login and POST /api/v1/admin/login/mfa):
 *
 *  - a NO-MFA admin logs in in one step (the default path — proves the e2e
 *    password login is unchanged: an admin session cookie is set immediately);
 *  - an MFA admin's step 1 returns { mfaRequired: true } and sets NO admin
 *    session (only a short-lived pending cookie);
 *  - step 2 with a wrong code is rejected (no session);
 *  - step 2 with a valid TOTP issues the admin session and clears the pending
 *    cookie;
 *  - the pending cookie is NOT accepted as an admin session (readAdminSession).
 *
 * Cookies (next/headers) are an in-memory jar; @/lib/db is an in-memory admins
 * store. IP rate-limiting is disabled so no rate_limits collection is needed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Admin, AdminAccessLog } from "@/lib/models";

const adminsStore = new Map<string, Admin>();
const accessLog: AdminAccessLog[] = [];
const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined,
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name),
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
      updateOne: async (
        q: { _id: string },
        update: { $set?: Record<string, unknown> }
      ) => {
        const cur = adminsStore.get(q._id);
        if (cur && update.$set) {
          const next = { ...cur } as Admin & Record<string, unknown>;
          for (const [k, v] of Object.entries(update.$set)) {
            if (k === "mfa.backupCodeHashes" && next.mfa) {
              next.mfa = { ...next.mfa, backupCodeHashes: v as string[] };
            } else {
              (next as Record<string, unknown>)[k] = v;
            }
          }
          adminsStore.set(q._id, next);
        }
        return { matchedCount: cur ? 1 : 0 };
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
import {
  generateBackupCodes,
  generateTotpSecret,
  sealSecret,
  totpNow,
  MFA_PENDING_COOKIE_NAME,
} from "@/lib/admin-mfa";
import { ADMIN_COOKIE_NAME, readAdminSession } from "@/lib/auth";
import { POST as loginPOST } from "@/app/api/v1/admin/login/route";
import { POST as loginMfaPOST } from "@/app/api/v1/admin/login/mfa/route";

function jsonReq(url: string, body: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function enrolMfa(id: string): Promise<{ secret: string; codes: string[] }> {
  const admin = adminsStore.get(id)!;
  const secret = generateTotpSecret();
  const { codes, hashes } = generateBackupCodes();
  adminsStore.set(id, {
    ...admin,
    mfa: {
      enabledAt: new Date(),
      secretEnc: sealSecret(secret),
      backupCodeHashes: hashes,
    },
  });
  return { secret, codes };
}

beforeEach(async () => {
  vi.stubEnv("SESSION_SECRET", "unit-test-session-secret");
  vi.stubEnv("MFA_ENC_KEY", "unit-test-mfa-encryption-key-long-and-random");
  vi.stubEnv("RATE_LIMIT_DISABLED", "true");
  adminsStore.clear();
  accessLog.length = 0;
  cookieJar.clear();
});

afterEach(() => vi.unstubAllEnvs());

describe("two-step admin login", () => {
  it("NO-MFA admin: one-step login issues the session immediately (default path)", async () => {
    await createAdmin({
      _id: "adm_plain",
      email: "plain@a.local",
      password: "correct-horse-battery",
      role: "ops",
    });

    const res = await loginPOST(
      jsonReq("/api/v1/admin/login", {
        email: "plain@a.local",
        password: "correct-horse-battery",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, role: "ops" });
    expect(body.mfaRequired).toBeUndefined();
    // The admin session cookie is set right away — nothing changed for e2e.
    const session = readAdminSession(cookieJar.get(ADMIN_COOKIE_NAME));
    expect(session?.adminId).toBe("adm_plain");
    expect(cookieJar.get(MFA_PENDING_COOKIE_NAME)).toBeUndefined();
  });

  it("MFA admin: step 1 challenges (no session), step 2 with a valid TOTP signs in", async () => {
    await createAdmin({
      _id: "adm_mfa",
      email: "mfa@a.local",
      password: "correct-horse-battery",
      role: "owner",
    });
    const { secret } = await enrolMfa("adm_mfa");

    // --- step 1: password OK → mfaRequired, NO admin session yet ------------
    const res1 = await loginPOST(
      jsonReq("/api/v1/admin/login", {
        email: "mfa@a.local",
        password: "correct-horse-battery",
      })
    );
    const body1 = await res1.json();
    expect(res1.status).toBe(200);
    expect(body1).toEqual({ mfaRequired: true });
    // Crucially: no admin session cookie, only the short-lived pending token.
    expect(cookieJar.get(ADMIN_COOKIE_NAME)).toBeUndefined();
    const pending = cookieJar.get(MFA_PENDING_COOKIE_NAME);
    expect(pending).toBeTruthy();
    // The pending token must NOT be usable as an admin session.
    expect(readAdminSession(pending)).toBeNull();

    // --- step 2a: wrong code → rejected, still no session -------------------
    const resWrong = await loginMfaPOST(
      jsonReq("/api/v1/admin/login/mfa", { code: "000000" })
    );
    expect(resWrong.status).toBe(401);
    expect(cookieJar.get(ADMIN_COOKIE_NAME)).toBeUndefined();

    // --- step 2b: valid TOTP → session issued, pending cleared -------------
    const res2 = await loginMfaPOST(
      jsonReq("/api/v1/admin/login/mfa", { code: totpNow(secret) })
    );
    const body2 = await res2.json();
    expect(res2.status).toBe(200);
    expect(body2).toEqual({ ok: true, role: "owner" });
    const session = readAdminSession(cookieJar.get(ADMIN_COOKIE_NAME));
    expect(session?.adminId).toBe("adm_mfa");
    expect(cookieJar.get(MFA_PENDING_COOKIE_NAME)).toBeUndefined();
  });

  it("step 2 without a pending cookie is rejected (can't skip step 1)", async () => {
    await createAdmin({
      _id: "adm_mfa2",
      email: "mfa2@a.local",
      password: "pw",
      role: "owner",
    });
    await enrolMfa("adm_mfa2");
    // No prior step 1 → no pending cookie.
    const res = await loginMfaPOST(
      jsonReq("/api/v1/admin/login/mfa", { code: "123456" })
    );
    expect(res.status).toBe(401);
    expect(cookieJar.get(ADMIN_COOKIE_NAME)).toBeUndefined();
  });
});
