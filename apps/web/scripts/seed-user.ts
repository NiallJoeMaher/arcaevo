/**
 * Personal seed account — `npm run seed:user` (tsx scripts/seed-user.ts).
 *
 * Creates (or refreshes) ONE real, sign-in-able account with a full data
 * story, without touching anything else in the database. Unlike the main
 * seed (`npm run seed`, which WIPES every collection first), this script
 * only ever deletes/rewrites documents belonging to the given email — safe
 * to run against an already-seeded or in-use database.
 *
 * NOTE: the main seed's wipe removes accounts created here — rerun
 * `npm run seed:user` after every `npm run seed`.
 *
 * Args via env or `KEY=VALUE` argv:
 *   EMAIL     (required)  e.g. EMAIL=niall@codu.co
 *   NAME      display name             (default: derived from the email)
 *   PASSWORD  password for /signin     (default: arcaevo-demo-2026)
 *   TIER      fusion|essential|performance  (default: performance)
 *   WITH_DATA 1|0 — full data story    (default: 1)
 *
 * Usage:
 *   EMAIL=niall@codu.co NAME="Niall Maher" TIER=performance npm run seed:user
 *   npm run seed:user -- EMAIL=niall@codu.co NAME="Niall Maher"
 *
 * WITH_DATA=1 creates: verified user (real random-salt scrypt hash), active
 * membership, all three consents granted (research ON — it's your own
 * account), 2 lab draws (baseline + recheck, verdicts computed by lib/rcv)
 * plus one older self-reported "hollow gold" draw (~40 readings), 90 days of
 * Apple Health wearables, orders incl. results_ready, an active GP share
 * link, and a referral code derived from the name.
 *
 * Biomarker rules are NOT seeded here — they come from the main seed; the
 * script exits with a hint if they're missing.
 */
import { closeClient, collections, type LgcMockOrder } from "../src/lib/db";
import { hashPassword } from "../src/lib/member-auth";
import {
  CONSENT_VERSION,
  TIER_PRICE_EUR,
  MembershipTier,
  composeClinicianNote,
  isWatchMarker,
  type BiomarkerReading,
  type BiomarkerRule,
  type Consent,
  type Membership,
  type ReferralCode,
  type ShareLink,
  type TestOrder,
  type User,
  type WearableSignal,
} from "../src/lib/models";
import { computeBaselineBand, computeRcvVerdict } from "../src/lib/rcv";

// --- args --------------------------------------------------------------------

function readArgs(): Record<string, string> {
  const fromArgv = Object.fromEntries(
    process.argv
      .slice(2)
      .filter((a) => a.includes("="))
      .map((a) => {
        const i = a.indexOf("=");
        return [a.slice(0, i), a.slice(i + 1)];
      })
  );
  return { ...process.env, ...fromArgv } as Record<string, string>;
}

const args = readArgs();
const EMAIL = (args.EMAIL ?? "").trim().toLowerCase();
const NAME =
  (args.NAME ?? "").trim() ||
  EMAIL.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const PASSWORD = args.PASSWORD || "arcaevo-demo-2026";
const TIER = MembershipTier.parse(args.TIER || "performance");
const WITH_DATA = (args.WITH_DATA ?? "1") !== "0";

if (!EMAIL || !EMAIL.includes("@")) {
  console.error(
    "EMAIL is required, e.g.  EMAIL=you@example.com npm run seed:user"
  );
  process.exit(1);
}

// --- deterministic-per-email helpers ------------------------------------------

/** URL/id-safe slug from the email, e.g. niall@codu.co → "niall-codu-co". */
const SLUG = EMAIL.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** fnv1a — tiny stable hash for suffixes/PRNG seeding (per-email, not random). */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(fnv1a(EMAIL));

const NOW = new Date();
function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
}
function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// --- the data story -------------------------------------------------------------
// Baseline (5½ months ago) → consistent training + tighter diet → recheck
// (5 weeks ago): ApoB / LDL-C / fasting glucose / hs-CRP improved beyond RCV,
// everything else within the personal baseline band. Verdicts are COMPUTED
// by lib/rcv.ts, never hand-asserted.

const BASELINE: Record<string, number> = {
  apob: 1.21, ldl_c: 3.8, hdl_c: 1.15, triglycerides: 1.9, hba1c: 40,
  fasting_glucose: 5.8, hs_crp: 2.8, ferritin: 96, vitamin_d: 52, tsh: 2.0,
  alt: 31, creatinine: 84, testosterone: 16.5, cortisol: 360, omega3_index: 4.9,
};
const RECHECK: Record<string, number> = {
  apob: 0.98,           // −19% > 10% RCV → improved
  ldl_c: 3.0,           // −21% > 17% → improved
  hdl_c: 1.22,          // +6% < 12% → no_real_change
  triglycerides: 1.5,   // −21% < 40% → no_real_change
  hba1c: 38,            // −5% < 6% → no_real_change
  fasting_glucose: 4.9, // −15.5% > 11% → improved
  hs_crp: 0.3,          // −89% > 85% → improved
  ferritin: 104,        // +8% < 30% → no_real_change
  vitamin_d: 61,        // +17% < 25% → no_real_change
  tsh: 1.8,             // −10% < 20% → no_real_change
  alt: 27,              // −13% < 25% → no_real_change
  creatinine: 82,       // −2% < 9% → no_real_change
  testosterone: 17.8,   // +8% < 20% → no_real_change
  cortisol: 310,        // −14% < 45% → no_real_change
  omega3_index: 5.4,    // +10% < 15% → no_real_change
};
/** The self-reported "hollow gold" draw — an old GP PDF, uploaded (§13 U3). */
const SELF_REPORTED: Record<string, number> = {
  apob: 1.28, ldl_c: 3.9, hdl_c: 1.1, triglycerides: 2.0, hba1c: 41,
  fasting_glucose: 5.9, hs_crp: 3.1, ferritin: 90, vitamin_d: 44, tsh: 2.1,
};

// --- main --------------------------------------------------------------------

async function seedUser() {
  console.log(`Seeding personal account for ${EMAIL} (${NAME}, ${TIER})…`);

  const cols = {
    users: await collections.users(),
    memberships: await collections.memberships(),
    orders: await collections.testOrders(),
    readings: await collections.biomarkerReadings(),
    rules: await collections.biomarkerRules(),
    wearables: await collections.wearableSignals(),
    consents: await collections.consents(),
    shareLinks: await collections.shareLinks(),
    referralCodes: await collections.referralCodes(),
    lgc: await collections.lgcMockOrders(),
  };

  const rules = await cols.rules.find({}).toArray();
  const ruleByCode = new Map<string, BiomarkerRule>(rules.map((r) => [r.code, r]));
  if (WITH_DATA && rules.length === 0) {
    console.error(
      "No biomarker rules found — run the main seed first (`npm run seed`), then rerun seed:user."
    );
    process.exit(1);
  }

  // User: keep the existing _id when the email is already registered ----------
  const existing = await cols.users.findOne({ email: EMAIL });
  const userId = existing?._id ?? `mem_u_${SLUG}`;
  const user: User = {
    _id: userId,
    name: NAME,
    email: EMAIL,
    joinedAt: existing?.joinedAt ?? daysAgo(200),
    isDemo: false,
    flag: "active",
    passwordHash: await hashPassword(PASSWORD), // real random-salt scrypt
    emailVerified: true,
    failedAttempts: 0,
    cooloffUntil: null,
  };
  await cols.users.replaceOne({ _id: userId }, user, { upsert: true });

  // Refresh = delete ONLY this user's documents, then re-insert ---------------
  await Promise.all([
    cols.memberships.deleteMany({ memberId: userId }),
    cols.orders.deleteMany({ memberId: userId }),
    cols.readings.deleteMany({ memberId: userId }),
    cols.wearables.deleteMany({ memberId: userId }),
    cols.consents.deleteMany({ userId }),
    cols.shareLinks.deleteMany({ userId }),
    cols.referralCodes.deleteMany({ userId }),
    cols.lgc.deleteMany({ memberId: userId }),
  ]);

  // Active membership -----------------------------------------------------------
  const termStart = daysAgo(200);
  const renewalDate = new Date(termStart);
  renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  const membership: Membership = {
    _id: `sub_u_${SLUG}`,
    memberId: userId,
    tier: TIER,
    term: "annual",
    termStart,
    renewalDate,
    cadenceUpgrade: false,
    status: "active",
    priceEur: TIER_PRICE_EUR[TIER],
    stripeSubscriptionId: `sub_mock_u_${SLUG}`,
    dunningStage: "none",
    dunningStartedAt: null,
  };
  await cols.memberships.insertOne(membership);

  // Consents — ALL granted, research included (it's your own account) ----------
  const consents: Consent[] = (
    ["health_processing", "clinician_review", "research"] as const
  ).map((purpose, i) => ({
    _id: `consent_u_${SLUG}_${i + 1}`,
    userId,
    purpose,
    granted: true,
    version: CONSENT_VERSION,
    timestamp: daysAgo(200),
    surface: "web",
  }));
  await cols.consents.insertMany(consents);

  // Referral code from the name (give a month / get a month, §16) --------------
  const suffix = (fnv1a(EMAIL).toString(36) + "xx").slice(0, 2).toUpperCase();
  const referral: ReferralCode = {
    _id: `${NAME.split(" ")[0].toUpperCase().replace(/[^A-Z]/g, "") || "MEMBER"}-${suffix}`,
    userId,
    joinedCount: 1,
    freeMonthsApplied: 1,
    createdAt: daysAgo(180),
  };
  await cols.referralCodes.insertOne(referral);

  if (!WITH_DATA) {
    console.log("  WITH_DATA=0 — skipped orders/readings/wearables/share link.");
    console.log(`Done. Sign in at /signin with ${EMAIL} / "${PASSWORD}".`);
    return;
  }

  // Orders (incl. results_ready) + mocked-LGC state -----------------------------
  const isPerformance = TIER === "performance";
  const orders: TestOrder[] = [];
  const lgcDocs: LgcMockOrder[] = [];
  function addOrder(params: {
    seq: number;
    type: "kit" | "venous";
    panel: "full" | "recheck" | "venous80";
    status: TestOrder["status"];
    createdDaysAgo: number;
  }): TestOrder {
    const id = `ord_u_${SLUG}_${params.seq}`;
    const vendorOrderId = `lgc_u_${SLUG}_${params.seq}`;
    const statusIndex = [
      "ordered", "shipped", "delivered", "sample_registered", "in_lab", "results_ready",
    ].indexOf(params.status);
    const created = daysAgo(params.createdDaysAgo);
    const order: TestOrder = {
      _id: id,
      memberId: userId,
      type: params.type,
      panel: params.panel,
      status: params.status,
      bookingStatus: params.type === "venous" ? "draw_completed" : null,
      vendorOrderId,
      priceEur: 0,
      includedInPlan: true,
      createdAt: created,
      updatedAt: daysAgo(Math.max(params.createdDaysAgo - statusIndex * 2, 0)),
    };
    orders.push(order);
    lgcDocs.push({
      _id: vendorOrderId,
      memberId: userId,
      panel: params.panel,
      statusIndex,
      createdAt: created,
    });
    return order;
  }
  // Baseline draw → results_ready (venous for Performance, kit otherwise).
  const baselineOrder = addOrder({
    seq: 1,
    type: isPerformance ? "venous" : "kit",
    panel: isPerformance ? "venous80" : "full",
    status: "results_ready",
    createdDaysAgo: 170,
  });
  // Recheck draw → results_ready.
  const recheckOrder = addOrder({
    seq: 2, type: "kit", panel: "recheck",
    status: "results_ready", createdDaysAgo: 42,
  });
  // …and the next recheck kit currently in the post.
  addOrder({
    seq: 3, type: "kit", panel: "recheck",
    status: "shipped", createdDaysAgo: 3,
  });
  await cols.orders.insertMany(orders);
  await cols.lgc.insertMany(lgcDocs);

  // Readings: self-reported hollow-gold draw + 2 lab draws (~40 total) ----------
  const readings: BiomarkerReading[] = [];
  let readingSeq = 0;
  function addReading(params: {
    orderId: string | null;
    code: string;
    value: number;
    takenAt: Date;
    priorValues: number[]; // chronological values BEFORE this one
    source: "lab" | "self_reported";
  }): void {
    const rule = ruleByCode.get(params.code);
    if (!rule) return; // marker not in this database's rule set
    readingSeq += 1;
    const series = [...params.priorValues, params.value];
    const prior = params.priorValues.at(-1);
    readings.push({
      _id: `read_u_${SLUG}_${String(readingSeq).padStart(3, "0")}`,
      memberId: userId,
      orderId: params.orderId,
      code: params.code,
      value: params.value,
      unit: rule.unit,
      takenAt: params.takenAt,
      baselineBand: computeBaselineBand(series, rule.rcvPercent),
      rcvVerdict:
        prior === undefined ? null : computeRcvVerdict(prior, params.value, rule),
      clinicianReviewed: params.source === "lab",
      source: params.source,
    });
  }
  // 1) Self-reported draw — an old GP PDF (hollow gold dots, never reviewed).
  for (const [code, value] of Object.entries(SELF_REPORTED)) {
    addReading({
      orderId: null, code, value, takenAt: daysAgo(320),
      priorValues: [], source: "self_reported",
    });
  }
  // 2) Baseline lab draw — chains off the self-reported values where present.
  for (const [code, value] of Object.entries(BASELINE)) {
    addReading({
      orderId: baselineOrder._id, code, value, takenAt: daysAgo(163),
      priorValues: SELF_REPORTED[code] !== undefined ? [SELF_REPORTED[code]] : [],
      source: "lab",
    });
  }
  // 3) Recheck lab draw — verdicts vs the baseline ("did it work?" → yes).
  for (const [code, value] of Object.entries(RECHECK)) {
    addReading({
      orderId: recheckOrder._id, code, value, takenAt: daysAgo(36),
      priorValues:
        SELF_REPORTED[code] !== undefined
          ? [SELF_REPORTED[code], BASELINE[code]]
          : [BASELINE[code]],
      source: "lab",
    });
  }
  await cols.readings.insertMany(readings);

  // Clinician notes (Phase 22): every fully-reviewed panel carries a short,
  // wellness-framed note from the MOCK reviewer persona (Dr. S. Nolan,
  // IMC 412887 — docs/MOCKED_APIS.md §15), read the day after results landed.
  let clinicianNoteCount = 0;
  for (const order of orders) {
    const panel = readings.filter((r) => r.orderId === order._id);
    if (panel.length === 0 || !panel.every((r) => r.clinicianReviewed)) continue;
    const watchMarkerNames = panel
      .filter((r) => {
        const rule = ruleByCode.get(r.code);
        return rule ? isWatchMarker(r, rule.direction) : false;
      })
      .map((r) => ruleByCode.get(r.code)?.name ?? r.code);
    const note = composeClinicianNote({
      totalMarkers: panel.length,
      watchMarkerNames,
      readAt: new Date(order.updatedAt.getTime() + 24 * 60 * 60 * 1000),
    });
    await cols.orders.updateOne(
      { _id: order._id },
      { $set: { clinicianNote: note } }
    );
    clinicianNoteCount += 1;
  }

  // Wearables: 90 days of Apple Health, trends mirroring the story ---------------
  const wearables: WearableSignal[] = [];
  for (let d = 89; d >= 0; d--) {
    const date = isoDay(daysAgo(d));
    const progress = (89 - d) / 89; // 0 → 1 across the window
    const noise = () => (rand() - 0.5) * 2;
    const rows: [WearableSignal["type"], number][] = [
      ["hrv", round1(44 + 11 * progress + noise() * 3)],        // 44 → ~55 ms
      ["rhr", round1(63 - 6 * progress + noise() * 1.2)],       // 63 → ~57 bpm
      ["sleep", round1(6.9 + 0.5 * progress + noise() * 0.4)],  // ~6.9 → 7.4 h
      ["vo2max", round1(40.8 + 2.5 * progress + noise() * 0.2)],// 40.8 → ~43.3
    ];
    for (const [type, value] of rows) {
      wearables.push({
        _id: `${userId}:${type}:${date}`,
        memberId: userId,
        source: "apple_health",
        type,
        value,
        date,
      });
    }
  }
  await cols.wearables.insertMany(wearables);

  // Active GP share link (30-day life, stable token per email) ------------------
  const share: ShareLink = {
    _id: `share_u_${SLUG}`,
    token: `gp-${SLUG}`,
    userId,
    createdAt: daysAgo(2),
    expiresAt: daysAgo(-28),
    revoked: false,
    accessLog: [{ at: daysAgo(1), location: "Dublin" }],
  };
  await cols.shareLinks.insertOne(share);

  // Summary -----------------------------------------------------------------
  console.log(`  user:        ${userId} · ${NAME} · ${EMAIL} (verified, password set)`);
  console.log(`  membership:  ${membership._id} · ${TIER} · ACTIVE · €${membership.priceEur}/yr`);
  console.log(`  consents:    3 granted (research ON) · version ${CONSENT_VERSION}`);
  console.log(`  orders:      ${orders.length} (results_ready ×2 + shipped recheck)`);
  console.log(`  readings:    ${readings.length} (${Object.keys(SELF_REPORTED).length} self-reported hollow-gold + 2 lab draws)`);
  console.log(`  notes:       ${clinicianNoteCount} reviewed panels signed by Dr. S. Nolan, IMC 412887 (MOCK persona)`);
  console.log(`  wearables:   ${wearables.length} (90 days × 4 types)`);
  console.log(`  share link:  /s/${share.token} (active, 1 open logged)`);
  console.log(`  referral:    ${referral._id}`);
  console.log(`Done. Sign in at /signin with ${EMAIL} / "${PASSWORD}".`);
}

seedUser()
  .catch((err) => {
    console.error("seed:user failed:", err);
    process.exitCode = 1;
  })
  .finally(() => closeClient());
