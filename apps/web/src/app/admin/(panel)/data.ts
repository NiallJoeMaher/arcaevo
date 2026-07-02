/**
 * Server-side data loaders for the admin panel.
 *
 * Pages read Mongo directly via src/lib/db.ts (no HTTP round-trip to our own
 * API). Every loader returns `null` instead of throwing when the database is
 * unreachable, so pages render a connection notice rather than crash. A short
 * race timeout keeps the admin snappy when Mongo is down (the driver's own
 * server-selection timeout is 30s).
 */
import { collections } from "@/lib/db";
import { LAUNCH_ALLOWLIST } from "@/lib/eligibility";
import {
  CADENCE_UPGRADE_EUR,
  CONSENT_VERSION,
  type BiomarkerReading,
  type BiomarkerRule,
  type Consent,
  type ConsentPurpose,
  type EligibilityConfig,
  type MembershipTier,
  type SupportTicket,
  type TestOrder,
  type User,
  type WaitlistEntry,
} from "@/lib/models";

function withTimeout<T>(promise: Promise<T>, ms = 4000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      const t = setTimeout(
        () => reject(new Error("Timed out reaching MongoDB.")),
        ms
      );
      // Don't hold the process open just for this timer.
      if (typeof t === "object" && "unref" in t) t.unref();
    }),
  ]);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardData {
  activeMembers: number;
  mrrEquivalentEur: number;
  membersByTier: Record<MembershipTier, number>;
  testsThisMonth: number;
}

export async function loadDashboard(): Promise<DashboardData | null> {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [memberships, testsThisMonth] = await withTimeout(
      Promise.all([
        collections
          .memberships()
          .then((c) => c.find({ status: { $ne: "canceled" } }).toArray()),
        collections
          .testOrders()
          .then((c) => c.countDocuments({ createdAt: { $gte: startOfMonth } })),
      ])
    );

    const membersByTier: Record<MembershipTier, number> = {
      fusion: 0,
      essential: 0,
      performance: 0,
    };
    let annualRevenueEur = 0;
    for (const m of memberships) {
      membersByTier[m.tier] += 1;
      annualRevenueEur +=
        m.priceEur + (m.cadenceUpgrade ? CADENCE_UPGRADE_EUR : 0);
    }

    return {
      activeMembers: memberships.length,
      mrrEquivalentEur: Math.round((annualRevenueEur / 12) * 100) / 100,
      membersByTier,
      testsThisMonth,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export interface MemberRow {
  user: User;
  tier: MembershipTier | null;
  lastTest: Date | null;
}

export async function loadMembers(): Promise<MemberRow[] | null> {
  try {
    const [users, memberships, readings] = await withTimeout(
      Promise.all([
        collections.users().then((c) => c.find().sort({ _id: 1 }).toArray()),
        collections.memberships().then((c) => c.find().toArray()),
        collections
          .biomarkerReadings()
          .then((c) =>
            c
              .find({}, { projection: { memberId: 1, takenAt: 1 } })
              .toArray()
          ),
      ])
    );

    const tierByMember = new Map(memberships.map((m) => [m.memberId, m.tier]));
    const lastTestByMember = new Map<string, Date>();
    for (const r of readings) {
      const prev = lastTestByMember.get(r.memberId);
      if (!prev || r.takenAt > prev) lastTestByMember.set(r.memberId, r.takenAt);
    }

    return users.map((user) => ({
      user,
      tier: tierByMember.get(user._id) ?? null,
      lastTest: lastTestByMember.get(user._id) ?? null,
    }));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Results review queue
// ---------------------------------------------------------------------------

export interface ReviewGroup {
  /** Stable key — the order id (or member id for uploads without an order). */
  key: string;
  memberName: string;
  panelLabel: string;
  readings: BiomarkerReading[];
  /** Latest sample date in the group. */
  received: Date;
  ruleByCode: Map<string, BiomarkerRule>;
}

export interface ReviewQueueData {
  groups: ReviewGroup[];
  pendingReadings: number;
  reviewedReadings: number;
}

const PANEL_LABELS: Record<TestOrder["panel"], string> = {
  full: "Full panel",
  recheck: "Recheck",
  venous80: "Full venous",
};

export async function loadReviewQueue(): Promise<ReviewQueueData | null> {
  try {
    const [pending, reviewedReadings, users, rules, orders] = await withTimeout(
      Promise.all([
        collections
          .biomarkerReadings()
          .then((c) =>
            c.find({ clinicianReviewed: false }).sort({ takenAt: 1 }).toArray()
          ),
        collections
          .biomarkerReadings()
          .then((c) => c.countDocuments({ clinicianReviewed: true })),
        collections.users().then((c) => c.find().toArray()),
        collections.biomarkerRules().then((c) => c.find().toArray()),
        collections.testOrders().then((c) => c.find().toArray()),
      ])
    );

    const userById = new Map(users.map((u) => [u._id, u]));
    const orderById = new Map(orders.map((o) => [o._id, o]));
    const ruleByCode = new Map(rules.map((r) => [r.code, r]));

    const byKey = new Map<string, BiomarkerReading[]>();
    for (const r of pending) {
      const key = r.orderId ?? `upload:${r.memberId}`;
      const list = byKey.get(key);
      if (list) list.push(r);
      else byKey.set(key, [r]);
    }

    const groups: ReviewGroup[] = [...byKey.entries()].map(
      ([key, readings]) => {
        const order = readings[0].orderId
          ? orderById.get(readings[0].orderId)
          : undefined;
        return {
          key,
          memberName:
            userById.get(readings[0].memberId)?.name ?? readings[0].memberId,
          panelLabel: order ? PANEL_LABELS[order.panel] : "Uploaded results",
          readings,
          received: readings.reduce(
            (max, r) => (r.takenAt > max ? r.takenAt : max),
            readings[0].takenAt
          ),
          ruleByCode,
        };
      }
    );

    return { groups, pendingReadings: pending.length, reviewedReadings };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

export interface SupportData {
  tickets: SupportTicket[];
  openCount: number;
  userById: Map<string, User>;
  tierByMember: Map<string, MembershipTier>;
}

export async function loadSupport(): Promise<SupportData | null> {
  try {
    const [tickets, users, memberships] = await withTimeout(
      Promise.all([
        collections
          .supportTickets()
          .then((c) => c.find().sort({ createdAt: -1 }).toArray()),
        collections.users().then((c) => c.find().toArray()),
        collections.memberships().then((c) => c.find().toArray()),
      ])
    );

    // Same ordering as GET /api/v1/admin/support: open/pending first, newest.
    const rank = { open: 0, pending: 1, closed: 2 } as const;
    tickets.sort((a, b) => rank[a.status] - rank[b.status]);

    return {
      tickets,
      openCount: tickets.filter((t) => t.status !== "closed").length,
      userById: new Map(users.map((u) => [u._id, u])),
      tierByMember: new Map(memberships.map((m) => [m.memberId, m.tier])),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Waitlist demand by county (v2 — design_handoff_v2 §18 ADM-1)
// ---------------------------------------------------------------------------

export interface WaitlistCountyRow {
  county: string;
  count: number;
  /** Most-requested routing keys within the county (top 3, by signups). */
  topKeys: { key: string; count: number }[];
  oldest: Date;
}

export interface WaitlistDemandData {
  /** Sorted by signups, busiest county first. */
  counties: WaitlistCountyRow[];
  total: number;
}

export async function loadWaitlistDemand(): Promise<WaitlistDemandData | null> {
  try {
    const entries = await withTimeout(
      collections
        .waitlist()
        .then((c) => c.find().sort({ createdAt: 1 }).toArray())
    );

    const byCounty = new Map<string, WaitlistEntry[]>();
    for (const entry of entries) {
      const list = byCounty.get(entry.county);
      if (list) list.push(entry);
      else byCounty.set(entry.county, [entry]);
    }

    const counties: WaitlistCountyRow[] = [...byCounty.entries()]
      .map(([county, list]) => {
        const keyCounts = new Map<string, number>();
        for (const entry of list)
          keyCounts.set(entry.routingKey, (keyCounts.get(entry.routingKey) ?? 0) + 1);
        return {
          county,
          count: list.length,
          topKeys: [...keyCounts.entries()]
            .map(([key, count]) => ({ key, count }))
            .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
            .slice(0, 3),
          oldest: list[0].createdAt, // entries are sorted oldest-first
        };
      })
      .sort((a, b) => b.count - a.count || a.county.localeCompare(b.county));

    return { counties, total: entries.length };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Eircode eligibility config + rejected-key log (v2 — §18 ADM-2)
// ---------------------------------------------------------------------------

/** One allowlist edit, appended by POST /api/v1/admin/eligibility. */
export interface EligibilityChange {
  at: Date;
  added: string[];
  removed: string[];
}

/**
 * The `eligibility_config` document as stored. The changeLog lives outside
 * the zod schema (models.ts is v2-frozen) — it's written only by the admin
 * eligibility route and read only here.
 */
export type EligibilityConfigDoc = EligibilityConfig & {
  changeLog?: EligibilityChange[];
};

export interface RejectedKeyRow {
  key: string;
  county: string;
  count: number;
  last: Date;
}

export interface EligibilityAdminData {
  allowedRoutingKeys: readonly string[];
  /** Null when the config doc is missing (fallback = launch allowlist). */
  updatedAt: Date | null;
  /** Newest change first. */
  changeLog: EligibilityChange[];
  rejectionsLast7d: number;
  rejectionsTotal: number;
  /** Rejected routing keys grouped, most-hit first. */
  topRejected: RejectedKeyRow[];
}

export async function loadEligibilityAdmin(): Promise<EligibilityAdminData | null> {
  try {
    const [config, rejections] = await withTimeout(
      Promise.all([
        collections
          .eligibilityConfig()
          .then(
            (c) =>
              c.findOne({ _id: "launch" }) as Promise<EligibilityConfigDoc | null>
          ),
        collections
          .eligibilityRejections()
          .then((c) => c.find().sort({ at: -1 }).toArray()),
      ])
    );

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const byKey = new Map<string, RejectedKeyRow>();
    for (const r of rejections) {
      const row = byKey.get(r.routingKey);
      if (row) {
        row.count += 1;
        if (r.at > row.last) row.last = r.at;
      } else {
        byKey.set(r.routingKey, {
          key: r.routingKey,
          county: r.county,
          count: 1,
          last: r.at,
        });
      }
    }

    return {
      allowedRoutingKeys: config?.allowedRoutingKeys ?? LAUNCH_ALLOWLIST,
      updatedAt: config?.updatedAt ?? null,
      changeLog: [...(config?.changeLog ?? [])].reverse(),
      rejectionsLast7d: rejections.filter((r) => r.at >= weekAgo).length,
      rejectionsTotal: rejections.length,
      topRejected: [...byKey.values()].sort(
        (a, b) => b.count - a.count || a.key.localeCompare(b.key)
      ),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Consent audit log (v2 — §18 ADM-3)
// ---------------------------------------------------------------------------

export interface ConsentAuditRow {
  consent: Consent;
  memberName: string;
  memberEmail: string;
  /** Latest decision for this member+purpose (drives "RE-CONSENT DUE"). */
  isLatest: boolean;
}

export interface ConsentAuditData {
  /** Newest decision first — already filtered by purpose when one is given. */
  rows: ConsentAuditRow[];
  /** Unfiltered decision counts, for the filter chips. */
  countsByPurpose: Record<ConsentPurpose, number>;
  totalDecisions: number;
  /** Members whose latest health_processing grant is on an older wording
   * version — they get the re-consent screen on next sign-in. */
  reconsentDue: number;
  currentVersion: string;
}

export async function loadConsentAudit(
  purpose: ConsentPurpose | null
): Promise<ConsentAuditData | null> {
  try {
    const [consents, users] = await withTimeout(
      Promise.all([
        collections
          .consents()
          .then((c) => c.find().sort({ timestamp: -1, _id: -1 }).toArray()),
        collections.users().then((c) => c.find().toArray()),
      ])
    );

    const userById = new Map(users.map((u) => [u._id, u]));
    const latestSeen = new Set<string>();
    const countsByPurpose: Record<ConsentPurpose, number> = {
      health_processing: 0,
      clinician_review: 0,
      research: 0,
    };
    let reconsentDue = 0;
    const rows: ConsentAuditRow[] = [];

    for (const consent of consents) {
      countsByPurpose[consent.purpose] += 1;
      // Consents are append-only and sorted newest-first, so the first doc we
      // see per member+purpose is the current decision (consents.ts logic).
      const latestKey = `${consent.userId}:${consent.purpose}`;
      const isLatest = !latestSeen.has(latestKey);
      if (isLatest) {
        latestSeen.add(latestKey);
        if (
          consent.purpose === "health_processing" &&
          consent.granted &&
          consent.version !== CONSENT_VERSION
        )
          reconsentDue += 1;
      }
      if (purpose && consent.purpose !== purpose) continue;
      const user = userById.get(consent.userId);
      rows.push({
        consent,
        memberName: user?.name ?? consent.userId,
        memberEmail: user?.email ?? "—",
        isLatest,
      });
    }

    return {
      rows,
      countsByPurpose,
      totalDecisions: consents.length,
      reconsentDue,
      currentVersion: CONSENT_VERSION,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sidebar badges (review-queue + open-ticket counts)
// ---------------------------------------------------------------------------

export interface SidebarBadgeCounts {
  review: number | null;
  support: number | null;
}

export async function loadSidebarBadges(): Promise<SidebarBadgeCounts> {
  try {
    const [review, support] = await withTimeout(
      Promise.all([
        collections
          .biomarkerReadings()
          .then((c) => c.countDocuments({ clinicianReviewed: false })),
        collections
          .supportTickets()
          .then((c) =>
            c.countDocuments({ status: { $in: ["open", "pending"] } })
          ),
      ])
    );
    return { review, support };
  } catch {
    return { review: null, support: null };
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers (shared by the tab pages)
// ---------------------------------------------------------------------------

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "12 Jun" */
export function formatDayMonth(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Mar 2025" */
export function formatMonthYear(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "23 Jun 2026, 14:05" — full audit timestamps (consent log, config edits). */
export function formatDateTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

/** "2m" · "5h" · "3d" — relative age like the design's inbox timestamps. */
export function formatAge(d: Date, now: Date = new Date()): string {
  const mins = Math.max(1, Math.round((now.getTime() - d.getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/** "€48.2k" above a thousand, "€678" below. */
export function formatEur(value: number): string {
  if (value >= 1000) return `€${(value / 1000).toFixed(1)}k`;
  return `€${Math.round(value)}`;
}
