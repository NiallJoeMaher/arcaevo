"use client";

/**
 * X2 · DUNNING — THE PAUSED STATE (design §14).
 * Quiet banner, no red, no pushes. Day 0–13: "Card issue — 14 days to sort
 * it, everything still works." Day 14+: pause, not punishment — read-only,
 * "Your data is safe. Resume anytime." Update card → instant resume (MOCK:
 * fires the invoice.paid webhook the way a real card update would).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DunningBanner({
  memberId,
  paused,
}: {
  memberId: string;
  paused: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleUpdateCard() {
    setBusy(true);
    try {
      // MOCK: a real flow opens Stripe's card update; the successful charge
      // then arrives as invoice.paid. We fire it directly.
      await fetch("/api/v1/webhooks/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "invoice.paid", data: { memberId } }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="mb-[14px] flex items-center justify-between gap-4 rounded-[14px] border border-[rgba(217,154,78,0.4)] bg-[rgba(217,154,78,0.08)] px-[18px] py-[14px]"
      role="status"
    >
      <p className="text-[12.5px] leading-[1.5] text-muted">
        {paused ? (
          <>
            <strong>Pause, not punishment.</strong> Your membership is
            read-only: all history visible, no new tests or insights. Your
            data is safe. Resume anytime.
          </>
        ) : (
          <>
            <strong>Card issue</strong> — 14 days to sort it, everything still
            works.
          </>
        )}
      </p>
      <button
        type="button"
        onClick={() => void handleUpdateCard()}
        disabled={busy}
        className="shrink-0 cursor-pointer rounded-pill bg-forest px-[14px] py-[7px] text-[11.5px] font-semibold text-white disabled:opacity-60"
      >
        {busy ? "One moment…" : "Update card"}
      </button>
    </div>
  );
}
