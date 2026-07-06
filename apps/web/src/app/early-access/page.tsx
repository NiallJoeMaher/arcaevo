import type { Metadata } from "next";
import { AuthShell } from "@/components/account/ui";
import { bloodTiersEnabled } from "@/lib/env";
import EarlyAccessForm from "./EarlyAccessForm";

export const metadata: Metadata = {
  title: "Early access",
  description:
    "We're starting in Dublin. Join the early-access list and we'll open your area in order of demand — first booking and founding-member pricing.",
};

export default async function EarlyAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ eircode?: string }>;
}) {
  const { eircode } = await searchParams;
  return (
    <AuthShell>
      {/* salesOpen mirrors the checkout gate: while BLOOD_TIERS_ENABLED is
          off, /checkout redirects straight back here, so the form must never
          point an eligible Eircode at checkout (dead loop) — they join the
          list like everyone else. */}
      <EarlyAccessForm
        initialEircode={eircode ?? ""}
        salesOpen={bloodTiersEnabled()}
      />
    </AuthShell>
  );
}
