/**
 * Regression tests for security audit W-2 — waitlist email-enumeration.
 *
 *  - POST /waitlist is non-revealing: the response is byte-identical (same
 *    shape, same 201, no `alreadyJoined` tell) whether or not the email was
 *    already on the list, so a third party can't probe an address.
 *  - GET /waitlist is member-scoped only: the `?email=` bypass that confirmed
 *    an arbitrary address is gone (401 without a member session).
 *
 * Plus the early-access extensions (motion handoff Task 7):
 *  - name/planInterest pass through onto the stored entry.
 *  - eligible routing keys 409 only while BLOOD_TIERS_ENABLED is on; while
 *    the flag is off they join the list like everyone else.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Doc = { _id: string; [k: string]: unknown };

class FakeCollection {
  docs: Doc[] = [];
  async insertOne(doc: Doc) {
    this.docs.push({ ...doc });
    return { insertedId: doc._id };
  }
  async findOne(filter: Record<string, unknown>) {
    const f = this.docs.find((d) =>
      Object.entries(filter).every(([k, v]) => d[k] === v)
    );
    return f ? { ...f } : null;
  }
  async countDocuments(filter: Record<string, unknown> = {}) {
    return this.docs.filter((d) =>
      Object.entries(filter).every(([k, v]) => d[k] === v)
    ).length;
  }
  async updateOne(
    filter: Record<string, unknown>,
    update: { $set?: Record<string, unknown> }
  ) {
    const doc = this.docs.find((d) =>
      Object.entries(filter).every(([k, v]) => d[k] === v)
    );
    if (doc && update.$set) Object.assign(doc, update.$set);
    return { matchedCount: doc ? 1 : 0, modifiedCount: doc ? 1 : 0 };
  }
}

const store: Record<string, FakeCollection> = {};
function col(name: string): FakeCollection {
  return (store[name] ??= new FakeCollection());
}

const sendEmail = vi.fn();

vi.mock("@/lib/db", () => ({
  PRIMARY_READ: { readPreference: "primary" },
  collections: {
    waitlist: async () => col("waitlist"),
    sessions: async () => col("sessions"),
    users: async () => col("users"),
  },
}));
vi.mock("@/lib/emails", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }));
const eligibility = vi.hoisted(() => ({
  result: { status: "ineligible", routingKey: "T12", county: "Cork" },
}));
vi.mock("@/lib/eligibility", () => ({
  checkEligibility: async () => ({ ...eligibility.result }),
}));

import { GET, POST } from "@/app/api/v1/waitlist/route";

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  sendEmail.mockClear();
  eligibility.result = { status: "ineligible", routingKey: "T12", county: "Cork" };
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function joinReq(email: string, extra: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/v1/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, eircode: "T12AB34", ...extra }),
  });
}

describe("POST /api/v1/waitlist — non-revealing (W-2)", () => {
  it("returns an identical response for a new vs already-listed email", async () => {
    const first = await POST(joinReq("probe@arcaevo.test"));
    const firstBody = await first.json();
    expect(first.status).toBe(201);
    expect(firstBody).toEqual({ ok: true, position: 1, county: "Cork" });
    expect("alreadyJoined" in firstBody).toBe(false);
    expect(sendEmail).toHaveBeenCalledTimes(1); // genuine first join

    // Second join with the SAME email — must look the same to a prober.
    const second = await POST(joinReq("probe@arcaevo.test"));
    const secondBody = await second.json();
    expect(second.status).toBe(first.status);
    expect(secondBody).toEqual(firstBody);
    expect("alreadyJoined" in secondBody).toBe(false);
    // No second confirmation email (no spam) — but that's not response-visible.
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/v1/waitlist — early-access extensions (Task 7)", () => {
  it("persists name + planInterest onto the stored entry (pass-through)", async () => {
    const res = await POST(
      joinReq("Aoife.Byrne@arcaevo.test", {
        name: "Aoife Byrne",
        planInterest: "either",
      })
    );
    expect(res.status).toBe(201);
    const doc = col("waitlist").docs[0];
    expect(doc.email).toBe("aoife.byrne@arcaevo.test"); // still lowercased
    expect(doc.name).toBe("Aoife Byrne");
    expect(doc.planInterest).toBe("either");
  });

  it("re-join with newly provided name/planInterest updates the stored doc (no second E10, same response)", async () => {
    // Plain join first (e.g. the /early-access form: email + eircode only).
    const first = await POST(joinReq("aoife@arcaevo.test"));
    expect(first.status).toBe(201);
    const firstBody = await first.json();
    expect(sendEmail).toHaveBeenCalledTimes(1);

    // Same email via the pricing form, now with the richer fields — "Noted
    // for Essential" must actually be noted, not silently discarded.
    const second = await POST(
      joinReq("aoife@arcaevo.test", {
        name: "Aoife Byrne",
        planInterest: "essential",
      })
    );
    expect(second.status).toBe(201);
    // Response stays byte-identical to the first join (W-2 non-revealing).
    expect(await second.json()).toEqual(firstBody);
    expect(sendEmail).toHaveBeenCalledTimes(1); // no confirmation spam

    const doc = col("waitlist").docs[0];
    expect(doc.name).toBe("Aoife Byrne");
    expect(doc.planInterest).toBe("essential");
    expect(doc.position).toBe(1); // queue place untouched
  });

  it("re-join without the optional fields never unsets previously stored ones", async () => {
    await POST(
      joinReq("aoife@arcaevo.test", { name: "Aoife Byrne", planInterest: "either" })
    );
    await POST(joinReq("aoife@arcaevo.test")); // plain re-join
    const doc = col("waitlist").docs[0];
    expect(doc.name).toBe("Aoife Byrne");
    expect(doc.planInterest).toBe("either");
  });

  it("joins an ELIGIBLE routing key while BLOOD_TIERS_ENABLED is off (no dead-end 409)", async () => {
    // vitest does not set BLOOD_TIERS_ENABLED, so the flag is off here.
    eligibility.result = { status: "eligible", routingKey: "D08", county: "Dublin" };
    const res = await POST(joinReq("dub@arcaevo.test"));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, position: 1, county: "Dublin" });
    expect(sendEmail).toHaveBeenCalledTimes(1); // E10 still sent on first join
  });

  it("marks a launch-gate join from an ELIGIBLE area with eligibleAtJoin (admin data honesty)", async () => {
    eligibility.result = { status: "eligible", routingKey: "D08", county: "Dublin" };
    await POST(joinReq("dub@arcaevo.test"));
    expect(col("waitlist").docs[0].eligibleAtJoin).toBe(true);
  });

  it("does NOT set eligibleAtJoin on a genuine expansion-demand join", async () => {
    await POST(joinReq("cork@arcaevo.test"));
    expect("eligibleAtJoin" in col("waitlist").docs[0]).toBe(false);
  });

  it("keeps the 409 already_eligible redirect while BLOOD_TIERS_ENABLED is on", async () => {
    vi.stubEnv("BLOOD_TIERS_ENABLED", "true");
    eligibility.result = { status: "eligible", routingKey: "D08", county: "Dublin" };
    const res = await POST(joinReq("dub@arcaevo.test"));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("already_eligible");
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/waitlist — member-scoped only (W-2)", () => {
  it("rejects an unauthenticated lookup (no ?email= enumeration bypass)", async () => {
    const res = await GET(
      new Request("http://localhost/api/v1/waitlist?email=victim@arcaevo.test", {
        headers: { authorization: "Bearer not-a-session" },
      })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.onWaitlist).toBeUndefined(); // nothing disclosed
  });
});
