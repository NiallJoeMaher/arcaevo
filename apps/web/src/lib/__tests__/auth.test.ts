/**
 * Unit tests for src/lib/auth.ts — HMAC-signed admin session cookie.
 *
 * auth.ts imports `next/headers` and `@/lib/db` at module scope for the
 * cookie-store / member-lookup helpers; the pure sign/verify functions under
 * test never touch them, so both are stubbed out. Cookie-store integration
 * (setAdminSessionCookie / isAdmin / requireAdmin over real requests) is
 * covered by the e2e suite.
 */
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => {
    throw new Error("cookie store must not be touched in unit tests");
  },
}));
vi.mock("@/lib/db", () => ({
  PRIMARY_READ: { readPreference: "primary" },
  collections: {},
}));

import {
  createAdminSessionValue,
  readAdminSession,
  verifyAdminPassword,
  verifyAdminSessionValue,
} from "@/lib/auth";

const SECRET = "unit-test-session-secret";

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", SECRET);
  vi.stubEnv("ADMIN_PASSWORD", "hunter2-admin");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("admin session sign → verify roundtrip", () => {
  it("verifies a freshly signed session value (default bootstrap owner)", () => {
    const value = createAdminSessionValue();
    expect(verifyAdminSessionValue(value)).toBe(true);
  });

  it("round-trips the admin identity (adminId + role)", () => {
    const value = createAdminSessionValue(
      { adminId: "adm_ops", role: "ops" },
      new Date("2026-07-02T08:00:00Z")
    );
    expect(readAdminSession(value)).toEqual({
      adminId: "adm_ops",
      role: "ops",
      iat: "2026-07-02T08:00:00.000Z",
    });
  });

  it("payload is base64url JSON with adminId+role+iat, dot-separated from the sig", () => {
    const value = createAdminSessionValue(
      { adminId: "adm_owner", role: "owner" },
      new Date("2026-07-02T08:00:00Z")
    );
    const dot = value.lastIndexOf(".");
    const payload = JSON.parse(
      Buffer.from(value.slice(0, dot), "base64url").toString()
    );
    expect(payload.adminId).toBe("adm_owner");
    expect(payload.role).toBe("owner");
    expect(payload.iat).toBe("2026-07-02T08:00:00.000Z");
  });

  it("treats a legacy {role:'admin'} cookie as an owner session (back-compat)", () => {
    const payload = Buffer.from(
      JSON.stringify({ role: "admin", iat: new Date().toISOString() })
    ).toString("base64url");
    const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
    const session = readAdminSession(`${payload}.${sig}`);
    expect(session?.role).toBe("owner");
  });

  it("rejects a correctly signed payload with an unknown role", () => {
    const payload = Buffer.from(
      JSON.stringify({ adminId: "x", role: "superuser", iat: new Date().toISOString() })
    ).toString("base64url");
    const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
    expect(readAdminSession(`${payload}.${sig}`)).toBeNull();
  });
});

describe("tampered cookies are rejected", () => {
  it("rejects a modified payload with the original signature", () => {
    const value = createAdminSessionValue();
    const dot = value.lastIndexOf(".");
    const sig = value.slice(dot + 1);
    const forgedPayload = Buffer.from(
      JSON.stringify({ role: "admin", iat: "2099-01-01T00:00:00.000Z" })
    ).toString("base64url");
    expect(verifyAdminSessionValue(`${forgedPayload}.${sig}`)).toBe(false);
  });

  it("rejects a modified signature", () => {
    const value = createAdminSessionValue();
    const flipped = value.slice(0, -1) + (value.endsWith("0") ? "1" : "0");
    expect(verifyAdminSessionValue(flipped)).toBe(false);
  });

  it("rejects a correctly signed payload whose role is not admin", () => {
    // Attacker somehow signs a non-admin payload with the real secret:
    // signature checks out, but the role gate still rejects it.
    const payload = Buffer.from(
      JSON.stringify({ role: "member", iat: new Date().toISOString() })
    ).toString("base64url");
    const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
    expect(verifyAdminSessionValue(`${payload}.${sig}`)).toBe(false);
  });

  it("rejects malformed values: undefined, empty, missing dot, garbage payload", () => {
    expect(verifyAdminSessionValue(undefined)).toBe(false);
    expect(verifyAdminSessionValue("")).toBe(false);
    expect(verifyAdminSessionValue("no-dot-here")).toBe(false);
    const sig = createHmac("sha256", SECRET).update("not-json!").digest("hex");
    expect(verifyAdminSessionValue(`not-json!.${sig}`)).toBe(false);
  });
});

describe("wrong secret is rejected", () => {
  it("a value signed under one SESSION_SECRET fails verification under another", () => {
    const value = createAdminSessionValue();
    vi.stubEnv("SESSION_SECRET", "rotated-different-secret");
    expect(verifyAdminSessionValue(value)).toBe(false);
  });
});

describe("verifyAdminPassword", () => {
  it("accepts the configured ADMIN_PASSWORD", () => {
    expect(verifyAdminPassword("hunter2-admin")).toBe(true);
  });

  it("rejects a wrong password (same and different lengths)", () => {
    expect(verifyAdminPassword("hunter2-ADMIN")).toBe(false);
    expect(verifyAdminPassword("nope")).toBe(false);
    expect(verifyAdminPassword("")).toBe(false);
  });

  it("rejects everything when ADMIN_PASSWORD is not configured", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(verifyAdminPassword("")).toBe(false);
    expect(verifyAdminPassword("hunter2-admin")).toBe(false);
  });
});
