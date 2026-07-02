"use client";

/**
 * W6 · OUTSIDE DUBLIN — EARLY ACCESS (design §06, §14 X5).
 *
 * The refusal sells: a reason, a promise, and a real alternative. Joining
 * returns a county queue position (visible again in Account — a promise
 * with a receipt) and sends the E10 confirmation immediately. The Fusion
 * cross-sell turns a bounced checkout into revenue today. Never a dead end:
 * already-eligible Eircodes are pointed straight back at checkout.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Card,
  errorCls,
  inputCls,
  labelCls,
  primaryBtnCls,
} from "@/components/account/ui";

export default function EarlyAccessForm({
  initialEircode,
}: {
  initialEircode: string;
}) {
  const [eircode, setEircode] = useState(initialEircode);
  const [email, setEmail] = useState("");
  const [county, setCounty] = useState<string | null>(null);
  const [joined, setJoined] = useState<{
    position: number;
    county: string;
    alreadyJoined: boolean;
  } | null>(null);
  const [eligibleInstead, setEligibleInstead] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const looked = useRef(false);

  // Eircode carried over from checkout → name the county in the heading.
  useEffect(() => {
    if (!initialEircode || looked.current) return;
    looked.current = true;
    (async () => {
      try {
        const res = await fetch("/api/v1/eligibility/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eircode: initialEircode }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && !data.eligible && data.county) setCounty(data.county);
        if (res.ok && data.eligible) setEligibleInstead(true);
      } catch {
        /* heading falls back to the generic form */
      }
    })();
  }, [initialEircode]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, eircode }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setJoined({
          position: data.position,
          county: data.county,
          alreadyJoined: Boolean(data.alreadyJoined),
        });
        return;
      }
      if (data.error === "already_eligible") {
        setEligibleInstead(true);
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

  const fusionCard = (
    <div className="mt-[14px] rounded-[16px] border border-hairline-mid bg-surface p-6">
      <Link
        href="/checkout?tier=fusion"
        className="mb-3 block w-full rounded-pill border border-hairline-strong py-3 text-center text-[13.5px] font-semibold text-ink no-underline"
      >
        Start with Fusion instead — €119/yr, no shipping
      </Link>
      <p className="text-center text-[11.5px] text-caption">
        Fusion works anywhere: your watch + any past bloodwork.
      </p>
    </div>
  );

  // 409 already_eligible — good news, straight back to checkout.
  if (eligibleInstead) {
    return (
      <Card>
        <div className="px-7 pb-7 pt-[30px]">
          <h1 className="mb-2 font-serif text-[24px] font-normal leading-[1.15]">
            Good news — you&rsquo;re already in the service area.
          </h1>
          <p className="mb-[18px] text-[13px] leading-[1.6] text-muted">
            Essential and Performance are live for your Eircode today — no
            waiting required.
          </p>
          <Link
            href={`/checkout?tier=essential`}
            className={`${primaryBtnCls} no-underline`}
          >
            Head to checkout
          </Link>
        </div>
      </Card>
    );
  }

  if (joined) {
    return (
      <div>
        <Card>
          <div className="px-7 pb-7 pt-[30px]" aria-live="polite">
            <div
              aria-hidden="true"
              className="mb-4 h-[52px] w-[52px] rounded-full bg-[rgba(52,160,124,0.14)] text-center text-[24px] leading-[52px] text-forest"
            >
              ✓
            </div>
            <h1 className="mb-2 font-serif text-[24px] font-normal leading-[1.15]">
              You&rsquo;re on the list, {joined.county}.
            </h1>
            <p className="mb-[14px] text-[13px] leading-[1.6] text-muted">
              You&rsquo;re <strong>number {joined.position}</strong> in{" "}
              {joined.county}
              {joined.alreadyJoined
                ? " — you were already on the list, so your place is safe."
                : ". Confirmation email on its way."}
            </p>
            <p className="mb-0 text-[13px] leading-[1.6] text-muted">
              We&rsquo;ll open your area in order of demand — you&rsquo;ll get
              first booking and founding-member pricing, with a 30-day window
              when your county goes live. Your waitlist position is visible in{" "}
              <Link href="/account" className="font-semibold text-forest no-underline">
                Account
              </Link>
              .
            </p>
          </div>
        </Card>
        {fusionCard}
      </div>
    );
  }

  return (
    <div>
      <Card>
        <form onSubmit={handleSubmit} className="px-7 pb-7 pt-[30px]" noValidate>
          {county ? (
            <div className="mb-4 flex items-center gap-[10px] rounded-[10px] border border-hairline-strong bg-white px-[14px] py-[11px]">
              <span className="font-mono text-[15px] tracking-[0.08em]">
                {eircode.toUpperCase()}
              </span>
              <span className="ml-auto text-[12px] font-semibold text-amber">
                {county}
              </span>
            </div>
          ) : null}
          <h1 className="mb-2 font-serif text-[24px] font-normal leading-[1.15]">
            {county
              ? `Not in ${county} yet — but you're next.`
              : "Not everywhere yet — but you're next."}
          </h1>
          <p className="mb-[18px] text-[13px] leading-[1.6] text-muted">
            We&rsquo;re starting in Dublin so every kit, courier and nurse
            visit is flawless before we widen the map. Join the early-access
            list and we&rsquo;ll open your area in order of demand —
            you&rsquo;ll get first booking and founding-member pricing.
          </p>

          {county ? null : (
            <>
              <label htmlFor="waitlist-eircode" className={labelCls}>
                Your Eircode
              </label>
              <input
                id="waitlist-eircode"
                type="text"
                required
                value={eircode}
                onChange={(e) => setEircode(e.target.value)}
                placeholder="T12 AB90"
                className={`${inputCls} font-mono tracking-[0.08em]`}
              />
            </>
          )}

          <label htmlFor="waitlist-email" className={labelCls}>
            Email
          </label>
          <input
            id="waitlist-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="aoife@example.ie"
            className={`${inputCls} mb-4`}
          />

          <p aria-live="assertive" className={error ? errorCls : "sr-only"}>
            {error}
          </p>

          <button type="submit" disabled={busy} className={primaryBtnCls}>
            {busy ? "Joining…" : "Join the early-access list"}
          </button>
        </form>
      </Card>
      {fusionCard}
    </div>
  );
}
