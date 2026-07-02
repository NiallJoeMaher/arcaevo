"use client";

/**
 * R2 · GIFT ESSENTIAL — arcaevo.com/gift (design §16).
 *
 * "You pay today; their year starts when they activate, not when you buy."
 * The buyer gets one email — "Dara activated your gift" — and never any
 * health data. Payment is the MOCK Stripe checkout session returned by
 * POST /api/v1/gift; the success state shows the code (and where it goes).
 */
import { useState } from "react";
import Link from "next/link";
import {
  Card,
  errorCls,
  inputCls,
  labelCls,
  primaryBtnCls,
} from "@/components/account/ui";

type Delivery = "email" | "printed";

export default function GiftForm() {
  const [delivery, setDelivery] = useState<Delivery>("email");
  const [purchaserEmail, setPurchaserEmail] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ code: string; sessionId: string } | null>(
    null
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/gift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaserEmail,
          ...(delivery === "email" && recipientEmail ? { recipientEmail } : {}),
          ...(note ? { note } : {}),
          delivery,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone({ code: data.code, sessionId: data.checkout?.sessionId ?? "" });
        return;
      }
      setError(
        typeof data.message === "string"
          ? data.message
          : "Something went wrong — try again in a moment."
      );
    } catch {
      setError("Something went wrong — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Card>
        <div className="p-7" aria-live="polite">
          <div
            aria-hidden="true"
            className="mb-4 h-[52px] w-[52px] rounded-full bg-[rgba(52,160,124,0.14)] text-center text-[24px] leading-[52px] text-forest"
          >
            ✓
          </div>
          <h1 className="mb-2 font-serif text-[23px] font-normal leading-[1.15]">
            Gift paid — €329
          </h1>
          <p className="mb-4 text-[13px] leading-[1.55] text-caption">
            {delivery === "email"
              ? "We'll email the code on the morning you chose — and you the receipt."
              : "The printed card is on its way to you, to hand over."}
          </p>
          <div className="mb-3 rounded-[13px] border-[1.5px] border-dashed border-[rgba(28,38,32,0.25)] bg-white p-4 text-center">
            <div className="mb-[3px] font-mono text-[16px] tracking-[0.12em]">
              {done.code}
            </div>
            <div className="text-[10.5px] text-caption">
              Their code — they redeem it at arcaevo.com/redeem
            </div>
          </div>
          {/* MOCK: payment ran through the mock Stripe vendor — no card moved. */}
          <p className="mb-4 font-mono text-[10px] tracking-[0.06em] text-caption">
            MOCK CHECKOUT · {done.sessionId}
          </p>
          <p className="text-[11.5px] leading-[1.55] text-caption">
            Recipient outside Dublin? The gift converts to Fusion + waitlist
            priority, or a full refund — their choice.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="p-7" noValidate>
        <h1 className="mb-2 font-serif text-[23px] font-normal leading-[1.15]">
          Give someone a year of knowing.
        </h1>
        <p className="mb-[18px] text-[13px] leading-[1.55] text-caption">
          A full Essential year — two tests, the app, everything. You pay
          today; their year starts when they activate, not when you buy.
        </p>

        <fieldset className="mb-[14px] border-0 p-0">
          <legend className="sr-only">How should the gift arrive?</legend>
          <div className="flex gap-[10px]">
            <button
              type="button"
              onClick={() => setDelivery("email")}
              aria-pressed={delivery === "email"}
              className={
                delivery === "email"
                  ? "flex-1 cursor-pointer rounded-[12px] border-[1.5px] border-forest bg-[rgba(52,160,124,0.06)] p-[14px] text-center"
                  : "flex-1 cursor-pointer rounded-[12px] border border-[rgba(28,38,32,0.14)] p-[14px] text-center"
              }
            >
              <span className="block text-[13px] font-bold">By email</span>
              <span className="block text-[11px] text-caption">
                On the morning you choose
              </span>
            </button>
            <button
              type="button"
              onClick={() => setDelivery("printed")}
              aria-pressed={delivery === "printed"}
              className={
                delivery === "printed"
                  ? "flex-1 cursor-pointer rounded-[12px] border-[1.5px] border-forest bg-[rgba(52,160,124,0.06)] p-[14px] text-center"
                  : "flex-1 cursor-pointer rounded-[12px] border border-[rgba(28,38,32,0.14)] p-[14px] text-center"
              }
            >
              <span className="block text-[13px] font-bold">Printed card</span>
              <span className="block text-[11px] text-caption">
                Posted to you, to hand over
              </span>
            </button>
          </div>
        </fieldset>

        <label htmlFor="gift-purchaser" className={labelCls}>
          Your email
        </label>
        <input
          id="gift-purchaser"
          type="email"
          autoComplete="email"
          required
          value={purchaserEmail}
          onChange={(e) => setPurchaserEmail(e.target.value)}
          placeholder="you@example.ie"
          className={inputCls}
        />

        {delivery === "email" ? (
          <>
            <label htmlFor="gift-recipient" className={labelCls}>
              Their email
            </label>
            <input
              id="gift-recipient"
              type="email"
              required
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="dara@example.ie"
              className={inputCls}
            />
          </>
        ) : null}

        <label htmlFor="gift-note" className={labelCls}>
          A note from you{" "}
          <span className="font-normal text-caption">· optional</span>
        </label>
        <input
          id="gift-note"
          type="text"
          maxLength={280}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={'"Happy 40th, Dara. Now you can stop guessing."'}
          className={`${inputCls} mb-4 italic`}
        />

        <p aria-live="assertive" className={error ? errorCls : "sr-only"}>
          {error}
        </p>

        <button type="submit" disabled={busy} className={primaryBtnCls}>
          {busy ? "One moment…" : "Gift Essential — €329"}
        </button>
        <p className="mt-[10px] text-center text-[11.5px] leading-[1.55] text-caption">
          Recipient outside Dublin? The gift converts to Fusion + waitlist
          priority, or a full refund — their choice.
        </p>
        <p className="mt-2 text-center text-[11.5px] text-caption">
          Got a code already?{" "}
          <Link href="/redeem" className="font-semibold text-forest no-underline">
            Redeem it
          </Link>
        </p>
      </form>
    </Card>
  );
}
