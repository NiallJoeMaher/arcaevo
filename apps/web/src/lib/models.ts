/**
 * Arcaevo data models — zod schemas + TS types.
 *
 * These are the canonical shapes for every Mongo collection (see db.ts) and
 * for API payload validation. Keep in sync with design_handoff/README.md
 * "State Management & Data" and docs/MOCKED_APIS.md.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared enums / primitives
// ---------------------------------------------------------------------------

export const MembershipTier = z.enum(["fusion", "essential", "performance"]);
export type MembershipTier = z.infer<typeof MembershipTier>;

export const TestOrderType = z.enum(["kit", "venous"]);
export type TestOrderType = z.infer<typeof TestOrderType>;

export const TestPanel = z.enum(["full", "recheck", "venous80"]);
export type TestPanel = z.infer<typeof TestPanel>;

/** Test order status machine — strictly forward-only, in this order. */
export const ORDER_STATUS_SEQUENCE = [
  "ordered",
  "shipped",
  "delivered",
  "sample_registered",
  "in_lab",
  "results_ready",
] as const;
export const TestOrderStatus = z.enum(ORDER_STATUS_SEQUENCE);
export type TestOrderStatus = z.infer<typeof TestOrderStatus>;

/** Venous (Performance tier) draws additionally track phlebotomy booking. */
export const VenousBookingStatus = z.enum([
  "unbooked",
  "nurse_booked",
  "draw_completed",
]);
export type VenousBookingStatus = z.infer<typeof VenousBookingStatus>;

export const RcvVerdict = z.enum(["improved", "no_real_change", "worsened"]);
export type RcvVerdict = z.infer<typeof RcvVerdict>;

/** Which direction of change is beneficial for a biomarker. */
export const RuleDirection = z.enum(["lower_is_better", "higher_is_better"]);
export type RuleDirection = z.infer<typeof RuleDirection>;

/** v1 integrations: Apple Watch + Apple Health ONLY. WHOOP/Oura/Garmin are roadmap. */
export const WearableSource = z.enum(["apple_health"]);
export type WearableSource = z.infer<typeof WearableSource>;

export const WearableSignalType = z.enum(["hrv", "rhr", "sleep", "vo2max"]);
export type WearableSignalType = z.infer<typeof WearableSignalType>;

export const SupportTicketStatus = z.enum(["open", "pending", "closed"]);
export type SupportTicketStatus = z.infer<typeof SupportTicketStatus>;

// ---------------------------------------------------------------------------
// Pricing (verbatim from design handoff — do not change)
// ---------------------------------------------------------------------------

/** Annual membership prices in EUR. Annual billing only in v1. */
export const TIER_PRICE_EUR: Record<MembershipTier, number> = {
  fusion: 119,
  essential: 329,
  performance: 399,
};

/** Quarterly cadence upgrade (Essential + €130/yr). */
export const CADENCE_UPGRADE_EUR = 130;

/** Single add-on test prices in EUR. */
export const ADDON_PRICE_EUR: Record<TestPanel, number> = {
  full: 99,
  recheck: 69,
  venous80: 199,
};

/** Included tests per membership year, by tier. */
export const TIER_INCLUDED_TESTS: Record<
  MembershipTier,
  { panel: TestPanel; count: number }[]
> = {
  fusion: [], // no tests — Apple Watch/Health sync + upload past bloodwork
  essential: [
    { panel: "full", count: 1 },
    { panel: "recheck", count: 1 },
  ],
  performance: [{ panel: "venous80", count: 1 }],
};

// ---------------------------------------------------------------------------
// Documents (Mongo collections)
// ---------------------------------------------------------------------------

export const UserSchema = z.object({
  _id: z.string(), // e.g. "mem_0001"
  name: z.string(),
  email: z.string(),
  joinedAt: z.date(),
  /** The single seeded demo member the "demo-member-token" bearer maps to. */
  isDemo: z.boolean().default(false),
  /** Ops flag surfaced in the admin members table. */
  flag: z.enum(["active", "new", "churn_risk"]).default("active"),
});
export type User = z.infer<typeof UserSchema>;

export const MembershipSchema = z.object({
  _id: z.string(), // e.g. "sub_0001"
  memberId: z.string(),
  tier: MembershipTier,
  /** Annual term only in v1 — no monthly billing at launch. */
  term: z.literal("annual"),
  termStart: z.date(),
  renewalDate: z.date(),
  /** Quarterly cadence upgrade (+€130/yr, Essential only in the designs). */
  cadenceUpgrade: z.boolean().default(false),
  status: z.enum(["active", "past_due", "canceled"]).default("active"),
  priceEur: z.number(),
  /** MOCK: fake Stripe subscription id from stripe.mock.ts */
  stripeSubscriptionId: z.string().nullable().default(null),
});
export type Membership = z.infer<typeof MembershipSchema>;

export const TestOrderSchema = z.object({
  _id: z.string(), // e.g. "ord_0001"
  memberId: z.string(),
  type: TestOrderType, // kit = finger-prick, venous = Dublin mobile phlebotomy
  panel: TestPanel,
  status: TestOrderStatus,
  /** Only meaningful for venous orders; null for kit orders. */
  bookingStatus: VenousBookingStatus.nullable().default(null),
  /** MOCK: id issued by the mocked LetsGetChecked vendor. */
  vendorOrderId: z.string().nullable().default(null),
  /** 0 when covered by the membership's included-test allowance. */
  priceEur: z.number(),
  includedInPlan: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type TestOrder = z.infer<typeof TestOrderSchema>;

export const BaselineBandSchema = z.object({
  low: z.number(),
  high: z.number(),
});
export type BaselineBand = z.infer<typeof BaselineBandSchema>;

export const BiomarkerReadingSchema = z.object({
  _id: z.string(), // e.g. "read_0001"
  memberId: z.string(),
  orderId: z.string().nullable().default(null),
  code: z.string(), // BiomarkerRule.code, e.g. "apob"
  value: z.number(),
  unit: z.string(),
  takenAt: z.date(),
  /** Personal baseline band (null until enough history exists). */
  baselineBand: BaselineBandSchema.nullable().default(null),
  /** RCV verdict vs the prior reading (null for the first reading). */
  rcvVerdict: RcvVerdict.nullable().default(null),
  clinicianReviewed: z.boolean().default(false),
});
export type BiomarkerReading = z.infer<typeof BiomarkerReadingSchema>;

export const BiomarkerRuleSchema = z.object({
  _id: z.string(), // rule code doubles as id, e.g. "apob"
  code: z.string(),
  name: z.string(),
  unit: z.string(),
  /**
   * Reference Change Value as a percentage. A change between two readings is
   * only "real" (beyond analytical + biological variation) if it exceeds this.
   * Deterministic rules decide; AI only narrates.
   */
  rcvPercent: z.number(),
  direction: RuleDirection,
});
export type BiomarkerRule = z.infer<typeof BiomarkerRuleSchema>;

export const WearableSignalSchema = z.object({
  _id: z.string(), // deterministic: `${memberId}:${type}:${date}`
  memberId: z.string(),
  source: WearableSource, // apple_health only in v1
  type: WearableSignalType,
  value: z.number(), // hrv ms · rhr bpm · sleep hours · vo2max ml/kg/min
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // day-granularity key
});
export type WearableSignal = z.infer<typeof WearableSignalSchema>;

export const SupportTicketSchema = z.object({
  _id: z.string(), // e.g. "tick_0001"
  memberId: z.string().nullable().default(null),
  subject: z.string(),
  body: z.string(),
  status: SupportTicketStatus.default("open"),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type SupportTicket = z.infer<typeof SupportTicketSchema>;

/** MOCK: emails are never sent — email.mock.ts writes them here (`outbox`). */
export const OutboxEmailSchema = z.object({
  _id: z.string(), // e.g. "email_0001"
  to: z.string(),
  subject: z.string(),
  body: z.string(),
  template: z.string(), // e.g. "receipt", "kit_reminder", "results_ready"
  createdAt: z.date(),
});
export type OutboxEmail = z.infer<typeof OutboxEmailSchema>;

// ---------------------------------------------------------------------------
// API input schemas
// ---------------------------------------------------------------------------

export const CreateOrderInput = z.object({
  type: TestOrderType,
  panel: TestPanel,
});
export type CreateOrderInput = z.infer<typeof CreateOrderInput>;

export const SyncWearablesInput = z.object({
  source: z.string(), // validated against WearableSource in the route (nicer error)
  signals: z
    .array(
      z.object({
        type: WearableSignalType,
        value: z.number().finite(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .min(1)
    .max(2000),
});
export type SyncWearablesInput = z.infer<typeof SyncWearablesInput>;

export const AdminLoginInput = z.object({
  password: z.string().min(1),
});

export const CreateSupportTicketInput = z.object({
  memberId: z.string().nullable().optional(),
  subject: z.string().min(1),
  body: z.string().min(1),
  priority: z.enum(["low", "normal", "high"]).optional(),
});

export const ReviewResultInput = z.object({
  reviewed: z.boolean().default(true),
});
