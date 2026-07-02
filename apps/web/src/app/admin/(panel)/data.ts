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
import {
  CADENCE_UPGRADE_EUR,
  type BiomarkerReading,
  type BiomarkerRule,
  type MembershipTier,
  type SupportTicket,
  type TestOrder,
  type User,
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
