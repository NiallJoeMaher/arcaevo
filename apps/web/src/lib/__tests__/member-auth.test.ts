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
  collections: {
    magicLinkTokens: async () => fake.magicLinkTokens,
    sessions: async () => fake.sessions,
    users: async () => fake.users,
  },
}));

// Import AFTER the mocks are registered.
import {
  COOLOFF_MS,
  MAGIC_LINK_TTL_MS,
  MAX_FAILED_ATTEMPTS,
  RESEND_THROTTLE_MS,
  applyFailedAttempt,
  canResend,
  clearFailedAttempts,
  consumeMagicLink,
  createSession,
  evaluateMagicLink,
  hashPassword,
  isInCooloff,
  issueMagicLink,
  memberFromSessionToken,
  revokeSessions,
  verifyPassword,
} from "@/lib/member-auth";

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
});
