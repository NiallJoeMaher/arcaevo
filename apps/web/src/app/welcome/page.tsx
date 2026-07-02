import type { Metadata } from "next";
import { collections } from "@/lib/db";
import { currentMember } from "@/components/account/session";
import { AuthShell } from "@/components/account/ui";
import WelcomeClient, { type WelcomeTier } from "./WelcomeClient";

export const metadata: Metadata = {
  title: "You're a member",
  description: "What happens next — kit, app, and your first test.",
  robots: { index: false },
};

function parseTier(value: string | undefined): WelcomeTier | null {
  return value === "essential" || value === "performance" || value === "fusion"
    ? value
    : null;
}

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string }>;
}) {
  const [{ tier }, member] = await Promise.all([searchParams, currentMember()]);

  // Signed-in members get live data; guests (account created inline at
  // checkout, not yet verified) fall back to the ?tier= + the client stash.
  let liveTier: WelcomeTier | null = null;
  if (member) {
    const membership = await collections
      .memberships()
      .then((c) =>
        c.findOne({ memberId: member._id, status: { $in: ["active", "pending"] } })
      );
    if (membership) liveTier = membership.tier;
  }

  return (
    <AuthShell>
      <WelcomeClient
        tier={liveTier ?? parseTier(tier) ?? "essential"}
        member={member ? { name: member.name, email: member.email } : null}
      />
    </AuthShell>
  );
}
