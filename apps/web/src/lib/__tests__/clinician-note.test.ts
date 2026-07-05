/**
 * Phase 22 — clinician note on every reviewed panel (ALGORITHM.md §5).
 *
 * Covers:
 *  1. composeClinicianNote — the LOCKED field shape (`text, clinicianName,
 *     imcNumber, readAt` — iOS decodes these names). HONESTY (GAP_REVIEW_2 #2):
 *     the DEFAULT is an AUTOMATED wellness summary with NO fabricated name/IMC
 *     (both empty), and only a real registered `clinician` switches it to a
 *     human sign-off. Wellness framing, plus the €69 recheck pointer when
 *     markers are worth watching.
 *  2. GET /api/v1/results — each reviewed panel's readings carry the panel's
 *     `clinicianNote`; unreviewed / order-less readings carry null. Asserted
 *     on the SERIALIZED payload (res.json()) so the wire shape is what iOS
 *     will actually decode.
 *  3. POST /api/v1/admin/results/[id]/review — sign-off writes the note onto
 *     the reading's TestOrder; un-reviewing the last reading removes it.
 *
 * `@/lib/db` is replaced with a minimal in-memory fake (same approach as
 * letsgetchecked.mock.test.ts); auth/consent guards are stubbed to pass —
 * their real behavior has its own suites.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADDON_PRICE_EUR,
  DEMO_CLINICIAN_IMC_NUMBER,
  DEMO_CLINICIAN_NAME,
  ClinicianNoteSchema,
  composeClinicianNote,
  isWatchMarker,
  type BiomarkerReading,
  type BiomarkerRule,
  type TestOrder,
} from "@/lib/models";

// --- minimal in-memory Mongo fake ---------------------------------------------

type Doc = { _id: string; [key: string]: unknown };

function matches(doc: Doc, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, cond]) => {
    if (cond !== null && typeof cond === "object" && "$in" in (cond as object)) {
      return ((cond as { $in: unknown[] }).$in).includes(doc[key]);
    }
    return doc[key] === cond;
  });
}

class FakeCollection {
  docs: Doc[] = [];

  find(filter: Record<string, unknown> = {}) {
    const out = this.docs.filter((d) => matches(d, filter));
    const cursor = {
      sort: () => cursor,
      toArray: async () => out.map((d) => ({ ...d })),
    };
    return cursor;
  }

  async findOneAndUpdate(
    filter: Record<string, unknown>,
    update: { $set?: Record<string, unknown> }
  ) {
    const doc = this.docs.find((d) => matches(d, filter));
    if (!doc) return null;
    if (update.$set) Object.assign(doc, update.$set);
    return { ...doc };
  }

  async updateOne(
    filter: Record<string, unknown>,
    update: { $set?: Record<string, unknown>; $unset?: Record<string, unknown> }
  ) {
    const doc = this.docs.find((d) => matches(d, filter));
    if (!doc) return { matchedCount: 0 };
    if (update.$set) Object.assign(doc, update.$set);
    if (update.$unset) for (const k of Object.keys(update.$unset)) delete doc[k];
    return { matchedCount: 1 };
  }
}

const fake = vi.hoisted(() => ({
  readings: undefined as unknown,
  rules: undefined as unknown,
  orders: undefined as unknown,
}));

vi.mock("@/lib/db", () => ({
  PRIMARY_READ: { readPreference: "primary" },
  collections: {
    biomarkerReadings: async () => fake.readings,
    biomarkerRules: async () => fake.rules,
    testOrders: async () => fake.orders,
  },
}));

// Guards pass — auth/consent behavior has its own suites.
vi.mock("@/lib/consent-guard", () => ({
  requireConsentedMember: async () => ({
    member: { _id: "mem_0001" },
    denied: null,
  }),
}));
vi.mock("@/lib/auth", () => ({
  requireAdmin: async () => null,
  requireAdminRole: async () => null,
  currentAdmin: async () => ({ adminId: "adm_test", role: "owner" }),
}));

// --- fixtures -------------------------------------------------------------------

const RULES: BiomarkerRule[] = [
  { _id: "apob", code: "apob", name: "ApoB", unit: "g/L", rcvPercent: 10, direction: "lower_is_better" },
  { _id: "hs_crp", code: "hs_crp", name: "hs-CRP", unit: "mg/L", rcvPercent: 85, direction: "lower_is_better" },
];

function reading(overrides: Partial<BiomarkerReading> & { _id: string }): BiomarkerReading {
  return {
    memberId: "mem_0001",
    orderId: "ord_0001",
    code: "apob",
    value: 1.0,
    unit: "g/L",
    takenAt: new Date("2026-05-01T09:00:00.000Z"),
    baselineBand: { low: 0.9, high: 1.1 },
    rcvVerdict: null,
    clinicianReviewed: false,
    source: "lab",
    ...overrides,
  };
}

function order(overrides: Partial<TestOrder> & { _id: string }): TestOrder {
  return {
    memberId: "mem_0001",
    type: "kit",
    panel: "full",
    status: "results_ready",
    bookingStatus: null,
    vendorOrderId: null,
    priceEur: 0,
    includedInPlan: true,
    createdAt: new Date("2026-04-20T09:00:00.000Z"),
    updatedAt: new Date("2026-05-01T09:00:00.000Z"),
    ...overrides,
  };
}

let readingsCol: FakeCollection;
let rulesCol: FakeCollection;
let ordersCol: FakeCollection;

beforeEach(() => {
  readingsCol = new FakeCollection();
  rulesCol = new FakeCollection();
  ordersCol = new FakeCollection();
  rulesCol.docs = RULES.map((r) => ({ ...r }));
  fake.readings = readingsCol;
  fake.rules = rulesCol;
  fake.orders = ordersCol;
});

// --- 1. the note template ---------------------------------------------------------

describe("composeClinicianNote", () => {
  const readAt = new Date("2026-05-02T09:00:00.000Z");

  it("keeps the locked field names but does NOT fabricate a clinician by default", () => {
    const note = composeClinicianNote({
      totalMarkers: 15,
      watchMarkerNames: [],
      readAt,
    });
    // iOS decodes these names — the shared contract locks them.
    expect(Object.keys(note).sort()).toEqual([
      "clinicianName",
      "imcNumber",
      "readAt",
      "text",
    ]);
    // HONESTY: no registered clinician onboarded ⇒ NO name/IMC, no fake persona.
    expect(note.clinicianName).toBe("");
    expect(note.imcNumber).toBe("");
    expect(note.text).not.toContain("Dr.");
    expect(note.text).not.toContain(DEMO_CLINICIAN_NAME);
    expect(note.text).not.toContain(DEMO_CLINICIAN_IMC_NUMBER);
    expect(note.readAt).toEqual(readAt);
    expect(ClinicianNoteSchema.parse(note)).toEqual(note);
  });

  it("default note reads as an AUTOMATED wellness summary, forward-looking on real review", () => {
    const note = composeClinicianNote({
      totalMarkers: 15,
      watchMarkerNames: [],
      readAt,
    });
    expect(note.text).toContain("automated wellness summary");
    expect(note.text).toContain("has not");
    expect(note.text).toContain("been reviewed by a clinician");
    expect(note.text).toContain("registered clinician reviews your results once one is onboarded");
    // Still never claims a human sign-off happened.
    expect(note.text).not.toContain("I've read this panel");
  });

  it("stamps a real registered clinician's identity ONLY when one is supplied", () => {
    const note = composeClinicianNote({
      totalMarkers: 15,
      watchMarkerNames: [],
      readAt,
      // A real reviewer would come from the record; the DEMO persona only
      // exercises the human-sign-off rendering path here.
      clinician: {
        name: DEMO_CLINICIAN_NAME,
        imcNumber: DEMO_CLINICIAN_IMC_NUMBER,
      },
    });
    expect(note.clinicianName).toBe(DEMO_CLINICIAN_NAME);
    expect(note.imcNumber).toBe(DEMO_CLINICIAN_IMC_NUMBER);
    expect(note.text).toContain("A registered clinician has read this panel");
    expect(note.text).not.toContain("automated wellness summary");
  });

  it("all-in-range: wellness-framed, mentions the marker count, never diagnoses", () => {
    const note = composeClinicianNote({
      totalMarkers: 15,
      watchMarkerNames: [],
      readAt,
    });
    expect(note.text).toContain("All 15 markers");
    expect(note.text).toContain("not a diagnosis");
    expect(note.text).not.toMatch(/diagnos(ed|es)\b/i);
  });

  it("watch markers: names them, counts the in-range rest, sells ONLY the €69 recheck", () => {
    const note = composeClinicianNote({
      totalMarkers: 15,
      watchMarkerNames: ["hs-CRP", "ApoB"],
      readAt,
    });
    expect(note.text).toContain("13 of 15 markers");
    expect(note.text).toContain("hs-CRP and ApoB are worth watching");
    // €69 is contractual (ADDON_PRICE_EUR.recheck) — the only sell.
    expect(ADDON_PRICE_EUR.recheck).toBe(69);
    expect(note.text).toContain("€69 recheck");
    expect(note.text).toContain("not a diagnosis");
  });

  it("uses singular grammar for one watch marker", () => {
    const note = composeClinicianNote({
      totalMarkers: 7,
      watchMarkerNames: ["Ferritin"],
      readAt,
    });
    expect(note.text).toContain("Ferritin is worth watching");
  });
});

describe("isWatchMarker (direction-aware — a real improvement is never flagged)", () => {
  const band = { low: 0.9, high: 1.1 };

  it("flags a worsened verdict regardless of the band", () => {
    expect(
      isWatchMarker({ value: 1.0, baselineBand: band, rcvVerdict: "worsened" }, "lower_is_better")
    ).toBe(true);
  });

  it("never flags an improved verdict, even outside the band", () => {
    // e.g. ApoB dropped below the personal band — that's the good direction.
    expect(
      isWatchMarker({ value: 0.7, baselineBand: band, rcvVerdict: "improved" }, "lower_is_better")
    ).toBe(false);
  });

  it("flags only the HARMFUL side of the band", () => {
    expect(isWatchMarker({ value: 1.3, baselineBand: band, rcvVerdict: null }, "lower_is_better")).toBe(true);
    expect(isWatchMarker({ value: 0.7, baselineBand: band, rcvVerdict: null }, "lower_is_better")).toBe(false);
    expect(isWatchMarker({ value: 0.7, baselineBand: band, rcvVerdict: null }, "higher_is_better")).toBe(true);
    expect(isWatchMarker({ value: 1.3, baselineBand: band, rcvVerdict: null }, "higher_is_better")).toBe(false);
  });

  it("is calm by default: in band / no band → not a watch marker", () => {
    expect(isWatchMarker({ value: 1.0, baselineBand: band, rcvVerdict: null }, "lower_is_better")).toBe(false);
    expect(isWatchMarker({ value: 99, baselineBand: null, rcvVerdict: null }, "lower_is_better")).toBe(false);
  });
});

// --- 2. the results payload -------------------------------------------------------

describe("GET /api/v1/results — clinicianNote on the wire", () => {
  it("carries the panel's note on reviewed readings, null otherwise", async () => {
    const note = composeClinicianNote({
      totalMarkers: 2,
      watchMarkerNames: [],
      readAt: new Date("2026-05-02T09:00:00.000Z"),
    });
    ordersCol.docs = [
      order({ _id: "ord_0001", clinicianNote: note }),
      order({ _id: "ord_0002" }), // reviewed panel, note not written yet
    ];
    readingsCol.docs = [
      reading({ _id: "read_1", orderId: "ord_0001", clinicianReviewed: true }),
      reading({ _id: "read_2", orderId: "ord_0001", code: "hs_crp", clinicianReviewed: true }),
      reading({ _id: "read_3", orderId: "ord_0002", clinicianReviewed: true }),
      reading({ _id: "read_4", orderId: "ord_0001", clinicianReviewed: false }),
      reading({ _id: "read_5", orderId: null, clinicianReviewed: false, source: "self_reported" }),
    ];

    const { GET } = await import("@/app/api/v1/results/route");
    const res = await GET(new Request("http://test/api/v1/results"));
    expect(res.status).toBe(200);
    const body = await res.json();
    const byId = new Map(
      (body.results as { id: string; clinicianNote: unknown }[]).map((r) => [r.id, r])
    );

    // Reviewed readings of the noted panel: the EXACT serialized contract shape.
    // HONESTY: name/IMC are empty (automated summary, no clinician onboarded).
    expect(byId.get("read_1")!.clinicianNote).toEqual({
      text: note.text,
      clinicianName: "",
      imcNumber: "",
      readAt: "2026-05-02T09:00:00.000Z",
    });
    expect(byId.get("read_2")!.clinicianNote).toEqual(
      byId.get("read_1")!.clinicianNote
    );
    // Reviewed but no note stored yet → null (never undefined/absent).
    expect(byId.get("read_3")!.clinicianNote).toBeNull();
    // Not yet reviewed → null even though the panel has a note.
    expect(byId.get("read_4")!.clinicianNote).toBeNull();
    // Self-reported (no order) → null.
    expect(byId.get("read_5")!.clinicianNote).toBeNull();
  });
});

// --- 3. review sign-off writes the note ---------------------------------------------

describe("POST /api/v1/admin/results/[id]/review — sign-off writes the note", () => {
  async function post(id: string, body?: object) {
    const { POST } = await import(
      "@/app/api/v1/admin/results/[id]/review/route"
    );
    const req = new Request(`http://test/api/v1/admin/results/${id}/review`, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
    return POST(req, { params: Promise.resolve({ id }) });
  }

  it("marks the reading reviewed and writes an automated (unfabricated) note on the order", async () => {
    ordersCol.docs = [order({ _id: "ord_0001" })];
    readingsCol.docs = [
      reading({ _id: "read_1", clinicianReviewed: false }), // in band
      reading({
        _id: "read_2",
        code: "hs_crp",
        value: 3.2,
        baselineBand: { low: 0.5, high: 3.0 }, // outside own band → watch
        clinicianReviewed: true,
      }),
    ];

    const res = await post("read_1");
    expect(res.status).toBe(200);
    expect((await res.json()).reading.clinicianReviewed).toBe(true);

    const ord = ordersCol.docs[0] as unknown as TestOrder;
    const note = ClinicianNoteSchema.parse(ord.clinicianNote);
    // HONESTY: no registered clinician onboarded ⇒ NO fabricated name/IMC.
    expect(note.clinicianName).toBe("");
    expect(note.imcNumber).toBe("");
    expect(note.text).not.toContain("Dr.");
    expect(note.text).toContain("automated wellness summary");
    expect(note.readAt).toBeInstanceOf(Date);
    // Summarises in-range vs watch, using the rule's display name.
    expect(note.text).toContain("1 of 2 markers");
    expect(note.text).toContain("hs-CRP is worth watching");
    expect(note.text).toContain("€69 recheck");
  });

  it("removes the note when the last reviewed reading of a panel is un-reviewed", async () => {
    const note = composeClinicianNote({
      totalMarkers: 1,
      watchMarkerNames: [],
      readAt: new Date(),
    });
    ordersCol.docs = [order({ _id: "ord_0001", clinicianNote: note })];
    readingsCol.docs = [reading({ _id: "read_1", clinicianReviewed: true })];

    const res = await post("read_1", { reviewed: false });
    expect(res.status).toBe(200);
    expect("clinicianNote" in ordersCol.docs[0]).toBe(false);
  });

  it("leaves orders untouched for readings without an order (self-reported)", async () => {
    ordersCol.docs = [order({ _id: "ord_0001" })];
    readingsCol.docs = [
      reading({ _id: "read_1", orderId: null, source: "self_reported" }),
    ];
    const res = await post("read_1");
    expect(res.status).toBe(200);
    expect((ordersCol.docs[0] as unknown as TestOrder).clinicianNote).toBeUndefined();
  });
});
