"use client";

/**
 * The membership card's action pills (design §10 W10).
 *
 * Two paths, gated on the active payments vendor (`portalLive`):
 *  - LIVE Stripe → Update card / Invoices / Change plan / Cancel renewal all
 *    open the hosted Stripe **Customer Portal** (POST /api/v1/account/portal),
 *    which handles card updates, plan switching (the +€130 quarterly upgrade)
 *    and cancellation natively. Preferred over bespoke buttons when live.
 *  - MOCK (dev / e2e / docker) → the original honest behaviour: Upgrade → new
 *    checkout at /pricing; Update card / Invoices are inert (nothing to fake);
 *    Cancel renewal is one calm confirmation that fires the
 *    customer.subscription.deleted webhook. Unchanged so e2e is unaffected.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const pillCls =
  "rounded-pill border border-[rgba(255,255,255,0.25)] px-[13px] py-[7px] text-[11.5px] font-semibold text-bone-white";

export default function MembershipActions({
  memberId,
  status,
  portalLive = false,
}: {
  memberId: string;
  status: string;
  portalLive?: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // LIVE: hand the member off to Stripe's hosted Customer Portal.
  async function openPortal() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/account/portal", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        message?: string;
      };
      if (res.ok && body.url) {
        window.location.href = body.url;
        return;
      }
      setError(
        body.message ?? "Billing management is unavailable right now."
      );
    } catch {
      setError("Billing management is unavailable right now.");
    } finally {
      setBusy(false);
    }
  }

  // MOCK: cancel renewal via the interim browser-fired webhook.
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

  // --- LIVE: everything routes to the Customer Portal ----------------------
  if (portalLive) {
    return (
      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        <button
          type="button"
          onClick={() => void openPortal()}
          disabled={busy}
          className={`${pillCls} cursor-pointer`}
        >
          {busy ? "Opening…" : "Manage billing"}
        </button>
        <button
          type="button"
          onClick={() => void openPortal()}
          disabled={busy}
          className={`${pillCls} cursor-pointer`}
        >
          Update card
        </button>
        <button
          type="button"
          onClick={() => void openPortal()}
          disabled={busy}
          className={`${pillCls} cursor-pointer`}
        >
          Invoices
        </button>
        {status !== "canceled" ? (
          <button
            type="button"
            onClick={() => void openPortal()}
            disabled={busy}
            className="cursor-pointer rounded-pill border border-[rgba(255,255,255,0.18)] px-[13px] py-[7px] text-[11.5px] text-muted-dark"
          >
            Cancel renewal
          </button>
        ) : null}
        {error ? (
          <span className="text-[11.5px] text-amber">{error}</span>
        ) : null}
      </div>
    );
  }

  // --- MOCK: original behaviour (unchanged) --------------------------------
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
