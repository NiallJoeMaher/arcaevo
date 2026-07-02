"use client";

/**
 * The membership card's action pills (design §10 W10).
 *  - Upgrade plan → /pricing (annual plans; upgrade = new checkout).
 *  - Update card / Invoices — arrive with the real Stripe portal.
 *    TODO(stripe portal): wire both to Stripe's billing portal when the mock
 *    vendor is replaced; nothing to fake honestly today.
 *  - Cancel renewal — honest and undramatic: one confirmation, access runs
 *    to year-end, unused tests stay usable, no retention maze. MOCK: fires
 *    the customer.subscription.deleted webhook.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const pillCls =
  "rounded-pill border border-[rgba(255,255,255,0.25)] px-[13px] py-[7px] text-[11.5px] font-semibold text-bone-white";

export default function MembershipActions({
  memberId,
  status,
}: {
  memberId: string;
  status: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleCancel() {
    setBusy(true);
    try {
      await fetch("/api/v1/webhooks/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "customer.subscription.deleted",
          data: { memberId },
        }),
      });
      router.refresh();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        <span className="text-[11.5px] text-muted-dark">
          Cancel renewal? Access runs to year-end and unused tests stay
          usable.
        </span>
        <button
          type="button"
          onClick={() => void handleCancel()}
          disabled={busy}
          className={`${pillCls} cursor-pointer`}
        >
          {busy ? "Cancelling…" : "Yes, cancel renewal"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-pill px-[13px] py-[7px] text-[11.5px] text-muted-dark-soft"
        >
          Keep it
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/pricing" className={`${pillCls} no-underline`}>
        Upgrade plan
      </Link>
      <span className={`${pillCls} opacity-60`} aria-disabled="true">
        Update card
      </span>
      <span className={`${pillCls} opacity-60`} aria-disabled="true">
        Invoices
      </span>
      {status !== "canceled" ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="cursor-pointer rounded-pill border border-[rgba(255,255,255,0.18)] px-[13px] py-[7px] text-[11.5px] text-muted-dark"
        >
          Cancel renewal
        </button>
      ) : null}
    </div>
  );
}
