/**
 * Unit tests for src/lib/models.ts — zod schemas accept seed-shaped documents
 * and reject bad enums; pricing/allowance constants are verbatim from the
 * design handoff (Fusion €119 · Essential €329 · Performance €399 annual,
 * +€130/yr quarterly cadence, add-ons €99/€69/€199).
 */
import { describe, expect, it } from "vitest";
import {
  ADDON_PRICE_EUR,
  BiomarkerReadingSchema,
  BiomarkerRuleSchema,
  CADENCE_UPGRADE_EUR,
  CreateOrderInput,
  MagicLinkTokenSchema,
  MagicLinkVerifyInput,
  MembershipSchema,
  ORDER_STATUS_SEQUENCE,
  SupportTicketSchema,
  TestOrderSchema,
  TIER_INCLUDED_TESTS,
  TIER_PRICE_EUR,
  UserSchema,
  WaitlistEntrySchema,
  WaitlistJoinInput,
  WearableSignalSchema,
} from "@/lib/models";

// --- seed-shaped fixtures (mirror scripts/seed.ts document shapes) ---------

const seedUser = {
  _id: "mem_0001",
  name: "Aoife Byrne",
  email: "aoife.byrne@example.com",
  joinedAt: new Date("2025-09-14T00:00:00Z"),
  isDemo: true,
  flag: "active",
  // v2 auth fields (magic-link-only member)
  passwordHash: null,
  emailVerified: false,
  failedAttempts: 0,
  cooloffUntil: null,
};

const seedMembership = {
  _id: "sub_0001",
  memberId: "mem_0001",
  tier: "essential",
  term: "annual",
  termStart: new Date("2025-09-14T00:00:00Z"),
  renewalDate: new Date("2026-09-14T00:00:00Z"),
  cadenceUpgrade: true,
  status: "active",
  priceEur: 329,
  stripeSubscriptionId: "sub_mock_0a1b2c3d",
  // v2 dunning fields (not currently in dunning)
  dunningStage: "none",
  dunningStartedAt: null,
};

const seedOrder = {
  _id: "ord_0001",
  memberId: "mem_0001",
  type: "kit",
  panel: "full",
  status: "results_ready",
  bookingStatus: null,
  vendorOrderId: "lgc_mock_0001",
  priceEur: 0,
  includedInPlan: true,
  createdAt: new Date("2025-09-20T00:00:00Z"),
  updatedAt: new Date("2025-10-02T00:00:00Z"),
};

const seedReading = {
  _id: "read_0001",
  memberId: "mem_0001",
  orderId: "ord_0001",
  code: "apob",
  value: 0.94,
  unit: "g/L",
  takenAt: new Date("2025-10-01T00:00:00Z"),
  baselineBand: { low: 0.85, high: 1.05 },
  rcvVerdict: "improved",
  clinicianReviewed: true,
  source: "lab", // v2: lab | self_reported
};

const seedRule = {
  _id: "apob",
  code: "apob",
  name: "ApoB",
  unit: "g/L",
  rcvPercent: 10,
  direction: "lower_is_better",
};

const seedSignal = {
  _id: "mem_0001:hrv:2026-07-01",
  memberId: "mem_0001",
  source: "apple_health",
  type: "hrv",
  value: 62,
  date: "2026-07-01",
};

const seedTicket = {
  _id: "tick_0001",
  memberId: "mem_0001",
  subject: "Kit not arrived",
  body: "Ordered a week ago, nothing yet.",
  status: "open",
  priority: "normal",
  createdAt: new Date("2026-06-28T00:00:00Z"),
  updatedAt: new Date("2026-06-28T00:00:00Z"),
};

describe("document schemas accept seed-shaped documents", () => {
  it("User", () => {
    expect(UserSchema.parse(seedUser)).toEqual(seedUser);
  });

  it("Membership", () => {
    expect(MembershipSchema.parse(seedMembership)).toEqual(seedMembership);
  });

  it("TestOrder (kit and venous)", () => {
    expect(TestOrderSchema.parse(seedOrder)).toEqual(seedOrder);
    const venous = {
      ...seedOrder,
      _id: "ord_0002",
      type: "venous",
      panel: "venous80",
      status: "ordered",
      bookingStatus: "nurse_booked",
      vendorOrderId: null,
      priceEur: 199,
      includedInPlan: false,
    };
    expect(TestOrderSchema.parse(venous)).toEqual(venous);
  });

  it("BiomarkerReading (incl. first reading with null band/verdict)", () => {
    expect(BiomarkerReadingSchema.parse(seedReading)).toEqual(seedReading);
    const first = {
      ...seedReading,
      _id: "read_0002",
      baselineBand: null,
      rcvVerdict: null,
      clinicianReviewed: false,
    };
    expect(BiomarkerReadingSchema.parse(first)).toEqual(first);
  });

  it("BiomarkerRule", () => {
    expect(BiomarkerRuleSchema.parse(seedRule)).toEqual(seedRule);
  });

  it("WearableSignal", () => {
    expect(WearableSignalSchema.parse(seedSignal)).toEqual(seedSignal);
  });

  it("SupportTicket", () => {
    expect(SupportTicketSchema.parse(seedTicket)).toEqual(seedTicket);
  });

  it("applies documented defaults for optional operational fields", () => {
    const parsed = UserSchema.parse({
      _id: "mem_0002",
      name: "Test",
      email: "t@example.com",
      joinedAt: new Date(),
    });
    expect(parsed.isDemo).toBe(false);
    expect(parsed.flag).toBe("active");
  });
});

describe("schemas reject bad enums", () => {
  it("rejects an unknown membership tier", () => {
    const bad = { ...seedMembership, tier: "premium" };
    expect(MembershipSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects non-annual membership terms (annual-only in v1)", () => {
    const bad = { ...seedMembership, term: "monthly" };
    expect(MembershipSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an order status outside the pipeline", () => {
    for (const status of ["cancelled", "refunded", "pending", ""]) {
      const bad = { ...seedOrder, status };
      expect(TestOrderSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("accepts every status in the forward-only pipeline", () => {
    for (const status of ORDER_STATUS_SEQUENCE) {
      expect(TestOrderSchema.safeParse({ ...seedOrder, status }).success).toBe(
        true
      );
    }
  });

  it("rejects wearable sources other than apple_health (WHOOP/Oura/Garmin are roadmap)", () => {
    for (const source of ["whoop", "oura", "garmin", "fitbit"]) {
      const bad = { ...seedSignal, source };
      expect(WearableSignalSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("rejects malformed wearable date keys (day granularity YYYY-MM-DD)", () => {
    const bad = { ...seedSignal, date: "2026-7-1" };
    expect(WearableSignalSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an unknown panel on order creation input", () => {
    expect(CreateOrderInput.safeParse({ type: "kit", panel: "mega" }).success).toBe(
      false
    );
    expect(CreateOrderInput.safeParse({ type: "kit", panel: "full" }).success).toBe(
      true
    );
  });
});

describe("pricing constants (verbatim from the design handoff)", () => {
  it("annual tier prices: fusion 119, essential 329, performance 399 (EUR)", () => {
    expect(TIER_PRICE_EUR).toEqual({
      fusion: 119,
      essential: 329,
      performance: 399,
    });
  });

  it("quarterly cadence upgrade is exactly 130 EUR/yr", () => {
    expect(CADENCE_UPGRADE_EUR).toBe(130);
  });

  it("add-on prices: full 99, recheck 69, venous80 199 (EUR)", () => {
    expect(ADDON_PRICE_EUR).toEqual({
      full: 99,
      recheck: 69,
      venous80: 199,
    });
  });

  it("tier test allowances match the plans", () => {
    expect(TIER_INCLUDED_TESTS.fusion).toEqual([]);
    expect(TIER_INCLUDED_TESTS.essential).toEqual([
      { panel: "full", count: 1 },
      { panel: "recheck", count: 1 },
    ]);
    expect(TIER_INCLUDED_TESTS.performance).toEqual([
      { panel: "venous80", count: 1 },
    ]);
  });
});

// --- waitlist early-access fields (motion handoff Task 7) -------------------

describe("waitlist schemas — additive name + planInterest fields", () => {
  const baseEntry = {
    _id: "wait_0001",
    email: "aoife.byrne@example.com",
    routingKey: "T12",
    county: "Cork",
    position: 1,
    createdAt: new Date("2026-07-01T00:00:00Z"),
  };

  it("WaitlistEntrySchema accepts an entry with name + planInterest (values kept)", () => {
    const entry = { ...baseEntry, name: "Aoife Byrne", planInterest: "either" };
    const parsed = WaitlistEntrySchema.parse(entry);
    expect(parsed.name).toBe("Aoife Byrne");
    expect(parsed.planInterest).toBe("either");
  });

  it("WaitlistEntrySchema still accepts the pre-Task-7 shape (fields optional)", () => {
    expect(WaitlistEntrySchema.parse(baseEntry)).toEqual(baseEntry);
  });

  it("WaitlistJoinInput still accepts the old {email, eircode} shape", () => {
    expect(
      WaitlistJoinInput.safeParse({ email: "a@example.ie", eircode: "T12AB34" })
        .success
    ).toBe(true);
  });

  it("WaitlistJoinInput keeps name + planInterest on parse output (not stripped)", () => {
    const parsed = WaitlistJoinInput.parse({
      email: "a@example.ie",
      eircode: "T12AB34",
      name: "Aoife Byrne",
      planInterest: "essential",
    });
    expect(parsed.name).toBe("Aoife Byrne");
    expect(parsed.planInterest).toBe("essential");
  });

  it("planInterest rejects values outside essential/performance/either", () => {
    for (const planInterest of ["premium", "fusion", ""]) {
      expect(
        WaitlistJoinInput.safeParse({
          email: "a@example.ie",
          eircode: "T12AB34",
          planInterest,
        }).success
      ).toBe(false);
      expect(
        WaitlistEntrySchema.safeParse({ ...baseEntry, planInterest }).success
      ).toBe(false);
    }
  });
});

// --- magic-link code fallback (Phase 21) -----------------------------------

describe("MagicLinkTokenSchema — optional code fields, backward compatible", () => {
  const base = {
    _id: "mlt_abc",
    tokenHash: "hash",
    email: "aoife@example.ie",
    purpose: "signin" as const,
    createdAt: new Date(),
    expiresAt: new Date(),
  };

  it("accepts a pre-Phase-21 row with no code fields (codeAttempts defaults to 0)", () => {
    const parsed = MagicLinkTokenSchema.parse({ ...base });
    expect(parsed.codeHash).toBeUndefined();
    expect(parsed.codeAttempts).toBe(0);
  });

  it("accepts a Phase-21 row with codeHash + codeAttempts", () => {
    const parsed = MagicLinkTokenSchema.parse({
      ...base,
      codeHash: "codehash",
      codeAttempts: 3,
    });
    expect(parsed.codeHash).toBe("codehash");
    expect(parsed.codeAttempts).toBe(3);
  });
});

describe("MagicLinkVerifyInput — token OR email+code, never neither", () => {
  it("accepts the link token path", () => {
    expect(MagicLinkVerifyInput.safeParse({ token: "t" }).success).toBe(true);
  });
  it("accepts the email+code path", () => {
    expect(
      MagicLinkVerifyInput.safeParse({ email: "aoife@example.ie", code: "KX4-9WP" }).success
    ).toBe(true);
  });
  it("rejects an empty body and email-without-code", () => {
    expect(MagicLinkVerifyInput.safeParse({}).success).toBe(false);
    expect(MagicLinkVerifyInput.safeParse({ email: "aoife@example.ie" }).success).toBe(false);
  });
});
