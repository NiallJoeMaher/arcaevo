import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentMember } from "@/components/account/session";
import { AuthShell } from "@/components/account/ui";
import { bloodTiersEnabled } from "@/lib/env";
import { selectedPaymentsVendorKind } from "@/lib/vendors/stripe";
import CheckoutClient, { type CheckoutTier } from "./CheckoutClient";

export const metadata: Metadata = {
  title: "Checkout",
  description:
    "Eligibility → details → payment. Full refund until your kit ships or your draw is booked.",
  robots: { index: false },
};

function parseTier(value: string | undefined): CheckoutTier {
  return value === "performance" || value === "fusion" ? value : "essential";
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string }>;
}) {
  const [{ tier }, member] = await Promise.all([searchParams, currentMember()]);

  // Blood-tier gate: Essential/Performance can't be bought while blood tiers are
  // off (matches the server checkout route + the pricing "coming soon" state).
  // Send the buyer to the waitlist instead of a checkout form that would reject.
  // Fusion (€119) is always purchasable.
  const selectedTier = parseTier(tier);
  if (selectedTier !== "fusion" && !bloodTiersEnabled()) {
    redirect("/early-access");
  }

  // LIVE Stripe → the client must redirect to the hosted Checkout URL and let
  // the real server-to-server webhook activate the membership. MOCK → the
  // client fires the browser mock webhook (dev/e2e/docker, unchanged). Mirrors
  // the live/mock split already used by the account portal (account/page.tsx).
  const paymentsLive = selectedPaymentsVendorKind() === "live";

  return (
    <AuthShell>
      <CheckoutClient
        tier={selectedTier}
        paymentsLive={paymentsLive}
        member={
          member ? { id: member._id, email: member.email, name: member.name } : null
        }
      />
    </AuthShell>
  );
}
