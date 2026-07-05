/**
 * Regression tests for security audit W-1 — consent withdrawal must stop the
 * PUBLIC GP share endpoint from disclosing Art.9 lab values.
 *
 * Two guarantees, tested against an in-memory Mongo fake (same approach as
 * erasure.test.ts):
 *   1. Withdrawal (real suspendProcessingForWithdrawal) revokes the member's
 *      live share links, and the public GET then refuses (410) — the link no
 *      longer serves data.
 *   2. Defence-in-depth: even a still-un-revoked link refuses the moment the
 *      owning member is processingSuspended / closing / closed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Doc = { _id: string; [k: string]: unknown };
type Filter = Record<string, unknown>;

function matchValue(actual: unknown, expected: unknown): boolean {
  if (expected && typeof expected === "object" && "$ne" in (expected as object)) {
    return actual !== (expected as { $ne: unknown }).$ne;
  }
  return actual === expected;
}
function matches(doc: Doc, filter: Filter): boolean {
  return Object.entries(filter).every(([k, v]) => matchValue(doc[k], v));
}

class FakeCollection {
  docs: Doc[] = [];
  async insertOne(doc: Doc) {
    this.docs.push({ ...doc });
    return { insertedId: doc._id };
  }
  async findOne(filter: Filter) {
    const f = this.docs.find((d) => matches(d, filter));
    return f ? { ...f } : null;
  }
  find(filter: Filter = {}) {
    let results = this.docs.filter((d) => matches(d, filter));
    return {
      sort(spec: Record<string, 1 | -1>) {
        const [[k, dir]] = Object.entries(spec);
        results = [...results].sort((a, b) => {
          const av = a[k] as number | Date;
          const bv = b[k] as number | Date;
          return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
        });
        return this;
      },
      async toArray() {
        return results.map((d) => ({ ...d }));
      },
    };
  }
  async countDocuments(filter: Filter = {}) {
    return this.docs.filter((d) => matches(d, filter)).length;
  }
  async deleteMany(filter: Filter) {
    const before = this.docs.length;
    this.docs = this.docs.filter((d) => !matches(d, filter));
    return { deletedCount: before - this.docs.length };
  }
  async updateOne(filter: Filter, update: Record<string, unknown>) {
    const doc = this.docs.find((d) => matches(d, filter));
    if (doc) {
      if (update.$set) Object.assign(doc, update.$set);
      if (update.$push) {
        for (const [k, v] of Object.entries(update.$push as object)) {
          (doc[k] as unknown[]) = [...((doc[k] as unknown[]) ?? []), v];
        }
      }
    }
    return { matchedCount: doc ? 1 : 0 };
  }
  async updateMany(filter: Filter, update: { $set: Record<string, unknown> }) {
    const hit = this.docs.filter((d) => matches(d, filter));
    for (const d of hit) Object.assign(d, update.$set);
    return { modifiedCount: hit.length };
  }
}

const store: Record<string, FakeCollection> = {};
function col(name: string): FakeCollection {
  return (store[name] ??= new FakeCollection());
}

vi.mock("@/lib/db", () => ({
  PRIMARY_READ: { readPreference: "primary" },
  collections: {
    users: async () => col("users"),
    shareLinks: async () => col("shareLinks"),
    biomarkerReadings: async () => col("biomarkerReadings"),
    biomarkerRules: async () => col("biomarkerRules"),
    testOrders: async () => col("testOrders"),
    sessions: async () => col("sessions"),
  },
}));

import { GET } from "@/app/api/v1/share/[token]/route";
import { suspendProcessingForWithdrawal } from "@/lib/consent-guard";

const USER = "mem_0001";
const TOKEN = "tok_live";

function seed() {
  for (const k of Object.keys(store)) delete store[k];
  col("users").docs = [{ _id: USER, name: "Aoife Byrne", email: "a@b.ie" }];
  col("shareLinks").docs = [
    {
      _id: "share_0001",
      token: TOKEN,
      userId: USER,
      createdAt: new Date("2026-06-01"),
      expiresAt: new Date("2026-08-01"), // well in the future
      revoked: false,
      accessLog: [],
    },
  ];
  col("biomarkerReadings").docs = [
    {
      _id: "r1",
      memberId: USER,
      source: "lab",
      code: "hba1c",
      unit: "mmol/mol",
      value: 34,
      takenAt: new Date("2026-02-01"),
      rcvVerdict: "stable",
      clinicianReviewed: true,
    },
  ];
  col("biomarkerRules").docs = [{ _id: "hba1c", code: "hba1c", name: "HbA1c" }];
  col("sessions").docs = [{ _id: "s1", userId: USER }];
}

function callGet(token: string) {
  return GET(new Request(`http://localhost/api/v1/share/${token}`), {
    params: Promise.resolve({ token }),
  });
}

beforeEach(seed);

describe("GET /api/v1/share/[token] — W-1 consent enforcement", () => {
  it("serves lab values for a healthy member with an active link", async () => {
    const res = await callGet(TOKEN);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.member.name).toBe("Aoife Byrne");
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].current.value).toBe(34);
    // HONESTY (GAP_REVIEW_2 #2): no registered clinician onboarded ⇒ no named
    // reviewer/IMC is presented, and the GP-facing disclaimer is always sent.
    expect(body.reviewer).toBeNull();
    expect(body.disclaimer).toContain("not a diagnosis");
    expect(JSON.stringify(body)).not.toContain("412887");
  });

  it("refuses (410) when the owning member is processingSuspended", async () => {
    col("users").docs[0].processingSuspended = true;
    const res = await callGet(TOKEN);
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBe("gone");
    // No lab values leaked.
    expect(body.rows).toBeUndefined();
  });

  it("refuses (410) when the owning member is closing", async () => {
    col("users").docs[0].status = "closing";
    const res = await callGet(TOKEN);
    expect(res.status).toBe(410);
  });

  it("withdrawal revokes the link → the public GET no longer serves data", async () => {
    // The link is live and serving before withdrawal.
    expect((await callGet(TOKEN)).status).toBe(200);

    // Member withdraws consent (real code path).
    const { shareLinksRevoked } = await suspendProcessingForWithdrawal(USER);
    expect(shareLinksRevoked).toBe(1);

    // Same token, same link — now gone.
    const res = await callGet(TOKEN);
    expect(res.status).toBe(410);
    expect((await res.json()).error).toBe("gone");
  });
});
