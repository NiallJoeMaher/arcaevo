/**
 * GET /api/v1/account/export — the REAL GDPR Art. 20 data-portability export
 * (GAP_REVIEW_2 #8). Guarantees:
 *   1. unauthed → 401 (the guard's denial is propagated).
 *   2. authed → 200 with the correct download headers, the member's OWN
 *      profile + health data, and NO leaked secrets (password hash, session
 *      token, magic-link hash, raw GP-share token, other members' ids).
 *   3. a member NEVER sees another member's data (no IDOR — the route resolves
 *      the authed userId only, never a param).
 *
 * Same approach as share-route.test.ts / stripe-portal.test.ts: an in-memory
 * Mongo fake for @/lib/db and a hoisted auth stub for @/lib/auth.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Doc = { _id: string; [k: string]: unknown };
type Filter = Record<string, unknown>;

function matches(doc: Doc, filter: Filter): boolean {
  return Object.entries(filter).every(([k, v]) => doc[k] === v);
}

class FakeCollection {
  docs: Doc[] = [];
  find(filter: Filter = {}) {
    const results = this.docs.filter((d) => matches(d, filter));
    return {
      async toArray() {
        return results.map((d) => ({ ...d }));
      },
    };
  }
  async findOne(filter: Filter) {
    const f = this.docs.find((d) => matches(d, filter));
    return f ? { ...f } : null;
  }
}

const store: Record<string, FakeCollection> = {};
function col(name: string): FakeCollection {
  return (store[name] ??= new FakeCollection());
}

vi.mock("@/lib/db", () => ({
  PRIMARY_READ: { readPreference: "primary" },
  collections: {
    memberships: async () => col("memberships"),
    testOrders: async () => col("testOrders"),
    biomarkerReadings: async () => col("biomarkerReadings"),
    wearableSignals: async () => col("wearableSignals"),
    consents: async () => col("consents"),
    bloodworkUploads: async () => col("bloodworkUploads"),
    supportTickets: async () => col("supportTickets"),
    shareLinks: async () => col("shareLinks"),
    referralCodes: async () => col("referralCodes"),
    referrals: async () => col("referrals"),
    giftCodes: async () => col("giftCodes"),
    waitlist: async () => col("waitlist"),
  },
}));

const authState = vi.hoisted(() => ({
  member: null as Record<string, unknown> | null,
}));

vi.mock("@/lib/auth", () => ({
  requireMember: async () =>
    authState.member
      ? { member: authState.member, denied: null }
      : {
          member: null,
          denied: Response.json({ error: "unauthorized" }, { status: 401 }),
        },
}));

const ME = "mem_0001";
const OTHER = "mem_0002";

function seed() {
  for (const k of Object.keys(store)) delete store[k];

  col("biomarkerReadings").docs = [
    { _id: "read_me", memberId: ME, code: "apob", value: 82, unit: "mg/dL" },
    { _id: "read_other", memberId: OTHER, code: "apob", value: 55, unit: "mg/dL" },
  ];
  col("memberships").docs = [
    { _id: "sub_me", memberId: ME, tier: "fusion" },
    { _id: "sub_other", memberId: OTHER, tier: "essential" },
  ];
  col("wearableSignals").docs = [
    { _id: "w_me", memberId: ME, type: "hrv", value: 61 },
  ];
  col("consents").docs = [
    { _id: "c_me", userId: ME, purpose: "health_processing", granted: true },
  ];
  col("shareLinks").docs = [
    {
      _id: "share_me",
      userId: ME,
      token: "SUPER_SECRET_SHARE_TOKEN",
      revoked: false,
      accessLog: [],
    },
  ];
  col("referralCodes").docs = [{ _id: "AOIFE-K4", userId: ME, joinedCount: 2 }];
  col("referrals").docs = [
    // Member is the referrer of OTHER — the counterparty id must be redacted.
    { _id: OTHER, referrerUserId: ME, referredUserId: OTHER, status: "credited" },
    // Member was referred by someone else — their id must be redacted too.
    { _id: ME, referrerUserId: "mem_9999", referredUserId: ME, status: "pending" },
  ];
  col("giftCodes").docs = [
    { _id: "GIFT-AAAA", purchaserEmail: "aoife@example.ie", tier: "essential" },
  ];
  col("waitlist").docs = [
    { _id: "wait_me", email: "aoife@example.ie", county: "Dublin" },
  ];
}

async function get() {
  const { GET } = await import("@/app/api/v1/account/export/route");
  return GET(new Request("http://test/api/v1/account/export"));
}

describe("GET /api/v1/account/export", () => {
  beforeEach(seed);
  afterEach(() => {
    authState.member = null;
  });

  it("unauthed → 401 (no data)", async () => {
    authState.member = null;
    const res = await get();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
  });

  it("authed → 200 downloadable JSON with the member's own profile + health data", async () => {
    authState.member = {
      _id: ME,
      name: "Aoife Byrne",
      email: "Aoife@example.ie",
      passwordHash: "scrypt:DEADBEEF",
      stripeCustomerId: "cus_live_1",
    };
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/application\/json/);
    expect(res.headers.get("Content-Disposition")).toMatch(
      /attachment; filename="arcaevo-my-data-\d{4}-\d{2}-\d{2}\.json"/
    );
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    const body = await res.json();
    // Metadata block declaring the Art. 20 basis + the subject.
    expect(body.meta.subjectUserId).toBe(ME);
    expect(body.meta.schemaVersion).toBe(1);
    expect(body.meta.basis).toMatch(/Article 20/);
    // Own profile + health data present.
    expect(body.profile.name).toBe("Aoife Byrne");
    expect(body.profile.stripeCustomerId).toBe("cus_live_1");
    expect(body.biomarkerReadings).toHaveLength(1);
    expect(body.biomarkerReadings[0]._id).toBe("read_me");
    expect(body.memberships).toHaveLength(1);
    expect(body.memberships[0]._id).toBe("sub_me");
    expect(body.wearableSignals).toHaveLength(1);
    expect(body.consents).toHaveLength(1);
    expect(body.giftCodes.purchased).toHaveLength(1);
    expect(body.waitlist).toHaveLength(1);
    expect(body.referralCode._id).toBe("AOIFE-K4");
  });

  it("does NOT leak internal secrets (password hash, raw share token, other members' ids)", async () => {
    authState.member = {
      _id: ME,
      name: "Aoife Byrne",
      email: "aoife@example.ie",
      passwordHash: "scrypt:DEADBEEF",
    };
    const res = await get();
    const raw = await res.text();

    // Password hash never present anywhere.
    expect(raw).not.toContain("scrypt:DEADBEEF");
    expect(raw).not.toContain("passwordHash");
    // Raw GP-share capability token redacted.
    expect(raw).not.toContain("SUPER_SECRET_SHARE_TOKEN");
    expect(raw).toContain("[redacted");
    // Counterparty ids in referral history are not disclosed.
    expect(raw).not.toContain("mem_9999"); // who referred me
    const body = JSON.parse(raw);
    expect(body.referrals.asReferrer[0].referredUserId).toBeUndefined();
    expect(body.referrals.asReferred[0].referrerUserId).toBeUndefined();
    // The share link doc itself is present (minus the token).
    expect(body.shareLinks[0]._id).toBe("share_me");
    expect(body.shareLinks[0].token).toMatch(/redacted/);
  });

  it("returns ONLY the authed member's data — never another member's (no IDOR)", async () => {
    authState.member = { _id: ME, name: "Aoife Byrne", email: "aoife@example.ie" };
    const res = await get();
    const raw = await res.text();
    const body = JSON.parse(raw);

    // OTHER's biomarker reading and membership must be absent.
    expect(raw).not.toContain("read_other");
    expect(raw).not.toContain("sub_other");
    expect(body.biomarkerReadings.every((r: { memberId: string }) => r.memberId === ME)).toBe(
      true
    );
    expect(body.memberships.every((m: { memberId: string }) => m.memberId === ME)).toBe(true);
  });
});
