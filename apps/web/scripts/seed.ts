/**
 * Arcaevo seed script — `npm run seed` (tsx scripts/seed.ts).
 *
 * Fully deterministic: fixed anchor date (2026-07-01) + seeded PRNG
 * (mulberry32) — re-running always produces the same database.
 *
 * Seeds: 15 biomarker rules, 25 members across tiers (incl. THE demo member
 * that "demo-member-token" maps to), memberships, orders in every pipeline
 * state, readings with baseline bands + RCV verdicts, 90 days of Apple Health
 * wearable signals for the demo member, support tickets, outbox emails, and
 * one complete "did it work?" story (baseline → change → recheck → improved).
 */
import { closeClient, collections, type LgcMockOrder } from "../src/lib/db";
import {
  TIER_PRICE_EUR,
  ADDON_PRICE_EUR,
  type BiomarkerReading,
  type BiomarkerRule,
  type Membership,
  type MembershipTier,
  type OutboxEmail,
  type SupportTicket,
  type TestOrder,
  type TestOrderStatus,
  type User,
  type WearableSignal,
} from "../src/lib/models";
import { computeBaselineBand, computeRcvVerdict } from "../src/lib/rcv";

// --- determinism helpers ----------------------------------------------------

const ANCHOR = new Date("2026-07-01T09:00:00.000Z"); // fixed "now" for seeding

function daysAgo(n: number): Date {
  return new Date(ANCHOR.getTime() - n * 24 * 60 * 60 * 1000);
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
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
const rand = mulberry32(42); // single seeded stream, consumed in fixed order

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// --- biomarker rules (plausible units + RCV%) --------------------------------

const RULE_DEFS: Omit<BiomarkerRule, "_id">[] = [
  { code: "apob", name: "ApoB", unit: "g/L", rcvPercent: 10, direction: "lower_is_better" },
  { code: "ldl_c", name: "LDL-C", unit: "mmol/L", rcvPercent: 17, direction: "lower_is_better" },
  { code: "hdl_c", name: "HDL-C", unit: "mmol/L", rcvPercent: 12, direction: "higher_is_better" },
  { code: "triglycerides", name: "Triglycerides", unit: "mmol/L", rcvPercent: 40, direction: "lower_is_better" },
  { code: "hba1c", name: "HbA1c", unit: "mmol/mol", rcvPercent: 6, direction: "lower_is_better" },
  { code: "fasting_glucose", name: "Fasting glucose", unit: "mmol/L", rcvPercent: 11, direction: "lower_is_better" },
  { code: "hs_crp", name: "hs-CRP", unit: "mg/L", rcvPercent: 85, direction: "lower_is_better" },
  { code: "ferritin", name: "Ferritin", unit: "µg/L", rcvPercent: 30, direction: "higher_is_better" },
  { code: "vitamin_d", name: "Vitamin D (25-OH)", unit: "nmol/L", rcvPercent: 25, direction: "higher_is_better" },
  { code: "tsh", name: "TSH", unit: "mIU/L", rcvPercent: 20, direction: "lower_is_better" },
  { code: "alt", name: "ALT", unit: "U/L", rcvPercent: 25, direction: "lower_is_better" },
  { code: "creatinine", name: "Creatinine (eGFR basis)", unit: "µmol/L", rcvPercent: 9, direction: "lower_is_better" },
  { code: "testosterone", name: "Testosterone (total)", unit: "nmol/L", rcvPercent: 20, direction: "higher_is_better" },
  { code: "cortisol", name: "Cortisol (morning)", unit: "nmol/L", rcvPercent: 45, direction: "lower_is_better" },
  { code: "omega3_index", name: "Omega-3 Index", unit: "%", rcvPercent: 15, direction: "higher_is_better" },
];
const RULES: BiomarkerRule[] = RULE_DEFS.map((r) => ({ _id: r.code, ...r }));

const ruleByCode = new Map(RULES.map((r) => [r.code, r]));

// Typical value per marker (used for non-demo members' single panels).
const TYPICAL: Record<string, number> = {
  apob: 0.95, ldl_c: 3.1, hdl_c: 1.3, triglycerides: 1.4, hba1c: 36,
  fasting_glucose: 5.1, hs_crp: 1.2, ferritin: 110, vitamin_d: 62, tsh: 1.8,
  alt: 24, creatinine: 82, testosterone: 18, cortisol: 320, omega3_index: 5.8,
};

// --- members ----------------------------------------------------------------

// Demo member first (mem_0001). Names echo the Admin design's roster style.
const MEMBER_SPECS: { name: string; tier: MembershipTier; flag: User["flag"] }[] = [
  { name: "Aoife Byrne", tier: "essential", flag: "active" }, // DEMO
  { name: "Cian Murphy", tier: "essential", flag: "active" },
  { name: "Saoirse Walsh", tier: "performance", flag: "active" },
  { name: "Liam O'Connor", tier: "fusion", flag: "new" },
  { name: "Niamh Kelly", tier: "essential", flag: "churn_risk" },
  { name: "Eoin Doyle", tier: "performance", flag: "active" },
  { name: "Roisin McCarthy", tier: "essential", flag: "active" },
  { name: "Sean Gallagher", tier: "essential", flag: "active" },
  { name: "Aisling Brennan", tier: "performance", flag: "active" },
  { name: "Darragh Nolan", tier: "fusion", flag: "active" },
  { name: "Clodagh Hughes", tier: "essential", flag: "active" },
  { name: "Oisin Kavanagh", tier: "essential", flag: "new" },
  { name: "Grainne Duffy", tier: "performance", flag: "active" },
  { name: "Padraig Whelan", tier: "essential", flag: "active" },
  { name: "Sinead Maguire", tier: "essential", flag: "active" },
  { name: "Tadhg Brady", tier: "fusion", flag: "active" },
  { name: "Orla Fitzgerald", tier: "essential", flag: "active" },
  { name: "Cathal Keane", tier: "performance", flag: "active" },
  { name: "Maeve Redmond", tier: "essential", flag: "churn_risk" },
  { name: "Fionn Barry", tier: "essential", flag: "active" },
  { name: "Emer Clancy", tier: "performance", flag: "active" },
  { name: "Ruairi Dempsey", tier: "fusion", flag: "new" },
  { name: "Blaithin Curran", tier: "essential", flag: "active" },
  { name: "Colm Sheridan", tier: "essential", flag: "active" },
  { name: "Una Molloy", tier: "performance", flag: "active" },
];

function emailFor(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z ]/g, "").replace(/ /g, ".")}@example.ie`;
}

// --- main --------------------------------------------------------------------

async function seed() {
  console.log(`Seeding arcaevo (anchor date ${ANCHOR.toISOString()})…`);

  const cols = {
    users: await collections.users(),
    memberships: await collections.memberships(),
    orders: await collections.testOrders(),
    readings: await collections.biomarkerReadings(),
    rules: await collections.biomarkerRules(),
    wearables: await collections.wearableSignals(),
    tickets: await collections.supportTickets(),
    outbox: await collections.outbox(),
    lgc: await collections.lgcMockOrders(),
  };
  await Promise.all(Object.values(cols).map((c) => c.deleteMany({})));

  // Rules -------------------------------------------------------------------
  await cols.rules.insertMany(RULES);

  // Users + memberships -------------------------------------------------------
  const users: User[] = MEMBER_SPECS.map((spec, i) => ({
    _id: `mem_${String(i + 1).padStart(4, "0")}`,
    name: spec.name,
    email: emailFor(spec.name),
    joinedAt: daysAgo(400 - i * 14), // deterministic spread over ~13 months
    isDemo: i === 0,
    flag: spec.flag,
  }));
  await cols.users.insertMany(users);

  const memberships: Membership[] = users.map((u, i) => {
    const tier = MEMBER_SPECS[i].tier;
    const termStart = u.joinedAt;
    const renewalDate = new Date(termStart);
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    // Terms older than a year have renewed once already.
    if (renewalDate < ANCHOR) renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    return {
      _id: `sub_${String(i + 1).padStart(4, "0")}`,
      memberId: u._id,
      tier,
      term: "annual" as const,
      termStart,
      renewalDate,
      cadenceUpgrade: i === 0 || i === 8, // demo member is on quarterly cadence
      status: MEMBER_SPECS[i].flag === "churn_risk" ? ("past_due" as const) : ("active" as const),
      priceEur: TIER_PRICE_EUR[tier],
      stripeSubscriptionId: `sub_mock_seed_${String(i + 1).padStart(4, "0")}`,
    };
  });
  await cols.memberships.insertMany(memberships);

  // Orders + LGC mock state ----------------------------------------------------
  const orders: TestOrder[] = [];
  const lgcDocs: LgcMockOrder[] = [];
  let orderSeq = 0;

  function addOrder(params: {
    memberId: string;
    type: "kit" | "venous";
    panel: "full" | "recheck" | "venous80";
    status: TestOrderStatus;
    bookingStatus?: "unbooked" | "nurse_booked" | "draw_completed";
    included: boolean;
    createdDaysAgo: number;
  }): TestOrder {
    orderSeq += 1;
    const id = `ord_${String(orderSeq).padStart(4, "0")}`;
    const vendorOrderId = `lgc_seed_${String(orderSeq).padStart(4, "0")}`;
    const statusIndex = [
      "ordered", "shipped", "delivered", "sample_registered", "in_lab", "results_ready",
    ].indexOf(params.status);
    const created = daysAgo(params.createdDaysAgo);
    const order: TestOrder = {
      _id: id,
      memberId: params.memberId,
      type: params.type,
      panel: params.panel,
      status: params.status,
      bookingStatus: params.type === "venous" ? params.bookingStatus ?? "unbooked" : null,
      vendorOrderId,
      priceEur: params.included ? 0 : ADDON_PRICE_EUR[params.panel],
      includedInPlan: params.included,
      createdAt: created,
      updatedAt: daysAgo(Math.max(params.createdDaysAgo - statusIndex * 2, 0)),
    };
    orders.push(order);
    lgcDocs.push({
      _id: vendorOrderId,
      memberId: params.memberId,
      panel: params.panel,
      statusIndex,
      createdAt: created,
    });
    return order;
  }

  // Demo member (mem_0001) — the "did it work?" story:
  //   Jan: baseline full panel → ApoB 1.15, hs-CRP 3.2, glucose 5.9 (rough).
  //   Feb–May: trains consistently (see wearables), tightens diet.
  //   May: recheck → ApoB, hs-CRP, fasting glucose IMPROVED beyond RCV;
  //        the rest within personal baseline band. Answer: it worked.
  const demoBaselineOrder = addOrder({
    memberId: "mem_0001", type: "kit", panel: "full",
    status: "results_ready", included: true, createdDaysAgo: 170,
  });
  const demoRecheckOrder = addOrder({
    memberId: "mem_0001", type: "kit", panel: "recheck",
    status: "results_ready", included: true, createdDaysAgo: 45,
  });
  // …and a quarterly-cadence recheck currently in flight.
  addOrder({
    memberId: "mem_0001", type: "kit", panel: "recheck",
    status: "shipped", included: true, createdDaysAgo: 3,
  });

  // Pipeline coverage across other members (every state represented).
  const pipeline: [string, "kit" | "venous", "full" | "recheck" | "venous80", TestOrderStatus, number][] = [
    ["mem_0002", "kit", "full", "ordered", 1],
    ["mem_0003", "venous", "venous80", "shipped", 4],
    ["mem_0006", "venous", "venous80", "delivered", 6],
    ["mem_0007", "kit", "full", "sample_registered", 8],
    ["mem_0008", "kit", "full", "in_lab", 9],
    ["mem_0009", "venous", "venous80", "in_lab", 10],
    ["mem_0011", "kit", "full", "results_ready", 30],
    ["mem_0013", "venous", "venous80", "results_ready", 40],
    ["mem_0014", "kit", "full", "results_ready", 55],
    ["mem_0005", "kit", "recheck", "ordered", 2],
  ];
  for (const [memberId, type, panel, status, age] of pipeline) {
    addOrder({
      memberId, type, panel, status, included: panel !== "recheck",
      bookingStatus:
        type === "venous"
          ? status === "shipped" ? "nurse_booked"
            : status === "ordered" ? "unbooked" : "draw_completed"
          : undefined,
      createdDaysAgo: age,
    });
  }
  await cols.orders.insertMany(orders);
  await cols.lgc.insertMany(lgcDocs);

  // Biomarker readings ---------------------------------------------------------
  const readings: BiomarkerReading[] = [];
  let readingSeq = 0;

  function addReading(params: {
    memberId: string;
    orderId: string | null;
    code: string;
    value: number;
    takenAt: Date;
    priorValues: number[]; // chronological values BEFORE this one
    clinicianReviewed: boolean;
  }): void {
    readingSeq += 1;
    const rule = ruleByCode.get(params.code)!;
    const series = [...params.priorValues, params.value];
    const prior = params.priorValues.at(-1);
    readings.push({
      _id: `read_${String(readingSeq).padStart(4, "0")}`,
      memberId: params.memberId,
      orderId: params.orderId,
      code: params.code,
      value: params.value,
      unit: rule.unit,
      takenAt: params.takenAt,
      baselineBand: computeBaselineBand(series, rule.rcvPercent),
      rcvVerdict:
        prior === undefined ? null : computeRcvVerdict(prior, params.value, rule),
      clinicianReviewed: params.clinicianReviewed,
    });
  }

  // Demo story values: [baseline (Jan), recheck (May)] — verdicts computed,
  // not hand-asserted, so they always match lib/rcv.ts.
  const demoBaseline: Record<string, number> = {
    apob: 1.15, ldl_c: 3.7, hdl_c: 1.1, triglycerides: 2.1, hba1c: 41,
    fasting_glucose: 5.9, hs_crp: 3.2, ferritin: 88, vitamin_d: 48, tsh: 2.2,
    alt: 34, creatinine: 86, testosterone: 15.5, cortisol: 380, omega3_index: 4.6,
  };
  const demoRecheck: Record<string, number> = {
    apob: 0.94,          // −18% > 10% RCV → improved
    ldl_c: 2.9,          // −22% > 17% → improved
    hdl_c: 1.18,         // +7% < 12% → no_real_change
    triglycerides: 1.6,  // −24% < 40% → no_real_change
    hba1c: 39,           // −4.9% < 6% → no_real_change
    fasting_glucose: 5.0, // −15% > 11% → improved
    hs_crp: 0.4,         // −87.5% > 85% → improved
  };
  const baselineTaken = daysAgo(160);
  const recheckTaken = daysAgo(38);
  for (const [code, value] of Object.entries(demoBaseline)) {
    addReading({
      memberId: "mem_0001", orderId: demoBaselineOrder._id, code, value,
      takenAt: baselineTaken, priorValues: [], clinicianReviewed: true,
    });
  }
  for (const [code, value] of Object.entries(demoRecheck)) {
    addReading({
      memberId: "mem_0001", orderId: demoRecheckOrder._id, code, value,
      takenAt: recheckTaken, priorValues: [demoBaseline[code]],
      clinicianReviewed: true,
    });
  }

  // Other members with results_ready orders get a full set of readings.
  // mem_0011 + mem_0013 are UNREVIEWED → they populate the admin review queue.
  const resultOrders = orders.filter(
    (o) => o.status === "results_ready" && o.memberId !== "mem_0001"
  );
  for (const order of resultOrders) {
    const reviewed = order.memberId === "mem_0014"; // others await review
    const codes = order.panel === "recheck" ? RULES.slice(0, 7) : RULES;
    for (const rule of codes) {
      const jitter = (rand() - 0.5) * 0.3; // ±15% around typical, seeded
      addReading({
        memberId: order.memberId,
        orderId: order._id,
        code: rule.code,
        value: round2(TYPICAL[rule.code] * (1 + jitter)),
        takenAt: new Date(order.updatedAt),
        priorValues: [],
        clinicianReviewed: reviewed,
      });
    }
  }
  await cols.readings.insertMany(readings);

  // Wearables: 90 days of Apple Health for the demo member -----------------------
  // Trends mirror the story: HRV up, RHR down, sleep steady, VO2max up.
  const wearables: WearableSignal[] = [];
  for (let d = 89; d >= 0; d--) {
    const date = isoDay(daysAgo(d));
    const progress = (89 - d) / 89; // 0 → 1 across the window
    const noise = () => (rand() - 0.5) * 2;
    const rows: [WearableSignal["type"], number][] = [
      ["hrv", round1(46 + 10 * progress + noise() * 3)],       // 46 → ~56 ms
      ["rhr", round1(62 - 5 * progress + noise() * 1.2)],      // 62 → ~57 bpm
      ["sleep", round1(7.1 + 0.3 * progress + noise() * 0.4)], // ~7.1 → 7.4 h
      ["vo2max", round1(41.5 + 2.2 * progress + noise() * 0.2)], // 41.5 → ~43.7
    ];
    for (const [type, value] of rows) {
      wearables.push({
        _id: `mem_0001:${type}:${date}`,
        memberId: "mem_0001",
        source: "apple_health",
        type,
        value,
        date,
      });
    }
  }
  await cols.wearables.insertMany(wearables);

  // Support tickets ---------------------------------------------------------
  const tickets: SupportTicket[] = [
    { memberId: "mem_0005", subject: "Kit not arrived", body: "My recheck kit hasn't arrived after 5 days — can you check the tracking?", status: "open", priority: "high", createdDaysAgo: 1 },
    { memberId: "mem_0003", subject: "Reschedule nurse visit", body: "Can I move my Dublin draw from Thursday to Saturday morning?", status: "open", priority: "normal", createdDaysAgo: 2 },
    { memberId: "mem_0019", subject: "Renewal question", body: "My card expired — how do I update payment before renewal?", status: "pending", priority: "normal", createdDaysAgo: 4 },
    { memberId: null, subject: "Press enquiry", body: "Journalist looking for comment on consumer blood testing in Ireland.", status: "pending", priority: "low", createdDaysAgo: 6 },
    { memberId: "mem_0001", subject: "Apple Watch sync gap", body: "Two days of HRV missing after my watchOS update — resynced now, please confirm you see it.", status: "closed", priority: "normal", createdDaysAgo: 12 },
    { memberId: "mem_0010", subject: "Upload old bloodwork", body: "I have PDFs from my GP from 2024 — what's the best way to get them in?", status: "closed", priority: "low", createdDaysAgo: 20 },
  ].map((t, i) => ({
    _id: `tick_${String(i + 1).padStart(4, "0")}`,
    memberId: t.memberId,
    subject: t.subject,
    body: t.body,
    status: t.status as SupportTicket["status"],
    priority: t.priority as SupportTicket["priority"],
    createdAt: daysAgo(t.createdDaysAgo),
    updatedAt: daysAgo(t.createdDaysAgo),
  }));
  await cols.tickets.insertMany(tickets);

  // Outbox (MOCK email trail for the demo story) -------------------------------
  const emails: OutboxEmail[] = [
    { template: "order_confirmation", subject: "Your Arcaevo test is on its way", to: users[0].email, body: `Order ${demoBaselineOrder._id}: full panel via finger-prick kit.`, createdDaysAgo: 170 },
    { template: "results_ready", subject: "Your Arcaevo results are ready", to: users[0].email, body: `Results for order ${demoBaselineOrder._id} are in and reviewed. Open the app to see your baseline.`, createdDaysAgo: 160 },
    { template: "results_ready", subject: "Your Arcaevo results are ready", to: users[0].email, body: `Results for order ${demoRecheckOrder._id} are in — three markers improved beyond your normal variation. It worked.`, createdDaysAgo: 38 },
    { template: "kit_reminder", subject: "Don't forget your recheck kit", to: users[0].email, body: "Your quarterly recheck kit shipped — post your sample Monday–Wednesday for fastest lab turnaround.", createdDaysAgo: 2 },
  ].map((e, i) => ({
    _id: `email_${String(i + 1).padStart(4, "0")}`,
    to: e.to,
    subject: e.subject,
    body: e.body,
    template: e.template,
    createdAt: daysAgo(e.createdDaysAgo),
  }));
  await cols.outbox.insertMany(emails);

  // Summary -------------------------------------------------------------------
  console.log(`  users:              ${users.length} (demo: mem_0001 · Aoife Byrne · token "demo-member-token")`);
  console.log(`  memberships:        ${memberships.length} (essential ${memberships.filter((m) => m.tier === "essential").length} · performance ${memberships.filter((m) => m.tier === "performance").length} · fusion ${memberships.filter((m) => m.tier === "fusion").length})`);
  console.log(`  biomarker rules:    ${RULES.length}`);
  console.log(`  test orders:        ${orders.length}`);
  console.log(`  readings:           ${readings.length} (${readings.filter((r) => !r.clinicianReviewed).length} awaiting clinician review)`);
  console.log(`  wearable signals:   ${wearables.length} (90 days × 4 types, demo member)`);
  console.log(`  support tickets:    ${tickets.length}`);
  console.log(`  outbox emails:      ${emails.length}`);
  console.log("Seed complete.");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => closeClient());
