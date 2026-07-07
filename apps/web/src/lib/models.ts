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
  /**
   * Real Stripe customer id (`cus_…`) — created/looked up by the LIVE payments
   * vendor and reused across checkouts so tax/portal/dunning stay tied to one
   * customer. Null for members who never reached a live Stripe checkout (all of
   * dev/e2e, which uses the MOCK vendor). See src/lib/vendors/stripe.live.ts.
   */
  stripeCustomerId: z.string().nullable().optional(),
  // --- Referral attribution ("give a month / get a month", design §16) ------
  /**
   * The referrer's userId, resolved from the `?ref=<code>` the member arrived
   * on at signup. Null/absent when they joined without a valid referral code.
   * Additive/optional so pre-referral users stay valid. Never leaked back to
   * the referrer (GDPR posture — counts only, no referee identity). See
   * src/lib/referral.ts.
   */
  referredBy: z.string().nullable().optional(),
  /** The referral code (ReferralCode._id) the member joined with. */
  referredByCode: z.string().nullable().optional(),
  /** When the referral was attributed (signup time). */
  referredAt: z.date().nullable().optional(),
  /**
   * HELD referrer reward: +1-month referral credits earned while this member
   * had no active membership to extend yet. Consumed (applied to the
   * membership renewalDate, then reset to 0) at their next PAID activation.
   * See creditReferralOnActivation in src/lib/referral.ts.
   */
  referralCreditMonths: z.number().int().optional(),
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
  /** Stripe subscription id: MOCK `sub_mock_…` (stripe.mock.ts) or a real
   * `sub_…` set by the LIVE webhook on checkout.session.completed. */
  stripeSubscriptionId: z.string().nullable().default(null),
  /** Real Stripe `cancel_at_period_end` — set by the LIVE
   * customer.subscription.updated webhook (the "cancel renewal" flow). The
   * membership stays `active` until period end; this drives the UI copy. */
  cancelAtPeriodEnd: z.boolean().optional(),
  // --- v2 dunning (0/3/10/14 days → read-only pause, nothing deleted) --------
  dunningStage: DunningStage.default("none"),
  /** When the first failed renewal charge happened (null when not dunning). */
  dunningStartedAt: z.date().nullable().default(null),
});
export type Membership = z.infer<typeof MembershipSchema>;

// --- Clinician note (Phase 22 — daily-engagement handoff, ALGORITHM.md §5) ---

/**
 * SAMPLE PERSONA — DEMO/TEST ONLY (docs/MOCKED_APIS.md §15).
 *
 * "Dr. S. Nolan, IMC 412887" is a FICTIONAL reviewer from the designs. There is
 * NO registered reviewing clinician onboarded yet, so this persona must NEVER be
 * presented to a real user or their GP as a real medical review — doing so
 * fabricates medical authority (a real-looking IMC number) and is a regulatory
 * risk. It is retained only to exercise the human-sign-off rendering path in
 * tests, for the day a real clinician is configured from real data.
 *
 * [TODO: real reviewing clinician + IMC] — when the medical-ops partner + a
 * registered clinician are live, the note is signed with their real name + IMC
 * (passed as the `clinician` argument to composeClinicianNote), not this persona.
 */
export const DEMO_CLINICIAN_NAME = "Dr. S. Nolan";
export const DEMO_CLINICIAN_IMC_NUMBER = "412887";

/**
 * A short human note on EVERY reviewed panel (a panel = one TestOrder's
 * result set) — the review flow extends from critical-values-only to a
 * template-assisted note a human signs (name + IMC number + read date shown).
 *
 * Field names are LOCKED by the Phase 22 shared contract — iOS decodes
 * `clinicianNote { text, clinicianName, imcNumber, readAt }` off the results
 * payload. Do not rename.
 */
export const ClinicianNoteSchema = z.object({
  text: z.string(),
  clinicianName: z.string(),
  imcNumber: z.string(),
  readAt: z.date(),
});
export type ClinicianNote = z.infer<typeof ClinicianNoteSchema>;

/** "a", "a and b", "a, b and c" — for the note's watch-marker list. */
function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Is a reading one the reviewer would flag as "worth watching"?
 *
 * Direction-aware, so a real IMPROVEMENT is never flagged: watch = the
 * verdict worsened, OR the value sits outside the member's own baseline band
 * on the HARMFUL side for the marker (e.g. above band for lower-is-better).
 * Never a diagnosis — just what earns a second look at a recheck.
 */
export function isWatchMarker(
  reading: {
    value: number;
    baselineBand: BaselineBand | null | undefined;
    rcvVerdict: RcvVerdict | null | undefined;
  },
  direction: RuleDirection
): boolean {
  if (reading.rcvVerdict === "worsened") return true;
  if (reading.rcvVerdict === "improved") return false; // real change, good way
  const band = reading.baselineBand;
  if (!band) return false;
  return direction === "lower_is_better"
    ? reading.value > band.high
    : reading.value < band.low;
}

/**
 * Template-assisted panel summary — wellness-framed, NEVER diagnostic.
 * Summarises in-range vs watch markers; when something is worth watching it
 * points at the €69 recheck (the only sell in the daily layer).
 *
 * HONESTY (docs/legal/MEDICAL_DEVICE_POSITIONING.md, GAP_REVIEW_2 #2): until a
 * registered clinician is onboarded, no human has signed these off. So the
 * DEFAULT is an AUTOMATED wellness summary — it never claims a human review and
 * carries NO clinician name/IMC (both fields are empty strings). Pass a real
 * reviewing `clinician` (name + IMC) ONLY when a registered, IMC-listed
 * clinician has actually signed the panel; that switches the copy to a human
 * sign-off and stamps their identity.
 *
 * [TODO: real reviewing clinician + IMC] — source `clinician` from the record
 * once the medical-ops partner + clinician portal are live (MOCKED_APIS §5/§15).
 */
export function composeClinicianNote(params: {
  /** Marker count on the panel. */
  totalMarkers: number;
  /** Display names of markers outside the member's own band / worsened. */
  watchMarkerNames: string[];
  readAt: Date;
  /**
   * The registered reviewing clinician, when one has ACTUALLY signed the panel.
   * Absent/null ⇒ automated wellness-summary framing (no human review claimed,
   * no name/IMC stamped). Never pass the DEMO persona for real member data.
   */
  clinician?: { name: string; imcNumber: string } | null;
}): ClinicianNote {
  const { totalMarkers, watchMarkerNames, readAt, clinician } = params;
  const reviewed = Boolean(clinician?.name && clinician?.imcNumber);
  const markers = `${totalMarkers} marker${totalMarkers === 1 ? "" : "s"}`;

  // Provenance — honest about who (if anyone) has actually reviewed the panel.
  const provenance = reviewed
    ? `A registered clinician has read this panel.`
    : `This is an automated wellness summary generated by Arcaevo — it has not ` +
      `been reviewed by a clinician. On Arcaevo's blood-testing tiers, a ` +
      `registered clinician reviews your results once one is onboarded.`;

  let body: string;
  if (watchMarkerNames.length === 0) {
    body =
      `All ${markers} sit within your personal range. ` +
      `Nothing here needs a follow-up conversation; keep doing what you're doing, ` +
      `and your next test will confirm the trend.`;
  } else {
    const inRange = totalMarkers - watchMarkerNames.length;
    const verb = watchMarkerNames.length === 1 ? "is" : "are";
    body =
      `${inRange} of ${totalMarkers} markers sit within your personal range; ` +
      `${listNames(watchMarkerNames)} ${verb} worth watching — nothing urgent, ` +
      `just where a second look would help. A €${ADDON_PRICE_EUR.recheck} recheck ` +
      `in 8–12 weeks will show whether the change is real.`;
  }

  const text =
    `${provenance} ${body} ` +
    `This is a wellness summary, not a diagnosis — talk to your GP about anything that worries you.`;

  return {
    text,
    // Empty when no registered clinician has signed — never a fabricated name/IMC.
    clinicianName: clinician?.name ?? "",
    imcNumber: clinician?.imcNumber ?? "",
    readAt,
  };
}

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
  /**
   * Phase 22: set at clinician sign-off — one note per reviewed panel.
   * Optional so pre-Phase-22 documents remain valid (absent = not reviewed
   * yet; the results payload then carries `clinicianNote: null`).
   */
  clinicianNote: ClinicianNoteSchema.nullable().optional(),
  /**
   * Set by the LIVE Stripe webhook (checkout.session.completed, mode=payment)
   * when a paid add-on / recheck order settles. Null/absent for included
   * (€0) orders and for MOCK-vendor flows (dev/e2e), which don't round-trip a
   * real payment. Optional so pre-existing documents stay valid.
   */
  paidAt: z.date().nullable().optional(),
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
  /** Optional, from the pricing early-access form — pre-Task-7 rows have neither. */
  name: z.string().optional(),
  planInterest: z.enum(["essential", "performance", "either"]).optional(),
  /**
   * Additive launch-gate marker: true when the routing key was ELIGIBLE at
   * join time (Dublin allowlist) but sales were closed (BLOOD_TIERS_ENABLED
   * off), so the join is "waiting for sales to open" — NOT expansion demand.
   * Absent on genuine expansion-demand rows and every pre-existing row.
   */
  eligibleAtJoin: z.boolean().optional(),
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

/** Lifecycle of one attributed referral. */
export const ReferralStatus = z.enum(["pending", "credited", "rejected"]);
export type ReferralStatus = z.infer<typeof ReferralStatus>;

/**
 * One attributed referral — created at the REFERRED member's signup when they
 * arrive on a valid `?ref=<code>`. `_id` IS the referred member's userId, so
 * Mongo's unique `_id` index guarantees a referred member can credit a referrer
 * AT MOST ONCE (no repeat / loop). The reward ("give a month / get a month") is
 * applied ONCE, idempotently, when the referred member's membership becomes
 * genuinely PAID/active — the status then flips `pending` → `credited`. The
 * referrer never learns the referred member's identity (GDPR — counts only).
 */
export const ReferralSchema = z.object({
  _id: z.string(), // == referredUserId (one referral per referred member)
  referrerUserId: z.string(),
  referrerCode: z.string(),
  referredUserId: z.string(),
  status: ReferralStatus.default("pending"),
  createdAt: z.date(),
  /** Set when the reward is applied (status → credited). */
  creditedAt: z.date().nullable().default(null),
  /** Set when the referral is rejected instead of credited (anti-abuse). */
  rejectedReason: z.string().nullable().default(null),
});
export type Referral = z.infer<typeof ReferralSchema>;

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
 * the token is stored; the raw token exists only inside the emailed URL.
 *
 * Anti-prefetch code fallback (Phase 21): the same token doc ALSO carries a
 * short human-typeable code — `codeHash` = sha256Hex(normalizeCode(code)) —
 * immune to email virus-scanner link prefetching (a scanner never fills in a
 * code field). Using the code OR the link consumes the ONE token. `codeAttempts`
 * caps brute force at 5 tries, then the token is invalidated. Both fields are
 * optional so pre-Phase-21 rows / tests remain valid. */
export const MagicLinkTokenSchema = z.object({
  _id: z.string(), // e.g. "mlt_0001"
  tokenHash: z.string(),
  email: z.string(),
  purpose: MagicLinkPurpose,
  createdAt: z.date(),
  expiresAt: z.date(),
  usedAt: z.date().nullable().default(null),
  /** SHA-256 of the normalised human code (uppercase, alphabet chars only). */
  codeHash: z.string().optional(),
  /** Wrong-code attempt count; at 5 the token is burned. */
  codeAttempts: z.number().int().default(0),
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
  /** Lab/source name AI read off the document, e.g. "St. Vincent's". The REAL
   * OCR vendor does not transcribe this — the route falls back to the uploaded
   * fileName there. */
  sourceName: z.string(),
  /** "YYYY-MM-DD" as read from the document, or NULL when unknown. The mock
   * fabricates a date; the REAL OCR vendor does NOT transcribe one (out of
   * scope — the member sets the draw date at confirm), so it is null on the
   * real path. Nullable so the honest "unknown" persists. */
  documentDate: z.string().nullable().default(null),
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
// Admin accounts + access log (self-hosted per-admin auth — replaces the
// single shared ADMIN_PASSWORD; see docs/legal/ADMIN_AUTH_OPTIONS.md Option A,
// docs/MOCKED_APIS.md §3, docs/legal/DPIA.md R4).
// ---------------------------------------------------------------------------

/**
 * Admin roles (least privilege):
 *  - owner     — full access (the bootstrap ADMIN_PASSWORD maps to this).
 *  - ops       — members/support/eligibility/waitlist; NOT clinician sign-off.
 *  - clinician — result review + sign-off (writes the clinician note).
 */
export const AdminRole = z.enum(["owner", "ops", "clinician"]);
export type AdminRole = z.infer<typeof AdminRole>;

/**
 * A per-admin account. Password hashed with the SAME scrypt params as members
 * (see member-auth.ts hashPassword). `disabledAt` set ⇒ login refused
 * (offboarding a leaver without rotating a shared secret).
 */
/**
 * Sealed TOTP secret (AES-256-GCM, see src/lib/admin-mfa.ts). All three parts
 * are base64. The raw secret is NEVER stored — a DB dump yields only this
 * ciphertext, which is useless without the MFA_ENC_KEY-derived key.
 */
export const SealedSecretSchema = z.object({
  ciphertext: z.string(),
  iv: z.string(),
  tag: z.string(),
});
export type SealedSecret = z.infer<typeof SealedSecretSchema>;

/**
 * Per-admin TOTP MFA (OPT-IN — absent = password-only, the default). Carries
 * the sealed secret + single-use backup-code SHA-256 hashes. NEVER exposed by
 * publicAdmin() (which emits only `mfaEnabled: boolean`).
 */
export const AdminMfaSchema = z.object({
  enabledAt: z.date(),
  secretEnc: SealedSecretSchema,
  backupCodeHashes: z.array(z.string()),
});
export type AdminMfa = z.infer<typeof AdminMfaSchema>;

export const AdminSchema = z.object({
  _id: z.string(), // e.g. "adm_owner" (seed) or "adm_<uuid>" (runtime)
  email: z.string(), // lowercased
  passwordHash: z.string(), // scrypt:… (member-auth.ts format)
  role: AdminRole,
  name: z.string().optional(),
  createdAt: z.date(),
  /** While set, this account can no longer sign in. */
  disabledAt: z.date().nullable().default(null),
  /** OPT-IN TOTP two-factor (absent = password-only). See src/lib/admin-mfa.ts. */
  mfa: AdminMfaSchema.optional(),
});
export type Admin = z.infer<typeof AdminSchema>;

/**
 * Per-record admin access log (DPIA R4 / Art. 32 accountability). Records
 * WHO (adminId/email/role) did WHAT (action) to WHOSE record (targetMemberId)
 * and WHEN (at) — plus the source ip. Deliberately stores NO health values,
 * only the fact of access. Written fire-and-forget (never breaks a request).
 */
export const AdminAccessLogSchema = z.object({
  _id: z.string(), // e.g. "aal_<uuid>"
  at: z.date(),
  /** Dotted action key, e.g. "login", "results.queue.read", "member.detail.read". */
  action: z.string(),
  /** Null on a failed login (no authenticated admin yet). */
  adminId: z.string().nullable().default(null),
  /** Email tied to the event (login attempt / acting admin). */
  email: z.string().nullable().default(null),
  role: AdminRole.nullable().default(null),
  outcome: z.enum(["success", "failure"]).default("success"),
  /** The member whose Art.9 record was touched, when applicable. */
  targetMemberId: z.string().nullable().default(null),
  ip: z.string().nullable().default(null),
});
export type AdminAccessLog = z.infer<typeof AdminAccessLogSchema>;

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
  /** Optional — omitted/empty ⇒ password-only bootstrap OWNER login (keeps the
   * legacy single-password path + e2e working). Present ⇒ per-admin account. */
  email: z.string().optional(),
  password: z.string().min(1),
});

/**
 * Owner-only admin-management inputs (POST /api/v1/admin/admins …). The temp
 * password reuses the member 10-char minimum (member-auth scrypt). `email` is
 * lowercased by the route before use.
 */
export const AdminCreateInput = z.object({
  email: z.string().email(),
  role: AdminRole,
  name: z.string().min(1).max(120).optional(),
  password: z.string().min(10),
});
export type AdminCreateInput = z.infer<typeof AdminCreateInput>;

/** Change an admin's role (owner-only; last-owner guard enforced in the route). */
export const AdminRoleChangeInput = z.object({ role: AdminRole });
export type AdminRoleChangeInput = z.infer<typeof AdminRoleChangeInput>;

/**
 * Enrol MFA (an admin enables their OWN TOTP). `secret` is the base32 secret
 * issued by /mfa/setup and shown to the admin; `code` is the first valid TOTP
 * proving the authenticator is configured before we persist it.
 */
export const AdminMfaEnableInput = z.object({
  secret: z.string().min(1),
  code: z.string().min(1),
});
export type AdminMfaEnableInput = z.infer<typeof AdminMfaEnableInput>;

/** Disable MFA — a current TOTP or backup code (owners may omit; see route). */
export const AdminMfaDisableInput = z.object({
  code: z.string().optional(),
});
export type AdminMfaDisableInput = z.infer<typeof AdminMfaDisableInput>;

/** Second-factor step of admin login (TOTP or backup code). */
export const AdminLoginMfaInput = z.object({
  /** Optional — the acting admin is resolved from the mfa-pending cookie. */
  email: z.string().optional(),
  code: z.string().min(1),
});
export type AdminLoginMfaInput = z.infer<typeof AdminLoginMfaInput>;

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
  /**
   * Optional referral code carried from `/join?ref=<code>` (give-a-month /
   * get-a-month). Attributed to a NEW account only; unknown/expired codes are
   * ignored gracefully. Capped so a hostile client can't send a huge blob.
   */
  ref: z.string().max(64).optional(),
});
export type SignupInput = z.infer<typeof SignupInput>;

export const MagicLinkRequestInput = z.object({
  email: z.string().email(),
  purpose: z.enum(["signin", "verify"]).default("signin"),
});

/**
 * Redeem a magic link by EITHER the emailed token OR an email + human code
 * (the prefetch-safe fallback, Phase 21). The code path requires the email so
 * the short code is scoped + rate-limited to one account. Exactly one of the
 * two shapes must be present.
 */
export const MagicLinkVerifyInput = z
  .object({
    token: z.string().min(1).optional(),
    email: z.string().email().optional(),
    code: z.string().min(1).optional(),
  })
  .refine((v) => Boolean(v.token) || Boolean(v.email && v.code), {
    message: "Provide either a link token or an email and code.",
  });
export type MagicLinkVerifyInput = z.infer<typeof MagicLinkVerifyInput>;

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
  /** Optional early-access fields (pricing form) — old {email, eircode} shape unchanged. */
  name: z.string().trim().min(1).max(200).optional(),
  planInterest: z.enum(["essential", "performance", "either"]).optional(),
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
  /** Referral code, when a guest checks out straight from a `?ref=<code>` link
   * without first creating an account on /join. Attributed to the inline guest
   * account only; ignored for existing/signed-in members. */
  ref: z.string().max(64).optional(),
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

/**
 * MIME allowlist for real-OCR media bytes. Only still-image photos and PDFs of
 * a lab report are transcribable; everything else is rejected before the bytes
 * reach the vendor. (The mock/manual path never carries media.)
 */
export const BLOODWORK_MEDIA_MIME_ALLOWLIST = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;

/**
 * Max DECODED media size for a bloodwork upload: 3 MiB.
 *
 * WHY THIS EXACT CAP — the web app runs on Vercel serverless functions (see
 * CLAUDE.md), whose request BODY is capped at ~4.5 MB by the platform; a 413 is
 * returned by the platform BEFORE this handler runs, so we cannot catch it.
 * base64 inflates bytes by ~33% (4 chars per 3 bytes), so 3 MiB decoded encodes
 * to ~4.0 MB of base64 — the whole JSON body then stays comfortably under 4.5 MB
 * with headroom for the envelope. NOTE (App Router): unlike the legacy
 * `pages/api` `bodyParser.sizeLimit`, App-Router Route Handlers impose NO
 * Next-level body cap of their own, so the platform limit is the real ceiling.
 *
 * CROSS-TASK DEPENDENCY (Task 7, iOS): the client MUST downscale/recompress the
 * captured photo to fit UNDER this decoded cap while keeping the printed values
 * legible (a full-res phone photo blows the platform limit). Do NOT raise this
 * cap to allow huge uploads — compress client-side instead.
 */
export const MAX_BLOODWORK_MEDIA_DECODED_BYTES = 3 * 1024 * 1024;

/** Standard (non-URL) base64 alphabet with optional `=` padding. */
const STANDARD_BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Decoded byte length of a WELL-FORMED base64 string, without allocating it. */
function base64DecodedByteLength(b64: string): number {
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return (b64.length / 4) * 3 - padding;
}

/**
 * Optional real-OCR media: the image/PDF bytes as a MIME type + base64. This is
 * GDPR Art.9 health data — the route hands it straight to the vendor and NEVER
 * persists or logs it (see uploads/bloodwork/route.ts).
 *
 * SHAPE-ONLY BY DESIGN: this schema validates only the basic { mime, base64 }
 * shape so the request BODY always PARSES. The mime allowlist / decoded-size cap
 * / base64 well-formedness are POLICY checks that live in `isAcceptableMedia`
 * and are enforced in the route — a media policy failure degrades to honest
 * manual entry (200), NEVER a raw 400 (fail-safe UX, consistent with every other
 * OCR failure: a member with a too-large photo is routed to "type by hand").
 */
export const BloodworkMediaInput = z.object({
  mime: z.string(),
  base64: z.string(),
});
export type BloodworkMediaInput = z.infer<typeof BloodworkMediaInput>;

/**
 * Real-OCR media POLICY check (PURE — mime allowlist + well-formed standard
 * base64 + decoded-size cap ≤ MAX_BLOODWORK_MEDIA_DECODED_BYTES). Lives here
 * beside the constants it enforces and is reused by the upload route: media that
 * fails is NOT a 400 — the route degrades to honest manual entry. Never logs or
 * decodes the bytes (Art.9); the size check is byte-length arithmetic only.
 */
export function isAcceptableMedia(media: BloodworkMediaInput): boolean {
  if (!(BLOODWORK_MEDIA_MIME_ALLOWLIST as readonly string[]).includes(media.mime)) {
    return false;
  }
  const b64 = media.base64;
  if (b64.length === 0 || b64.length % 4 !== 0 || !STANDARD_BASE64.test(b64)) {
    return false;
  }
  return base64DecodedByteLength(b64) <= MAX_BLOODWORK_MEDIA_DECODED_BYTES;
}

export const BloodworkUploadInput = z.object({
  kind: z.enum(["photo", "pdf", "manual"]),
  fileName: z.string().optional(),
  /** For kind "manual": the user-typed values (skip AI extraction). Capped so
   * a single upload can't fabricate an unbounded marker set. */
  manualValues: z
    .array(z.object({ code: z.string(), value: z.number(), unit: z.string() }))
    .max(100)
    .optional(),
  /** OPTIONAL real-OCR bytes (photo/pdf). Present ⇒ the route calls the real
   * vendor when creds are configured; absent ⇒ the mock/manual path. NEVER
   * persisted or logged (Art.9). */
  media: BloodworkMediaInput.optional(),
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
