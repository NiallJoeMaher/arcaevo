import type { Metadata } from "next";
import { currentMember } from "@/components/account/session";
import { AuthShell } from "@/components/account/ui";
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

  // LIVE Stripe → the client must redirect to the hosted Checkout URL and let
  // the real server-to-server webhook activate the membership. MOCK → the
  // client fires the browser mock webhook (dev/e2e/docker, unchanged). Mirrors
  // the live/mock split already used by the account portal (account/page.tsx).
  const paymentsLive = selectedPaymentsVendorKind() === "live";

  return (
    <AuthShell>
      <CheckoutClient
        tier={parseTier(tier)}
        paymentsLive={paymentsLive}
        member={
          member ? { id: member._id, email: member.email, name: member.name } : null
        }
      />
    </AuthShell>
  );
}
