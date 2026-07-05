/**
 * Unit tests for admin TOTP MFA (src/lib/admin-mfa.ts):
 *  - base32 round-trip
 *  - TOTP against RFC 6238 test vectors + generate→verify + ±1 step window
 *  - AES-256-GCM seal→open round-trip (+ tamper rejection)
 *  - single-use backup codes
 *  - mfa-pending token: sign→read, expiry, and that it is NOT a valid admin
 *    session (readAdminSession rejects it)
 *
 * `@/lib/db` is stubbed with an in-memory admins store so the DB-touching
 * helpers (adminHasMfa, verifyAdminSecondFactor consumption) run for real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Admin } from "@/lib/models";

const adminsStore = new Map<string, Admin>();

vi.mock("@/lib/db", () => ({
  collections: {
    admins: async () => ({
      findOne: async (q: { _id?: string }) =>
        (q._id && adminsStore.get(q._id)) || null,
      updateOne: async (
        q: { _id: string },
        update: { $set?: Record<string, unknown> }
      ) => {
        const cur = adminsStore.get(q._id);
        if (cur && update.$set) {
          // Support the dotted "mfa.backupCodeHashes" set used on consume.
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
  },
}));

import {
  base32Decode,
  base32Encode,
  consumeBackupCode,
  createMfaPendingToken,
  generateBackupCodes,
  generateTotpSecret,
  openSecret,
  readMfaPendingToken,
  sealSecret,
  totpNow,
  totpUri,
  verifyTotp,
  verifyAdminSecondFactor,
  adminHasMfa,
  TOTP_PERIOD_SECONDS,
} from "@/lib/admin-mfa";
import { readAdminSession } from "@/lib/auth";

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "unit-test-session-secret");
  // Explicit MFA key so seal/open is deterministic and independent of prod gate.
  vi.stubEnv("MFA_ENC_KEY", "unit-test-mfa-encryption-key-long-and-random");
  adminsStore.clear();
});

afterEach(() => vi.unstubAllEnvs());

describe("base32", () => {
  it("round-trips arbitrary bytes", () => {
    for (const n of [0, 1, 5, 10, 16, 20, 33]) {
      const buf = Buffer.from(Array.from({ length: n }, (_, i) => (i * 37) & 0xff));
      expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
    }
  });

  it("is case- and separator-insensitive on decode", () => {
    const buf = Buffer.from("hello world");
    const enc = base32Encode(buf);
    const messy = enc.toLowerCase().replace(/(.{4})/g, "$1 ");
    expect(base32Decode(messy).equals(buf)).toBe(true);
  });

  it("uses only the RFC-4648 alphabet", () => {
    expect(base32Encode(Buffer.from("test-secret-1234"))).toMatch(/^[A-Z2-7]+$/);
  });
});

describe("TOTP (RFC 6238)", () => {
  // RFC 6238 Appendix B test vectors for the SHA-1, 8-digit case. We compute
  // 6-digit codes (the low 6 digits of the same 8-digit value).
  const RFC_SECRET_ASCII = "12345678901234567890"; // the seed in the RFC
  const rfcSecretBase32 = base32Encode(Buffer.from(RFC_SECRET_ASCII, "ascii"));

  // t = unix seconds → expected 8-digit TOTP (from the RFC table).
  const vectors: { time: number; eightDigit: string }[] = [
    { time: 59, eightDigit: "94287082" },
    { time: 1111111109, eightDigit: "07081804" },
    { time: 1111111111, eightDigit: "14050471" },
    { time: 1234567890, eightDigit: "89005924" },
    { time: 2000000000, eightDigit: "69279037" },
  ];

  it("matches the RFC 6238 SHA-1 vectors (low 6 digits)", () => {
    for (const v of vectors) {
      const expected6 = v.eightDigit.slice(-6);
      expect(totpNow(rfcSecretBase32, new Date(v.time * 1000))).toBe(expected6);
    }
  });

  it("generate → verify at the same instant", () => {
    const secret = generateTotpSecret();
    const now = new Date("2026-07-05T10:00:00Z");
    expect(verifyTotp(secret, totpNow(secret, now), now)).toBe(true);
  });

  it("accepts the previous and next step (±1 window for clock skew)", () => {
    const secret = generateTotpSecret();
    const now = new Date("2026-07-05T10:00:00Z");
    const stepMs = TOTP_PERIOD_SECONDS * 1000;
    const prev = totpNow(secret, new Date(now.getTime() - stepMs));
    const next = totpNow(secret, new Date(now.getTime() + stepMs));
    expect(verifyTotp(secret, prev, now)).toBe(true);
    expect(verifyTotp(secret, next, now)).toBe(true);
  });

  it("rejects a code two steps away", () => {
    const secret = generateTotpSecret();
    const now = new Date("2026-07-05T10:00:00Z");
    const far = totpNow(secret, new Date(now.getTime() + 2 * TOTP_PERIOD_SECONDS * 1000));
    expect(verifyTotp(secret, far, now)).toBe(false);
  });

  it("rejects malformed codes without throwing", () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, "", new Date())).toBe(false);
    expect(verifyTotp(secret, "12345", new Date())).toBe(false);
    expect(verifyTotp(secret, "abcdef", new Date())).toBe(false);
    expect(verifyTotp("not base32 !!", "123456", new Date())).toBe(false);
  });

  it("builds a well-formed otpauth URI", () => {
    const uri = totpUri({ email: "owner@arcaevo.local", secret: "ABC234" });
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain("secret=ABC234");
    expect(uri).toContain("issuer=Arcaevo+Admin");
    expect(uri).toContain("algorithm=SHA1");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });
});

describe("AES-256-GCM seal/open", () => {
  it("round-trips a secret", () => {
    const secret = generateTotpSecret();
    const sealed = sealSecret(secret);
    expect(sealed.ciphertext).not.toContain(secret);
    expect(openSecret(sealed)).toBe(secret);
  });

  it("produces a fresh IV each time (non-deterministic ciphertext)", () => {
    const s1 = sealSecret("SAMESECRET");
    const s2 = sealSecret("SAMESECRET");
    expect(s1.iv).not.toBe(s2.iv);
    expect(s1.ciphertext).not.toBe(s2.ciphertext);
  });

  it("rejects a tampered auth tag / ciphertext", () => {
    const sealed = sealSecret("ABCDEFGH");
    expect(() => openSecret({ ...sealed, tag: Buffer.alloc(16).toString("base64") })).toThrow();
  });

  it("fails to open under a different key", () => {
    const sealed = sealSecret("ABCDEFGH");
    vi.stubEnv("MFA_ENC_KEY", "a-completely-different-key-value-here");
    expect(() => openSecret(sealed)).toThrow();
  });
});

describe("backup codes", () => {
  it("generates 8 codes and equal-count hashes", () => {
    const { codes, hashes } = generateBackupCodes();
    expect(codes).toHaveLength(8);
    expect(hashes).toHaveLength(8);
    // Raw codes are never equal to their stored hashes.
    for (let i = 0; i < 8; i++) expect(hashes[i]).not.toBe(codes[i]);
    expect(new Set(codes).size).toBe(8); // all distinct
  });

  it("consumes a matching code (single-use) and rejects reuse", () => {
    const { codes, hashes } = generateBackupCodes();
    const first = consumeBackupCode(codes[0]!, hashes);
    expect(first).not.toBeNull();
    expect(first!.remaining).toHaveLength(7);
    // The consumed code no longer matches the surviving set.
    expect(consumeBackupCode(codes[0]!, first!.remaining)).toBeNull();
    // A different code still works against the surviving set.
    expect(consumeBackupCode(codes[1]!, first!.remaining)).not.toBeNull();
  });

  it("is dash/space/case tolerant", () => {
    const { codes, hashes } = generateBackupCodes();
    const messy = codes[0]!.toLowerCase().replace("-", " ");
    expect(consumeBackupCode(messy, hashes)).not.toBeNull();
  });

  it("rejects a non-matching code", () => {
    const { hashes } = generateBackupCodes();
    expect(consumeBackupCode("ZZZZZ-ZZZZZ", hashes)).toBeNull();
  });
});

describe("mfa-pending step token", () => {
  it("signs → reads back the adminId", () => {
    const token = createMfaPendingToken("adm_owner");
    expect(readMfaPendingToken(token)?.adminId).toBe("adm_owner");
  });

  it("rejects an expired token", () => {
    const past = new Date("2026-07-05T10:00:00Z");
    const token = createMfaPendingToken("adm_owner", past);
    // 6 minutes later (TTL is 5 min).
    const later = new Date(past.getTime() + 6 * 60 * 1000);
    expect(readMfaPendingToken(token, later)).toBeNull();
  });

  it("rejects a tampered / garbage token", () => {
    expect(readMfaPendingToken(undefined)).toBeNull();
    expect(readMfaPendingToken("")).toBeNull();
    expect(readMfaPendingToken("no-dot")).toBeNull();
    const token = createMfaPendingToken("adm_owner");
    expect(readMfaPendingToken(token.slice(0, -1) + "0")).toBeNull();
  });

  it("is NOT a valid admin session (readAdminSession rejects it)", () => {
    // A pending token must never stand in for a session cookie.
    const token = createMfaPendingToken("adm_owner");
    expect(readAdminSession(token)).toBeNull();
  });
});

describe("verifyAdminSecondFactor + adminHasMfa (DB-backed)", () => {
  function enrol(id: string): { secret: string; codes: string[]; admin: Admin } {
    const secret = generateTotpSecret();
    const { codes, hashes } = generateBackupCodes();
    const admin: Admin = {
      _id: id,
      email: `${id}@a.local`,
      passwordHash: "scrypt:x",
      role: "owner",
      createdAt: new Date(),
      disabledAt: null,
      mfa: {
        enabledAt: new Date(),
        secretEnc: sealSecret(secret),
        backupCodeHashes: hashes,
      },
    };
    adminsStore.set(id, admin);
    return { secret, codes, admin };
  }

  it("adminHasMfa is true for an enrolled account, false for synthetic ids", async () => {
    enrol("adm_owner");
    expect(await adminHasMfa("adm_owner")).toBe(true);
    expect(await adminHasMfa("bootstrap-owner")).toBe(false);
    expect(await adminHasMfa("adm_missing")).toBe(false);
  });

  it("accepts a valid TOTP", async () => {
    const { secret, admin } = enrol("adm_owner");
    const now = new Date("2026-07-05T10:00:00Z");
    expect(await verifyAdminSecondFactor(admin, totpNow(secret, now), now)).toBe(true);
  });

  it("rejects a wrong TOTP", async () => {
    const { admin } = enrol("adm_owner");
    expect(await verifyAdminSecondFactor(admin, "000000")).toBe(false);
  });

  it("accepts a backup code once, then not again (consumed in the DB)", async () => {
    const { codes } = enrol("adm_owner");
    const admin = adminsStore.get("adm_owner")!;
    expect(await verifyAdminSecondFactor(admin, codes[0]!)).toBe(true);
    // Reload the (now-mutated) record — the used hash is gone.
    const reloaded = adminsStore.get("adm_owner")!;
    expect(reloaded.mfa!.backupCodeHashes).toHaveLength(7);
    expect(await verifyAdminSecondFactor(reloaded, codes[0]!)).toBe(false);
  });
});
