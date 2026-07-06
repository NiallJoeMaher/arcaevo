/**
 * GET /api/v1/insights × AI narration — the route-level fail-safe contract
 * (mocked db + consent guard + Bedrock vendor, waitlist-route.test.ts style):
 *
 *  - flag OFF (default env): payload byte-identical to the template-only
 *    shape — no `narration` key, no narrations-collection access, no vendor
 *    call;
 *  - flag ON, cache MISS: the GET returns BEFORE the vendor resolves (never
 *    blocking), templates untouched, and the generation lands in the cache so
 *    the SECOND request carries `narration`;
 *  - flag ON, vendor error: no crash, identical payload, one logError line;
 *  - flagged (worsened) insights are NEVER passed to the vendor and never
 *    gain a narration.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Doc = { _id: string; [k: string]: unknown };

class FakeCollection {
  docs: Doc[] = [];
  find(filter: Record<string, unknown> = {}) {
    const matches = this.docs.filter((d) =>
      Object.entries(filter).every(([k, v]) => {
        if (v !== null && typeof v === "object" && "$in" in (v as object)) {
          return ((v as { $in: unknown[] }).$in ?? []).includes(d[k]);
        }
        return d[k] === v;
      })
    );
    const cursor = {
      // Docs are seeded in chronological order already.
      sort: () => cursor,
      toArray: async () => matches.map((m) => ({ ...m })),
    };
    return cursor;
  }
  async updateOne(
    filter: Record<string, unknown>,
    update: { $set?: Doc; $setOnInsert?: Doc },
    options?: { upsert?: boolean }
  ) {
    const existing = this.docs.find((d) => d._id === filter._id);
    if (!existing && options?.upsert) {
      this.docs.push({
        _id: String(filter._id),
        ...(update.$setOnInsert ?? {}),
        ...(update.$set ?? {}),
      });
      return { matchedCount: 0, upsertedCount: 1 };
    }
    if (existing && update.$set) Object.assign(existing, update.$set);
    return { matchedCount: existing ? 1 : 0, upsertedCount: 0 };
  }
}

const store: Record<string, FakeCollection> = {};
function col(name: string): FakeCollection {
  return (store[name] ??= new FakeCollection());
}

const narrationsAccess = vi.fn(async () => col("narrations"));

vi.mock("@/lib/db", () => ({
  PRIMARY_READ: { readPreference: "primary" },
  collections: {
    biomarkerReadings: async () => col("biomarker_readings"),
    biomarkerRules: async () => col("biomarker_rules"),
    wearableSignals: async () => col("wearable_signals"),
    narrations: (...a: unknown[]) => narrationsAccess(...(a as [])),
  },
}));

vi.mock("@/lib/consent-guard", () => ({
  requireConsentedMember: async () => ({ member: { _id: "mem_test" } }),
}));

const vendorNarrate = vi.fn();
vi.mock("@/lib/vendors/ai-narration.bedrock", () => ({
  bedrockNarrationVendor: {
    narrate: (...a: unknown[]) => vendorNarrate(...a),
  },
}));

import { GET } from "@/app/api/v1/insights/route";

function seed() {
  col("biomarker_rules").docs = [
    {
      _id: "apob",
      code: "apob",
      name: "ApoB",
      unit: "g/L",
      rcvPercent: 10,
      direction: "lower_is_better",
    },
    {
      _id: "hs_crp",
      code: "hs_crp",
      name: "hs-CRP",
      unit: "mg/L",
      rcvPercent: 46,
      direction: "lower_is_better",
    },
  ];
  col("biomarker_readings").docs = [
    // ApoB improved (eligible for narration).
    {
      _id: "read_1",
      memberId: "mem_test",
      code: "apob",
      value: 1.2,
      unit: "g/L",
      takenAt: new Date("2026-01-01"),
      baselineBand: null,
      rcvVerdict: null,
      clinicianReviewed: true,
      source: "lab",
    },
    {
      _id: "read_2",
      memberId: "mem_test",
      code: "apob",
      value: 1.0,
      unit: "g/L",
      takenAt: new Date("2026-04-01"),
      baselineBand: { low: 0.9, high: 1.3 },
      rcvVerdict: "improved",
      clinicianReviewed: true,
      source: "lab",
    },
    // hs-CRP worsened (FLAGGED — must never reach the vendor).
    {
      _id: "read_3",
      memberId: "mem_test",
      code: "hs_crp",
      value: 1.0,
      unit: "mg/L",
      takenAt: new Date("2026-01-01"),
      baselineBand: null,
      rcvVerdict: null,
      clinicianReviewed: true,
      source: "lab",
    },
    {
      _id: "read_4",
      memberId: "mem_test",
      code: "hs_crp",
      value: 2.0,
      unit: "mg/L",
      takenAt: new Date("2026-04-01"),
      baselineBand: { low: 0.8, high: 1.2 },
      rcvVerdict: "worsened",
      clinicianReviewed: true,
      source: "lab",
    },
  ];
}

function getReq() {
  return new Request("http://localhost/api/v1/insights", {
    headers: { authorization: "Bearer test" },
  });
}

function stubNarrationOn() {
  vi.stubEnv("ARCAEVO_AWS_ACCESS_KEY_ID", "AKIDEXAMPLE");
  vi.stubEnv("ARCAEVO_AWS_SECRET_ACCESS_KEY", "fake-secret");
}

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  vendorNarrate.mockReset();
  narrationsAccess.mockClear();
  seed();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("flag OFF (default) — payload identical, zero narration work", () => {
  it("returns template-only insights with no narration key, no cache read, no vendor call", async () => {
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.insights).toHaveLength(2);
    expect(body.insights[0].code).toBe("apob"); // improved first
    expect(body.insights[1].code).toBe("hs_crp");
    for (const ins of body.insights) {
      expect(Object.keys(ins).sort()).toEqual([
        "code",
        "name",
        "takenAt",
        "text",
        "verdict",
      ]);
    }
    expect(body.disclaimer).toContain("Not a diagnosis");
    expect("fusion" in body).toBe(true);

    expect(narrationsAccess).not.toHaveBeenCalled();
    expect(vendorNarrate).not.toHaveBeenCalled();
  });
});

describe("flag ON — cache-first, fire-and-forget generation", () => {
  it("cache MISS: responds before the vendor resolves, then serves the narration on the SECOND request", async () => {
    stubNarrationOn();

    let resolveVendor!: (v: string) => void;
    vendorNarrate.mockImplementation(
      () => new Promise<string>((r) => (resolveVendor = r))
    );

    // First request: vendor promise is still PENDING when the GET returns —
    // proof the route never awaits generation.
    const first = await (await GET(getReq())).json();
    expect(vendorNarrate).toHaveBeenCalledTimes(1);
    expect(first.insights[0].narration).toBeUndefined();
    expect(first.insights[0].text).toContain("ApoB"); // template untouched
    expect(col("narrations").docs).toHaveLength(0); // nothing written yet

    // Background generation completes → cache is written.
    resolveVendor("Lovely work — your ApoB shift is the real thing.");
    await vi.waitFor(() => expect(col("narrations").docs).toHaveLength(1));
    expect(col("narrations").docs[0].modelId).toBe(
      "eu.anthropic.claude-haiku-4-5-20251001-v1:0"
    );

    // Second request: cache HIT attaches `narration`; template still intact.
    const second = await (await GET(getReq())).json();
    expect(second.insights[0].narration).toBe(
      "Lovely work — your ApoB shift is the real thing."
    );
    expect(second.insights[0].text).toBe(first.insights[0].text);
    expect(vendorNarrate).toHaveBeenCalledTimes(1); // no regeneration on a hit
  });

  it("passes ONLY non-PII facts to the vendor", async () => {
    stubNarrationOn();
    vendorNarrate.mockResolvedValue(null);
    await GET(getReq());
    await vi.waitFor(() => expect(vendorNarrate).toHaveBeenCalledTimes(1));
    const input = vendorNarrate.mock.calls[0][0] as Record<string, unknown>;
    expect(input).toMatchObject({
      code: "apob",
      name: "ApoB",
      unit: "g/L",
      direction: "lower_is_better",
      verdict: "improved",
      priorValue: 1.2,
      currentValue: 1.0,
      deltaPct: 17,
    });
    // No member identifiers anywhere in the vendor input.
    expect(JSON.stringify(input)).not.toContain("mem_test");
  });

  it("FLAGGED (worsened) insights are never sent to the vendor and never narrated", async () => {
    stubNarrationOn();
    vendorNarrate.mockResolvedValue("should never be requested for hs_crp");

    const body = await (await GET(getReq())).json();
    await vi.waitFor(() => expect(vendorNarrate).toHaveBeenCalledTimes(1));
    // Only the eligible ApoB insight ever reaches the model.
    for (const call of vendorNarrate.mock.calls) {
      expect((call[0] as { code: string }).code).toBe("apob");
    }
    const worsened = body.insights.find(
      (i: { code: string }) => i.code === "hs_crp"
    );
    expect(worsened.verdict).toBe("worsened");
    expect(worsened.narration).toBeUndefined();
  });

  it("vendor REJECTION crashes nothing: payload identical, error logged, no cache write", async () => {
    stubNarrationOn();
    vendorNarrate.mockRejectedValue(new Error("bedrock exploded"));

    const res = await GET(getReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.insights[0].narration).toBeUndefined();
    expect(body.insights[0].text).toContain("right direction");

    // The background failure is logged once (ai_narration.generate)…
    await vi.waitFor(() => {
      const lines = (console.error as ReturnType<typeof vi.fn>).mock.calls.map(
        (c) => String(c[0])
      );
      expect(lines.some((l) => l.includes("ai_narration.generate"))).toBe(true);
    });
    // …and nothing was cached, so the template keeps shipping.
    expect(col("narrations").docs).toHaveLength(0);
  });

  it("a failing CACHE READ degrades to templates (no crash, no vendor call)", async () => {
    stubNarrationOn();
    narrationsAccess.mockImplementationOnce(async () => {
      throw new Error("mongo down");
    });
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.insights[0].narration).toBeUndefined();
    expect(vendorNarrate).not.toHaveBeenCalled();
  });
});
