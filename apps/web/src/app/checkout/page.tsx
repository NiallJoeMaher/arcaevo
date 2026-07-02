import type { Metadata } from "next";
import { currentMember } from "@/components/account/session";
import { AuthShell } from "@/components/account/ui";
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

  return (
    <AuthShell>
      <CheckoutClient
        tier={parseTier(tier)}
        member={
          member ? { id: member._id, email: member.email, name: member.name } : null
        }
      />
    </AuthShell>
  );
}
