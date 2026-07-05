/**
 * Unit tests for src/lib/rate-limit.ts — the dependency-free fixed-window IP
 * limiter that backstops the auth endpoints (audit must-fix #3).
 *
 * `@/lib/db` is replaced with an in-memory fake supporting exactly the one
 * operation the limiter uses: an upserting `findOneAndUpdate` with
 * `$inc`/`$setOnInsert` + `returnDocument:"after"` (same fake-Mongo approach as
 * erasure.test.ts / member-auth.test.ts). We assert the counting, the refusal
 * past the limit, the window roll-over, and per-key isolation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clientIp } from "@/lib/rate-limit";

type Doc = { _id: string; [k: string]: unknown };

class FakeCollection {
  docs: Doc[] = [];
  async createIndex() {
    return "idx";
  }
  async findOneAndUpdate(
    filter: { _id: string },
    update: {
      $inc?: Record<string, number>;
      $setOnInsert?: Record<string, unknown>;
    },
    opts: { upsert?: boolean; returnDocument?: "after" | "before" }
  ) {
    let doc = this.docs.find((d) => d._id === filter._id);
    const existed = Boolean(doc);
    if (!doc) {
      if (!opts.upsert) return null;
      doc = { _id: filter._id, ...(update.$setOnInsert ?? {}) };
      this.docs.push(doc);
    }
    if (update.$inc) {
      for (const [k, v] of Object.entries(update.$inc)) {
        doc[k] = ((doc[k] as number) ?? 0) + v;
      }
    }
    if (opts.returnDocument === "before") {
      return existed ? { ...doc } : null;
    }
    return { ...doc };
  }
}

const store: Record<string, FakeCollection> = {};

vi.mock("@/lib/db", () => ({
  PRIMARY_READ: { readPreference: "primary" },
  collections: {
    rateLimits: async () => (store.rate_limits ??= new FakeCollection()),
  },
}));

// Imported after the mock is registered.
const { enforceRateLimit } = await import("@/lib/rate-limit");

const CONFIG = { limit: 3, windowMs: 60_000 };
const T0 = new Date("2026-07-05T00:00:00.000Z");

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
});

describe("enforceRateLimit — fixed window", () => {
  it("allows up to `limit` hits, then refuses", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(await enforceRateLimit("verify", "1.2.3.4", CONFIG, T0));
    }
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0]);
  });

  it("returns a positive Retry-After only once refused", async () => {
    for (let i = 0; i < 3; i++) {
      const ok = await enforceRateLimit("verify", "ip", CONFIG, T0);
      expect(ok.retryAfterSeconds).toBe(0);
    }
    const blocked = await enforceRateLimit("verify", "ip", CONFIG, T0);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("resets in the next window", async () => {
    for (let i = 0; i < 3; i++) await enforceRateLimit("verify", "ip", CONFIG, T0);
    const blocked = await enforceRateLimit("verify", "ip", CONFIG, T0);
    expect(blocked.allowed).toBe(false);

    // Advance past the window boundary → fresh bucket, allowed again.
    const later = new Date(T0.getTime() + CONFIG.windowMs + 1);
    const fresh = await enforceRateLimit("verify", "ip", CONFIG, later);
    expect(fresh.allowed).toBe(true);
    expect(fresh.remaining).toBe(2);
  });

  it("isolates distinct identifiers", async () => {
    for (let i = 0; i < 3; i++) await enforceRateLimit("verify", "ipA", CONFIG, T0);
    const a = await enforceRateLimit("verify", "ipA", CONFIG, T0);
    const b = await enforceRateLimit("verify", "ipB", CONFIG, T0);
    expect(a.allowed).toBe(false);
    expect(b.allowed).toBe(true);
  });

  it("isolates distinct scopes for the same identifier", async () => {
    for (let i = 0; i < 3; i++) await enforceRateLimit("verify", "ip", CONFIG, T0);
    const verify = await enforceRateLimit("verify", "ip", CONFIG, T0);
    const signin = await enforceRateLimit("signin", "ip", CONFIG, T0);
    expect(verify.allowed).toBe(false);
    expect(signin.allowed).toBe(true);
  });
});

describe("clientIp — first proxy hop", () => {
  const withHeaders = (h: Record<string, string>) =>
    new Request("https://x/", { headers: h });

  it("takes the first x-forwarded-for entry", () => {
    expect(
      clientIp(withHeaders({ "x-forwarded-for": "9.9.9.9, 10.0.0.1, 10.0.0.2" }))
    ).toBe("9.9.9.9");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIp(withHeaders({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
  });

  it("buckets unknowns together when no IP header is present", () => {
    expect(clientIp(withHeaders({}))).toBe("unknown");
  });
});
