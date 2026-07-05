/**
 * Regression tests for security audit W-2 — waitlist email-enumeration.
 *
 *  - POST /waitlist is non-revealing: the response is byte-identical (same
 *    shape, same 201, no `alreadyJoined` tell) whether or not the email was
 *    already on the list, so a third party can't probe an address.
 *  - GET /waitlist is member-scoped only: the `?email=` bypass that confirmed
 *    an arbitrary address is gone (401 without a member session).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("@/lib/eligibility", () => ({
  checkEligibility: async () => ({
    status: "ineligible",
    routingKey: "T12",
    county: "Cork",
  }),
}));

import { GET, POST } from "@/app/api/v1/waitlist/route";

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  sendEmail.mockClear();
});

function joinReq(email: string) {
  return new Request("http://localhost/api/v1/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, eircode: "T12AB34" }),
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
