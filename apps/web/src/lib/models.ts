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

// --- v2 (accounts, auth, commerce — design_handoff_v2) -----------------------

/** GDPR Art. 9(2)(a) consent purposes (design_handoff_v2 §04). */
export const ConsentPurpose = z.enum([
  "health_processing", // required
  "clinician_review", // required for tests
  "research", // optional, OFF by default
]);
export type ConsentPurpose = z.infer<typeof ConsentPurpose>;

/** Which surface the consent (or auth action) happened on. */
export const ConsentSurface = z.enum(["web", "ios"]);
export type ConsentSurface = z.infer<typeof ConsentSurface>;

/**
 * Current consent-notice wording version. Bump on material changes to the
 * Health Data Notice — users with grants on an older version are shown the
 * re-consent screen on next sign-in (design_handoff_v2 §04 "Versioned").
 */
export const CONSENT_VERSION = "2026-07-01";

/** Where a biomarker value came from. Self-reported (uploaded/typed) values
 * render as hollow gold dots forever and are excluded from clinician-reviewed
 * claims (design_handoff_v2 §13). */
export const BiomarkerSource = z.enum(["lab", "self_reported"]);
export type BiomarkerSource = z.infer<typeof BiomarkerSource>;

/** Dunning ladder (design_handoff_v2 §14 X2): day 0 → 3 → 10 → 14 → pause. */
export const DunningStage = z.enum(["none", "day0", "day3", "day10", "paused"]);
export type DunningStage = z.infer<typeof DunningStage>;

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
  // --- v2 auth fields (password optional — magic link covers everyone) ------
  /** scrypt-derived hash (see member-auth.ts). Null = magic-link-only user. */
  passwordHash: z.string().nullable().default(null),
  /** True once the E1 verify / first magic link has been used. */
  emailVerified: z.boolean().default(false),
  /** Consecutive wrong-password count. 5 failures → 15-minute cool-off. */
  failedAttempts: z.number().int().default(0),
  /** While set and in the future, password sign-in is refused. */
  cooloffUntil: z.date().nullable().default(null),
  // --- GDPR consent-withdrawal / erasure lifecycle (Art.9) ------------------
  /**
   * True once health_processing consent is withdrawn (or the member requests
   * account deletion). While set, Art.9 data endpoints refuse the member —
   * processing has stopped and re-consent is required. See consent-guard.ts.
   */
  processingSuspended: z.boolean().optional(),
  /** When closure / consent withdrawal was recorded (drives the +30d erasure). */
  closureRequestedAt: z.date().nullable().optional(),
  /** Lifecycle: undefined/"active" normally, "closing" after a delete request,
   * "closed" once the erasure job has hard-deleted the data. */
  status: z.enum(["active", "closing", "closed"]).optional(),
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
  /** "pending" = checkout session created, webhook not yet confirmed (v2). */
  status: z
    .enum(["active", "past_due", "canceled", "pending"])
    .default("active"),
  priceEur: z.number(),
  /** MOCK: fake Stripe subscription id from stripe.mock.ts */
  stripeSubscriptionId: z.string().nullable().default(null),
  // --- v2 dunning (0/3/10/14 days → read-only pause, nothing deleted) --------
  dunningStage: DunningStage.default("none"),
  /** When the first failed renewal charge happened (null when not dunning). */
  dunningStartedAt: z.date().nullable().default(null),
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
  /** v2: lab (Arcaevo pipeline) vs self_reported (uploaded/typed bloodwork). */
  source: BiomarkerSource.default("lab"),
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
// v2 documents (accounts, auth, commerce)
// ---------------------------------------------------------------------------

/** One consent decision — append-only audit trail, never updated in place. */
export const ConsentSchema = z.object({
  _id: z.string(), // e.g. "consent_0001"
  userId: z.string(),
  purpose: ConsentPurpose,
  granted: z.boolean(),
  /** Wording version of the Health Data Notice at decision time. */
  version: z.string(),
  timestamp: z.date(),
  surface: ConsentSurface,
});
export type Consent = z.infer<typeof ConsentSchema>;

export const WaitlistEntrySchema = z.object({
  _id: z.string(), // e.g. "wait_0001"
  email: z.string(),
  /** First 3 chars of the Eircode — the only part we ever store. */
  routingKey: z.string(),
  county: z.string(),
  /** Position within the county queue (1-based, assigned at join). */
  position: z.number().int(),
  createdAt: z.date(),
});
export type WaitlistEntry = z.infer<typeof WaitlistEntrySchema>;

export const GiftCodeSchema = z.object({
  _id: z.string(), // the code itself, e.g. "GIFT-K4F2-9QXA"
  tier: MembershipTier, // Essential only at launch (design §16)
  priceEur: z.number(),
  purchaserEmail: z.string(),
  recipientEmail: z.string().nullable().default(null),
  /** Optional gift note, shown to the recipient only. */
  note: z.string().nullable().default(null),
  delivery: z.enum(["email", "printed"]),
  createdAt: z.date(),
  /** Set at activation — the membership year starts here, not at purchase. */
  redeemedBy: z.string().nullable().default(null), // userId
  redeemedAt: z.date().nullable().default(null),
});
export type GiftCode = z.infer<typeof GiftCodeSchema>;

export const ReferralCodeSchema = z.object({
  _id: z.string(), // the code itself, e.g. "AOIFE-K4"
  userId: z.string(),
  /** Give a month / get a month — counts, no leaderboards (design §16). */
  joinedCount: z.number().int().default(0),
  freeMonthsApplied: z.number().int().default(0),
  createdAt: z.date(),
});
export type ReferralCode = z.infer<typeof ReferralCodeSchema>;

export const ShareLinkAccessSchema = z.object({
  at: z.date(),
  /** Coarse location only — shown to the member ("Opened twice — Dublin"). */
  location: z.string(),
});
export type ShareLinkAccess = z.infer<typeof ShareLinkAccessSchema>;

/** GP share link — revocable, 30-day expiry, access logged (design §15). */
export const ShareLinkSchema = z.object({
  _id: z.string(), // e.g. "share_0001"
  token: z.string(), // URL token: arcaevo.com/s/<token>
  userId: z.string(),
  createdAt: z.date(),
  expiresAt: z.date(),
  revoked: z.boolean().default(false),
  accessLog: z.array(ShareLinkAccessSchema).default([]),
});
export type ShareLink = z.infer<typeof ShareLinkSchema>;

export const MagicLinkPurpose = z.enum(["verify", "signin", "reset"]);
export type MagicLinkPurpose = z.infer<typeof MagicLinkPurpose>;

/** Magic-link token — 30-minute expiry, single-use. Only the SHA-256 hash of
 * the token is stored; the raw token exists only inside the emailed URL. */
export const MagicLinkTokenSchema = z.object({
  _id: z.string(), // e.g. "mlt_0001"
  tokenHash: z.string(),
  email: z.string(),
  purpose: MagicLinkPurpose,
  createdAt: z.date(),
  expiresAt: z.date(),
  usedAt: z.date().nullable().default(null),
});
export type MagicLinkToken = z.infer<typeof MagicLinkTokenSchema>;

/** Default session lifetime (days). Web sessions predating device scoping
 * carry NO expiresAt and are treated as non-expiring (backward compat). */
export const SESSION_TTL_DAYS = 30;

/** Member session — random 256-bit token stored SHA-256-hashed.
 *
 * `device` scopes a session to a surface (Web/iPhone/Apple Watch) so the phone
 * and watch authenticate independently and each is individually revocable.
 * Legacy rows have no `device` (read as "web") and no `expiresAt` (never
 * expire) — both fields are optional-compatible so existing data/tests hold. */
export const SessionSchema = z.object({
  _id: z.string(), // e.g. "sess_<hash prefix>"
  tokenHash: z.string(),
  userId: z.string(),
  createdAt: z.date(),
  lastSeen: z.date(),
  userAgent: z.string(),
  device: z.enum(["web", "ios", "watch"]).default("web"),
  expiresAt: z.date().optional(),
  label: z.string().optional(),
});
export type Session = z.infer<typeof SessionSchema>;
export type SessionDevice = z.infer<typeof SessionSchema>["device"];

/** Eircode routing-key allowlist — config, not code (design §06). */
export const EligibilityConfigSchema = z.object({
  _id: z.literal("launch"),
  allowedRoutingKeys: z.array(z.string()),
  updatedAt: z.date(),
});
export type EligibilityConfig = z.infer<typeof EligibilityConfigSchema>;

/** Rejected routing-key log — key only, no address, drives expansion. */
export const EligibilityRejectionSchema = z.object({
  _id: z.string(), // e.g. "elig_rej_0001"
  routingKey: z.string(),
  county: z.string(),
  at: z.date(),
});
export type EligibilityRejection = z.infer<typeof EligibilityRejectionSchema>;

/** One uploaded bloodwork document going through AI extraction → user
 * confirmation (design §13). MOCK: extraction is deterministic fake data. */
export const BloodworkUploadSchema = z.object({
  _id: z.string(), // e.g. "upload_0001"
  memberId: z.string(),
  kind: z.enum(["photo", "pdf", "manual"]),
  fileName: z.string().nullable().default(null),
  /** Lab/source name AI read off the document, e.g. "St. Vincent's". */
  sourceName: z.string(),
  documentDate: z.string(), // "YYYY-MM-DD" as read from the document
  status: z.enum(["pending_confirmation", "confirmed", "discarded"]),
  extracted: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      unit: z.string(),
      value: z.number(),
      /** 0–1. Below CONFIDENCE_THRESHOLD ⇒ flagged, blocks until resolved. */
      confidence: z.number(),
      /** Present on low-confidence reads, e.g. [41, 47] for "41 or 47?". */
      alternatives: z.array(z.number()).nullable().default(null),
    })
  ),
  createdAt: z.date(),
  confirmedAt: z.date().nullable().default(null),
});
export type BloodworkUpload = z.infer<typeof BloodworkUploadSchema>;

/**
 * GDPR erasure grace window: after a member requests deletion / withdraws
 * health_processing, their data is hard-deleted no sooner than this many days
 * later (design §10 "erased permanently within 30 days"). The scheduled job
 * (scripts/run-erasure.ts) only picks up jobs whose eraseAfter has passed.
 */
export const ERASURE_GRACE_DAYS = 30;

export const ErasureJobStatus = z.enum(["scheduled", "done"]);
export type ErasureJobStatus = z.infer<typeof ErasureJobStatus>;

/**
 * A queued right-to-erasure request (GDPR Art.17). Written when a member
 * deletes their account; the scheduled runner hard-deletes their data across
 * every collection (EXCEPT the consent audit trail) once eraseAfter passes.
 */
export const ErasureJobSchema = z.object({
  _id: z.string(), // e.g. "erasure_0001"
  userId: z.string(),
  /** Stored so the runner can purge email-keyed PII (outbox, waitlist) even
   * after the user document itself is gone — keeps the job idempotent. */
  email: z.string(),
  requestedAt: z.date(),
  /** Not erased before this instant (requestedAt + ERASURE_GRACE_DAYS). */
  eraseAfter: z.date(),
  status: ErasureJobStatus.default("scheduled"),
  completedAt: z.date().nullable().default(null),
});
export type ErasureJob = z.infer<typeof ErasureJobSchema>;

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

// --- v2 API inputs -----------------------------------------------------------

export const SignupInput = z.object({
  email: z.string().email(),
  /** Optional — a magic link covers everyone (design §03 W1). */
  password: z.string().min(10).optional(),
  surface: ConsentSurface.default("web"),
});
export type SignupInput = z.infer<typeof SignupInput>;

export const MagicLinkRequestInput = z.object({
  email: z.string().email(),
  purpose: z.enum(["signin", "verify"]).default("signin"),
});

export const MagicLinkVerifyInput = z.object({
  token: z.string().min(1),
});

export const SigninInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const ResetRequestInput = z.object({
  email: z.string().email(),
});

export const ResetConfirmInput = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(10),
});

export const ConsentGrantInput = z.object({
  surface: ConsentSurface.default("web"),
  grants: z
    .array(z.object({ purpose: ConsentPurpose, granted: z.boolean() }))
    .min(1),
});

export const EligibilityCheckInput = z.object({
  /** Full Eircode or just the routing key — only the first 3 chars are used. */
  eircode: z.string().min(1),
});

export const WaitlistJoinInput = z.object({
  email: z.string().email(),
  eircode: z.string().min(1),
});

export const CheckoutInput = z.object({
  tier: MembershipTier,
  /** Quarterly cadence upgrade, Essential only (+€130/yr). */
  cadenceUpgrade: z.boolean().default(false),
  /** Required for essential/performance — checked server-side. */
  eircode: z.string().optional(),
  /** Guest checkout: account is created inline (design §07). */
  email: z.string().email().optional(),
  name: z.string().optional(),
  /** DOB is a lab requirement, collected at checkout step 2. */
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const GiftCreateInput = z.object({
  purchaserEmail: z.string().email(),
  recipientEmail: z.string().email().optional(),
  note: z.string().max(280).optional(),
  delivery: z.enum(["email", "printed"]).default("email"),
});

export const GiftRedeemInput = z.object({
  code: z.string().min(1),
  /** Essential ships kits — the same Eircode gate applies at redemption. */
  eircode: z.string().min(1),
});

export const ShareCreateInput = z.object({
  /** Days until expiry (default 30 per design §15). */
  expiresInDays: z.number().int().min(1).max(90).default(30),
});

export const BloodworkUploadInput = z.object({
  kind: z.enum(["photo", "pdf", "manual"]),
  fileName: z.string().optional(),
  /** For kind "manual": the user-typed values (skip AI extraction). Capped so
   * a single upload can't fabricate an unbounded marker set. */
  manualValues: z
    .array(z.object({ code: z.string(), value: z.number(), unit: z.string() }))
    .max(100)
    .optional(),
});

export const BloodworkConfirmInput = z.object({
  uploadId: z.string().min(1),
  /** The user-confirmed value for every marker (flagged ones resolved). Capped
   * at 100 — the confirm handler does one batched lookup, but an unbounded
   * array is still a DoS amplification vector. A real panel is well under 100. */
  values: z
    .array(z.object({ code: z.string(), value: z.number() }))
    .min(1)
    .max(100),
  /** When the original sample was taken, e.g. the document date. */
  takenAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
