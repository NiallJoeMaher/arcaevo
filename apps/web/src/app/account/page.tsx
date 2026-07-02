import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { collections } from "@/lib/db";
import { TIER_INCLUDED_TESTS } from "@/lib/models";
import { currentMember } from "@/components/account/session";
import DunningBanner from "./DunningBanner";
import MembershipActions from "./MembershipActions";
import ExportRow from "./ExportRow";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false },
};

// Session cookie + live billing state — always render fresh.
export const dynamic = "force-dynamic";

function tierLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function longDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default async function AccountPage() {
  const member = await currentMember();
  if (!member) redirect("/signin");

  const [membership, waitlistEntry, includedOrders] = await Promise.all([
    collections
      .memberships()
      .then((c) =>
        c.findOne({
          memberId: member._id,
          status: { $in: ["active", "past_due", "pending", "canceled"] },
        })
      ),
    collections.waitlist().then((c) => c.findOne({ email: member.email })),
    collections
      .testOrders()
      .then((c) =>
        c.countDocuments({ memberId: member._id, includedInPlan: true })
      ),
  ]);

  const statusChip: Record<string, { label: string; cls: string }> = {
    active: { label: "ACTIVE", cls: "text-vitality-light" },
    past_due: { label: "PAST DUE", cls: "text-amber" },
    pending: { label: "PENDING", cls: "text-muted-dark-soft" },
    canceled: { label: "CANCELED", cls: "text-muted-dark-soft" },
  };

  const totalIncluded = membership
    ? TIER_INCLUDED_TESTS[membership.tier].reduce((sum, t) => sum + t.count, 0)
    : 0;

  return (
    <div>
      <h1 className="sr-only">Account — Membership</h1>

      {membership && membership.status === "past_due" ? (
        <DunningBanner
          memberId={member._id}
          paused={membership.dunningStage === "paused"}
        />
      ) : null}

      {membership ? (
        <div className="mb-[14px] rounded-[14px] bg-ink px-5 py-[18px] text-bone-white">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-[15px] font-bold">
              {tierLabel(membership.tier)} · €{membership.priceEur}/yr
            </span>
            <span
              className={`font-mono text-[10px] tracking-[0.08em] ${statusChip[membership.status]?.cls ?? "text-muted-dark-soft"}`}
            >
              {statusChip[membership.status]?.label ?? membership.status}
            </span>
          </div>
          <p className="mb-3 text-[12px] text-muted-dark">
            Renews {longDate(new Date(membership.renewalDate))} · Visa ····
            4242
            {totalIncluded > 0
              ? ` · ${Math.min(includedOrders, totalIncluded)} of ${totalIncluded} tests used`
              : ""}
          </p>
          <MembershipActions
            memberId={member._id}
            status={membership.status}
          />
        </div>
      ) : (
        <div className="mb-[14px] rounded-[14px] bg-ink px-5 py-[18px] text-bone-white">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-[15px] font-bold">Free account</span>
            <span className="font-mono text-[10px] tracking-[0.08em] text-muted-dark-soft">
              NO MEMBERSHIP
            </span>
          </div>
          <p className="mb-3 text-[12px] leading-[1.5] text-muted-dark">
            Your account manages profile, consent and purchase. Your own
            morning starts with a plan — tests included.
          </p>
          <Link
            href="/pricing"
            className="inline-block rounded-pill bg-forest px-[14px] py-[7px] text-[11.5px] font-semibold text-white no-underline"
          >
            See plans — from €119/yr
          </Link>
        </div>
      )}

      {waitlistEntry ? (
        <div className="mb-[10px] rounded-[14px] border border-hairline bg-white px-[18px] py-4">
          <div className="text-[13px] font-bold">
            Early access — {waitlistEntry.county}
          </div>
          <p className="mt-[2px] text-[11.5px] leading-[1.5] text-caption">
            You&rsquo;re number {waitlistEntry.position} on the{" "}
            {waitlistEntry.county} list. We open areas in order of demand —
            you&rsquo;ll get first booking and founding-member pricing, with a
            30-day window when your county goes live.
          </p>
        </div>
      ) : null}

      {membership?.tier === "essential" ? (
        <div className="mb-[10px] flex items-center justify-between rounded-[14px] border border-hairline bg-white px-[18px] py-4">
          <div>
            <div className="text-[13px] font-bold">Add quarterly tracking</div>
            <div className="text-[11.5px] text-caption">
              Two extra rechecks between baselines
            </div>
          </div>
          {/* +€130/yr is the locked price (docs/BUILD_STATE.md ground rules
              + CADENCE_UPGRADE_EUR); the §10 mock's €140 predates it. */}
          <span className="rounded-pill border border-ink px-[14px] py-[7px] text-[11.5px] font-semibold">
            + €130/yr
          </span>
        </div>
      ) : null}

      <ExportRow />
    </div>
  );
}
