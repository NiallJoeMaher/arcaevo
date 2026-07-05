/**
 * Unit tests for src/lib/member-auth.ts — scrypt password hashing, the
 * 5-fail/15-minute cool-off, magic-link expiry/single-use/throttle, and
 * session issue → resolve → revoke.
 *
 * member-auth persists tokens/sessions in Mongo, so `@/lib/db` is replaced
 * with a minimal in-memory fake (same pattern as letsgetchecked.mock.test.ts).
 * The fake supports exactly the operators the lib uses: equality filters,
 * `$ne`, `$set` updates, sort/limit on find. next/headers is stubbed — cookie
 * plumbing is e2e territory.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => {
    throw new Error("cookie store must not be touched in unit tests");
  },
}));

// --- minimal in-memory Mongo fake ---------------------------------------------

type Doc = { _id: string; [key: string]: unknown };
type Filter = Record<string, unknown>;

function matches(doc: Doc, filter: Filter): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = doc[key];
    if (expected !== null && typeof expected === "object" && "$ne" in (expected as object)) {
      return actual !== (expected as { $ne: unknown }).$ne;
    }
    return actual === expected;
  });
}

class FakeCollection {
  docs: Doc[] = [];

  async insertOne(doc: Doc) {
    this.docs.push({ ...doc });
    return { insertedId: doc._id };
  }
  async findOne(filter: Filter) {
    const found = this.docs.find((d) => matches(d, filter));
    return found ? { ...found } : null;
  }
  find(filter: Filter) {
    let results = this.docs.filter((d) => matches(d, filter));
    const cursor = {
      sort: (spec: Record<string, 1 | -1>) => {
        const [[field, dir]] = Object.entries(spec);
        results = [...results].sort(
          (a, b) =>
            ((a[field] as Date).getTime() - (b[field] as Date).getTime()) * dir
        );
        return cursor;
      },
      limit: (n: number) => {
        results = results.slice(0, n);
        return cursor;
      },
      toArray: async () => results.map((d) => ({ ...d })),
    };
    return cursor;
  }
  async updateOne(filter: Filter, update: { $set: Record<string, unknown> }) {
    const doc = this.docs.find((d) => matches(d, filter));
    if (doc) Object.assign(doc, update.$set);
    return { matchedCount: doc ? 1 : 0 };
  }
  async findOneAndUpdate(filter: Filter, update: { $set: Record<string, unknown> }) {
    const doc = this.docs.find((d) => matches(d, filter));
    if (!doc) return null;
    Object.assign(doc, update.$set);
    return { ...doc };
  }
  async deleteMany(filter: Filter) {
    const before = this.docs.length;
    this.docs = this.docs.filter((d) => !matches(d, filter));
    return { deletedCount: before - this.docs.length };
  }
  async deleteOne(filter: Filter) {
    const i = this.docs.findIndex((d) => matches(d, filter));
    if (i >= 0) this.docs.splice(i, 1);
    return { deletedCount: i >= 0 ? 1 : 0 };
  }
  async countDocuments() {
    return this.docs.length;
  }
}

const fake = vi.hoisted(() => ({
  magicLinkTokens: undefined as unknown,
  sessions: undefined as unknown,
  users: undefined as unknown,
}));

vi.mock("@/lib/db", () => ({
  PRIMARY_READ: { readPreference: "primary" },
  collections: {
    magicLinkTokens: async () => fake.magicLinkTokens,
    sessions: async () => fake.sessions,
    users: async () => fake.users,
  },
}));

// Import AFTER the mocks are registered.
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  COOLOFF_MS,
  MAGIC_LINK_TTL_MS,
  MAX_CODE_ATTEMPTS,
  MAX_FAILED_ATTEMPTS,
  RESEND_THROTTLE_MS,
  applyFailedAttempt,
  canResend,
  clearFailedAttempts,
  consumeMagicLink,
  consumeMagicLinkByCode,
  createSession,
  createWatchSession,
  evaluateMagicLink,
  formatCode,
  hashPassword,
  isInCooloff,
  isSessionExpired,
  issueMagicLink,
  memberFromSessionToken,
  normalizeCode,
  refreshSession,
  revokeSessions,
  revokeWatchSessions,
  verifyPassword,
} from "@/lib/member-auth";
import { SESSION_TTL_DAYS } from "@/lib/models";

const NOW = new Date("2026-07-02T09:00:00.000Z");

beforeEach(() => {
  fake.magicLinkTokens = new FakeCollection();
  fake.sessions = new FakeCollection();
  fake.users = new FakeCollection();
});

// --- passwords -------------------------------------------------------------------

describe("scrypt password hashing", () => {
  it("hash → verify roundtrip; wrong password fails", async () => {
    const hash = await hashPassword("demo-password-123");
    expect(hash).toMatch(/^scrypt:16384:8:1:/);
    expect(await verifyPassword("demo-password-123", hash)).toBe(true);
    expect(await verifyPassword("demo-password-124", hash)).toBe(false);
  });

  it("salts are random: same password → different hashes, both verify", async () => {
    const a = await hashPassword("hunter2hunter2");
    const b = await hashPassword("hunter2hunter2");
    expect(a).not.toBe(b);
    expect(await verifyPassword("hunter2hunter2", a)).toBe(true);
    expect(await verifyPassword("hunter2hunter2", b)).toBe(true);
  });

  it("rejects malformed stored hashes instead of throwing", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
    expect(await verifyPassword("x", "bcrypt:whatever")).toBe(false);
  });
});

// --- cool-off ---------------------------------------------------------------------

describe("failed-attempt cool-off (5 fails → 15 minutes)", () => {
  it("increments through the first four failures without locking", () => {
    let state = { failedAttempts: 0, cooloffUntil: null as Date | null };
    for (let i = 1; i < MAX_FAILED_ATTEMPTS; i++) {
      state = applyFailedAttempt(state, NOW);
      expect(state.failedAttempts).toBe(i);
      expect(isInCooloff(state.cooloffUntil, NOW)).toBe(false);
    }
  });

  it("the 5th failure starts a 15-minute cool-off and resets the counter", () => {
    const state = applyFailedAttempt({ failedAttempts: 4, cooloffUntil: null }, NOW);
    expect(state.failedAttempts).toBe(0);
    expect(state.cooloffUntil?.getTime()).toBe(NOW.getTime() + COOLOFF_MS);
    expect(COOLOFF_MS).toBe(15 * 60 * 1000);
  });

  it("cool-off expires exactly after 15 minutes", () => {
    const { cooloffUntil } = applyFailedAttempt(
      { failedAttempts: 4, cooloffUntil: null },
      NOW
    );
    expect(isInCooloff(cooloffUntil, new Date(NOW.getTime() + COOLOFF_MS - 1))).toBe(true);
    expect(isInCooloff(cooloffUntil, new Date(NOW.getTime() + COOLOFF_MS))).toBe(false);
  });

  it("successful sign-in clears everything", () => {
    expect(clearFailedAttempts()).toEqual({ failedAttempts: 0, cooloffUntil: null });
  });
});

// --- magic links ---------------------------------------------------------------------

describe("magic links — 30-min expiry, single-use, 60s resend throttle", () => {
  it("issues a token that verifies once and only once", async () => {
    const issued = await issueMagicLink("aoife@example.ie", "signin", NOW);
    expect(issued.throttled).toBe(false);
    if (issued.throttled) return;
    expect(issued.expiresAt.getTime()).toBe(NOW.getTime() + MAGIC_LINK_TTL_MS);
    expect(MAGIC_LINK_TTL_MS).toBe(30 * 60 * 1000);

    const first = await consumeMagicLink(issued.token, new Date(NOW.getTime() + 1000));
    expect(first).toEqual({ state: "valid", email: "aoife@example.ie", purpose: "signin" });

    // Single-use: the same link a second time is dead.
    const second = await consumeMagicLink(issued.token, new Date(NOW.getTime() + 2000));
    expect(second.state).toBe("used");
  });

  it("expires after exactly 30 minutes", async () => {
    const issued = await issueMagicLink("aoife@example.ie", "signin", NOW);
    if (issued.throttled) throw new Error("unexpected throttle");
    const atExpiry = new Date(NOW.getTime() + MAGIC_LINK_TTL_MS);
    expect((await consumeMagicLink(issued.token, atExpiry)).state).toBe("expired");
  });

  it("an unknown token is invalid, not expired", async () => {
    expect((await consumeMagicLink("no-such-token", NOW)).state).toBe("invalid");
  });

  it("throttles a resend within 60s (per email+purpose), then allows it", async () => {
    await issueMagicLink("aoife@example.ie", "signin", NOW);

    const tooSoon = await issueMagicLink(
      "aoife@example.ie",
      "signin",
      new Date(NOW.getTime() + 30_000)
    );
    expect(tooSoon).toEqual({ throttled: true, retryInSeconds: 30 });

    // A different purpose or a different email is NOT throttled.
    const otherPurpose = await issueMagicLink(
      "aoife@example.ie",
      "reset",
      new Date(NOW.getTime() + 30_000)
    );
    expect(otherPurpose.throttled).toBe(false);
    const otherEmail = await issueMagicLink(
      "cian@example.ie",
      "signin",
      new Date(NOW.getTime() + 30_000)
    );
    expect(otherEmail.throttled).toBe(false);

    // After the 60s window the same email+purpose can resend.
    const afterWindow = await issueMagicLink(
      "aoife@example.ie",
      "signin",
      new Date(NOW.getTime() + RESEND_THROTTLE_MS)
    );
    expect(afterWindow.throttled).toBe(false);
  });

  it("emails are normalised to lowercase", async () => {
    const issued = await issueMagicLink("Aoife@Example.IE", "signin", NOW);
    if (issued.throttled) throw new Error("unexpected throttle");
    const result = await consumeMagicLink(issued.token, new Date(NOW.getTime() + 1));
    expect(result).toEqual({ state: "valid", email: "aoife@example.ie", purpose: "signin" });
  });

  it("evaluateMagicLink (pure) covers all states", () => {
    const base = { expiresAt: new Date(NOW.getTime() + 1000), usedAt: null };
    expect(evaluateMagicLink(null, NOW)).toBe("invalid");
    expect(evaluateMagicLink(base, NOW)).toBe("valid");
    expect(evaluateMagicLink({ ...base, usedAt: NOW }, NOW)).toBe("used");
    expect(evaluateMagicLink({ ...base, expiresAt: NOW }, NOW)).toBe("expired");
  });

  it("canResend (pure) implements the 60s window", () => {
    expect(canResend(null, NOW)).toBe(true);
    expect(canResend(new Date(NOW.getTime() - 59_999), NOW)).toBe(false);
    expect(canResend(new Date(NOW.getTime() - RESEND_THROTTLE_MS), NOW)).toBe(true);
  });
});

// --- prefetch-safe sign-in codes -------------------------------------------------------

describe("human sign-in codes — format, alphabet, normalisation (pure)", () => {
  const ALPHABET_RE = new RegExp(`^[${CODE_ALPHABET}]{3}-[${CODE_ALPHABET}]{3}$`);

  it("issueMagicLink returns a XXX-XXX code from the unambiguous alphabet", async () => {
    const issued = await issueMagicLink("aoife@example.ie", "signin", NOW);
    if (issued.throttled) throw new Error("unexpected throttle");
    expect(CODE_LENGTH).toBe(6);
    expect(issued.code).toMatch(ALPHABET_RE);
    // The ambiguous glyphs 0/O/1/I are never in the 32-char alphabet.
    expect(issued.code).not.toMatch(/[01OI]/);
    expect(CODE_ALPHABET).toBe("ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
    expect(CODE_ALPHABET).toHaveLength(32); // 256 % 32 === 0 → unbiased
  });

  it("normalizeCode strips case, dashes and spaces to the alphabet only", () => {
    expect(normalizeCode("kx4-9wp")).toBe("KX49WP");
    expect(normalizeCode("  Kx4 9wP ")).toBe("KX49WP");
    expect(normalizeCode("kx4-9wp!")).toBe("KX49WP");
  });

  it("formatCode groups a normalised code as XXX-XXX", () => {
    expect(formatCode("KX49WP")).toBe("KX4-9WP");
  });
});

describe("consumeMagicLinkByCode — single-use, scoped, brute-force capped", () => {
  const EMAIL = "aoife@example.ie";
  async function issue() {
    const issued = await issueMagicLink(EMAIL, "signin", NOW);
    if (issued.throttled) throw new Error("unexpected throttle");
    return issued;
  }

  it("accepts the right code once (case/dash-insensitive), then it's used", async () => {
    const { code } = await issue();
    const lower = code.toLowerCase().replace("-", "");
    const first = await consumeMagicLinkByCode(EMAIL, lower, new Date(NOW.getTime() + 1000));
    expect(first).toEqual({ state: "valid", email: EMAIL, purpose: "signin" });
    // Single-use: the same code again is dead.
    const second = await consumeMagicLinkByCode(EMAIL, code, new Date(NOW.getTime() + 2000));
    expect(second.state).toBe("used");
  });

  it("a wrong code increments attempts but does not burn until the 5th", async () => {
    await issue();
    const tokens = fake.magicLinkTokens as FakeCollection;
    for (let i = 1; i < MAX_CODE_ATTEMPTS; i++) {
      const res = await consumeMagicLinkByCode(EMAIL, "ZZZ-ZZZ", NOW);
      expect(res.state).toBe("invalid");
      expect(tokens.docs[0].codeAttempts).toBe(i);
      expect(tokens.docs[0].usedAt).toBeNull(); // still redeemable
    }
  });

  it("the 5th wrong code burns the token (link included) → too_many", async () => {
    const { code } = await issue();
    for (let i = 1; i < MAX_CODE_ATTEMPTS; i++) {
      await consumeMagicLinkByCode(EMAIL, "ZZZ-ZZZ", NOW);
    }
    const fifth = await consumeMagicLinkByCode(EMAIL, "ZZZ-ZZZ", NOW);
    expect(fifth.state).toBe("too_many");
    // The correct code no longer works — the token is invalidated.
    const after = await consumeMagicLinkByCode(EMAIL, code, NOW);
    expect(after.state).toBe("used");
  });

  it("an expired token is 'expired', a malformed code is 'invalid'", async () => {
    await issue();
    expect(
      (await consumeMagicLinkByCode(EMAIL, "KX4-9WP", new Date(NOW.getTime() + MAGIC_LINK_TTL_MS))).state
    ).toBe("expired");
    expect((await consumeMagicLinkByCode(EMAIL, "short", NOW)).state).toBe("invalid");
    // No token for a different email.
    expect((await consumeMagicLinkByCode("nobody@example.ie", "KX4-9WP", NOW)).state).toBe(
      "invalid"
    );
  });

  it("using the CODE burns the same single token as the LINK (and vice-versa)", async () => {
    // Code first → the link is then dead.
    const a = await issue();
    expect((await consumeMagicLinkByCode(EMAIL, a.code, new Date(NOW.getTime() + 1))).state).toBe(
      "valid"
    );
    expect((await consumeMagicLink(a.token, new Date(NOW.getTime() + 2))).state).toBe("used");

    // Link first → the code is then dead.
    const b = await issueMagicLink(EMAIL, "signin", new Date(NOW.getTime() + RESEND_THROTTLE_MS));
    if (b.throttled) throw new Error("unexpected throttle");
    expect((await consumeMagicLink(b.token, new Date(NOW.getTime() + RESEND_THROTTLE_MS + 1))).state).toBe(
      "valid"
    );
    expect(
      (await consumeMagicLinkByCode(EMAIL, b.code, new Date(NOW.getTime() + RESEND_THROTTLE_MS + 2))).state
    ).toBe("used");
  });

  it("scopes to the latest token and never redeems a reset (password) token", async () => {
    // A reset token exists but the code path must ignore it.
    await issueMagicLink(EMAIL, "reset", NOW);
    const signin = await issueMagicLink(EMAIL, "signin", new Date(NOW.getTime() + 1));
    if (signin.throttled) throw new Error("unexpected throttle");
    const res = await consumeMagicLinkByCode(EMAIL, signin.code, new Date(NOW.getTime() + 2));
    expect(res).toEqual({ state: "valid", email: EMAIL, purpose: "signin" });
  });
});

// --- sessions --------------------------------------------------------------------------

describe("sessions — opaque tokens stored hashed, individually revocable", () => {
  it("createSession → memberFromSessionToken resolves the user", async () => {
    await (fake.users as FakeCollection).insertOne({ _id: "mem_0001", email: "aoife@example.ie" });
    const { token, session } = await createSession("mem_0001", "vitest", NOW);
    // Only the hash is stored — the raw token never appears in the DB.
    expect(session.tokenHash).not.toBe(token);
    expect(JSON.stringify((fake.sessions as FakeCollection).docs)).not.toContain(token);

    const member = await memberFromSessionToken(token);
    expect(member?._id).toBe("mem_0001");
    expect(await memberFromSessionToken("wrong-token")).toBeNull();
  });

  it("revokeSessions signs out everywhere except the kept session", async () => {
    const a = await createSession("mem_0001", "phone", NOW);
    const b = await createSession("mem_0001", "laptop", NOW);
    await createSession("mem_0002", "someone-else", NOW);

    const revoked = await revokeSessions("mem_0001", b.session.tokenHash);
    expect(revoked).toBe(1); // only session A

    expect(await memberFromSessionToken(a.token)).toBeNull();
    // b survives; mem_0002 untouched.
    expect((fake.sessions as FakeCollection).docs).toHaveLength(2);
  });

  it("createSession stamps device, label and a sliding expiresAt", async () => {
    const { session } = await createSession("mem_0001", "vitest", NOW);
    expect(session.device).toBe("web"); // default surface
    expect(session.label).toBe("Web");
    expect(session.expiresAt?.getTime()).toBe(
      NOW.getTime() + SESSION_TTL_DAYS * 86_400_000
    );
  });
});

// --- device-scoped watch sessions + silent refresh -------------------------------

describe("golden watch login — device-scoped sessions", () => {
  beforeEach(async () => {
    await (fake.users as FakeCollection).insertOne({
      _id: "mem_0001",
      name: "Aoife Byrne",
      email: "aoife@example.ie",
    });
  });

  it("createWatchSession mints a DISTINCT token, device:'watch', expiresAt set", async () => {
    const phone = await createSession("mem_0001", "iPhone", NOW, { device: "ios" });
    const watch = await createWatchSession("mem_0001", NOW);

    // A freshly generated token — NOT a copy of the phone token.
    expect(watch.token).not.toBe(phone.token);
    expect(watch.session.device).toBe("watch");
    expect(watch.session.label).toBe("Apple Watch");
    expect(watch.expiresAt.getTime()).toBe(NOW.getTime() + SESSION_TTL_DAYS * 86_400_000);
    // Its own row, independently resolvable.
    expect((await memberFromSessionToken(watch.token))?._id).toBe("mem_0001");
  });

  it("one active watch session per user — a new one revokes the prior watch", async () => {
    const first = await createWatchSession("mem_0001", NOW);
    const second = await createWatchSession("mem_0001", NOW);
    expect(second.token).not.toBe(first.token);
    // The replaced watch token no longer resolves; the new one does.
    expect(await memberFromSessionToken(first.token)).toBeNull();
    expect((await memberFromSessionToken(second.token))?._id).toBe("mem_0001");
    // Exactly one watch row remains.
    const watchRows = (fake.sessions as FakeCollection).docs.filter(
      (d) => d.device === "watch"
    );
    expect(watchRows).toHaveLength(1);
  });

  it("revokeWatchSessions deletes only the watch device rows", async () => {
    await createSession("mem_0001", "iPhone", NOW, { device: "ios" });
    await createWatchSession("mem_0001", NOW);
    const revoked = await revokeWatchSessions("mem_0001");
    expect(revoked).toBe(1);
    expect(
      (fake.sessions as FakeCollection).docs.filter((d) => d.device === "watch")
    ).toHaveLength(0);
    // The iOS session survives.
    expect(
      (fake.sessions as FakeCollection).docs.filter((d) => d.device === "ios")
    ).toHaveLength(1);
  });

  it("refreshSession slides expiry + lastSeen and returns the member", async () => {
    const { token } = await createWatchSession("mem_0001", NOW);
    const later = new Date(NOW.getTime() + 5 * 86_400_000);
    const refreshed = await refreshSession(token, later);
    expect(refreshed?.user._id).toBe("mem_0001");
    expect(refreshed?.session.device).toBe("watch");
    expect(refreshed?.expiresAt.getTime()).toBe(
      later.getTime() + SESSION_TTL_DAYS * 86_400_000
    );
    // The slide is persisted.
    const stored = (fake.sessions as FakeCollection).docs.find(
      (d) => d.device === "watch"
    );
    expect((stored?.expiresAt as Date).getTime()).toBe(
      later.getTime() + SESSION_TTL_DAYS * 86_400_000
    );
    expect((stored?.lastSeen as Date).getTime()).toBe(later.getTime());
  });

  it("refreshSession rejects a revoked (missing) token", async () => {
    const { token } = await createWatchSession("mem_0001", NOW);
    await revokeWatchSessions("mem_0001");
    expect(await refreshSession(token, NOW)).toBeNull();
  });

  it("refreshSession rejects an expired session", async () => {
    // A watch session created far in the past is already expired.
    const past = new Date("2020-01-01T00:00:00.000Z");
    const { token } = await createWatchSession("mem_0001", past);
    expect(await refreshSession(token, NOW)).toBeNull();
  });

  it("memberFromSessionToken treats an expired session as invalid", async () => {
    const past = new Date("2020-01-01T00:00:00.000Z");
    const { token } = await createSession("mem_0001", "old", past, { device: "web" });
    expect(isSessionExpired({ expiresAt: new Date(past.getTime() + 86_400_000) })).toBe(true);
    expect(await memberFromSessionToken(token)).toBeNull();
  });

  it("a legacy session with NO expiresAt stays valid (backward compat)", async () => {
    // Simulate a pre-device-scoping row: no device, no expiresAt.
    const rawToken = "legacy-web-token";
    const tokenHash = (await import("node:crypto"))
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    await (fake.sessions as FakeCollection).insertOne({
      _id: `sess_${tokenHash.slice(0, 16)}`,
      tokenHash,
      userId: "mem_0001",
      createdAt: NOW,
      lastSeen: NOW,
      userAgent: "legacy",
    });
    expect(isSessionExpired({ expiresAt: undefined })).toBe(false);
    expect((await memberFromSessionToken(rawToken))?._id).toBe("mem_0001");
  });
});
