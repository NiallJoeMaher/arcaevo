/**
 * GET /api/v1/admin/kpis — admin dashboard numbers:
 * members by tier, MRR-equivalent (annual revenue / 12, incl. cadence
 * upgrades), orders in flight, results awaiting review, open tickets.
 */
import { requireAdmin } from "@/lib/auth";
import { collections } from "@/lib/db";
import { CADENCE_UPGRADE_EUR, type MembershipTier } from "@/lib/models";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const [memberships, ordersInFlight, awaitingReview, openTickets] =
    await Promise.all([
      collections
        .memberships()
        .then((c) => c.find({ status: { $ne: "canceled" } }).toArray()),
      collections
        .testOrders()
        .then((c) =>
          c.countDocuments({ status: { $ne: "results_ready" } })
        ),
      collections
        .biomarkerReadings()
        .then((c) => c.countDocuments({ clinicianReviewed: false })),
      collections
        .supportTickets()
        .then((c) => c.countDocuments({ status: { $in: ["open", "pending"] } })),
    ]);

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
  const activeMembers = memberships.length;
  const mrrEquivalentEur = Math.round((annualRevenueEur / 12) * 100) / 100;

  return Response.json({
    activeMembers,
    membersByTier,
    // Annual-only billing ⇒ MRR is an equivalent (annual €/12), not real MRR.
    mrrEquivalentEur,
    annualRevenueEur,
    ordersInFlight,
    resultsAwaitingReview: awaitingReview,
    openTickets,
  });
}
