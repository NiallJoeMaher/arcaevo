"use client";

/**
 * Gift redemption (design §16) — "Redemption is the sign-up flow": a gift
 * code slots in as a pre-paid plan — same account, same consent gate, same
 * Eircode check with the same honest fallback. POST /api/v1/gift/redeem is
 * member-authed, so signed-out visitors are sent through /join first.
 *
 * Outside Dublin (403): the designed choice — Fusion + waitlist priority
 * (real: joins the waitlist, then Fusion checkout) or a full refund (via a
 * human — /contact).
 */
import { useState } from "react";
import Link from "next/link";
import {
  Card,
  errorCls,
  inputCls,
  labelCls,
  primaryBtnCls,
  secondaryBtnCls,
} from "@/components/account/ui";

type Phase =
  | { name: "form" }
  | { name: "outside"; county: string }
  | { name: "redeemed"; giftNote: string | null };

export default function RedeemForm({
  signedIn,
  email,
}: {
  signedIn: boolean;
  email: string | null;
}) {
  const [code, setCode] = useState("");
  const [eircode, setEircode] = useState("");
  const [phase, setPhase] = useState<Phase>({ name: "form" });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/gift/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, eircode }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPhase({ name: "redeemed", giftNote: data.giftNote ?? null });
        return;
      }
      if (data.error === "not_in_service_area") {
        setPhase({ name: "outside", county: data.county ?? "your county" });
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

  /** Fusion + waitlist priority — the real half of the designed choice. */
  async function handleFusionChoice() {
    setBusy(true);
    setNotice(null);
    try {
      if (email) {
        await fetch("/api/v1/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, eircode }),
        });
      }
      setNotice("You're on the early-access list — starting you on Fusion.");
      window.location.href = "/checkout?tier=fusion";
    } catch {
      window.location.href = "/checkout?tier=fusion";
    }
  }

  if (!signedIn) {
    return (
      <Card>
        <div className="px-7 pb-7 pt-[30px]">
          <h1 className="mb-2 font-serif text-[24px] font-normal leading-[1.15]">
            Redeem your gift
          </h1>
          <p className="mb-[18px] text-[13px] leading-[1.6] text-muted">
            A gift code slots in as a pre-paid plan — same account creation,
            same consent gate, same Eircode check. Create your free account
            (or sign in) first, then come back to this page.
          </p>
          <Link href="/join" className={`${primaryBtnCls} mb-[10px] no-underline`}>
            Create account
          </Link>
          <Link href="/signin" className={`${secondaryBtnCls} no-underline`}>
            Sign in
          </Link>
        </div>
      </Card>
    );
  }

  if (phase.name === "redeemed") {
    return (
      <Card>
        <div className="px-7 pb-7 pt-[30px]" aria-live="polite">
          <div
            aria-hidden="true"
            className="mb-4 h-[52px] w-[52px] rounded-full bg-[rgba(52,160,124,0.14)] text-center text-[24px] leading-[52px] text-forest"
          >
            ✓
          </div>
          <h1 className="mb-2 font-serif text-[24px] font-normal leading-[1.15]">
            Your Essential year starts today.
          </h1>
          {phase.giftNote ? (
            <p className="mb-4 rounded-[12px] border border-hairline-mid bg-white p-[14px] text-[13px] italic leading-[1.55] text-muted">
              &ldquo;{phase.giftNote}&rdquo;
            </p>
          ) : null}
          <p className="mb-[18px] text-[13px] leading-[1.6] text-muted">
            Two tests, the app, everything — activated now, not when it was
            bought. The buyer gets one email saying it&rsquo;s live, and never
            any health data.
          </p>
          <Link href="/consent" className={`${primaryBtnCls} no-underline`}>
            Continue
          </Link>
        </div>
      </Card>
    );
  }

  if (phase.name === "outside") {
    return (
      <Card>
        <div className="px-7 pb-7 pt-[30px]">
          <h1 className="mb-2 font-serif text-[24px] font-normal leading-[1.15]">
            Not in {phase.county} yet — your choice.
          </h1>
          <p className="mb-[18px] text-[13px] leading-[1.6] text-muted">
            Essential ships kits, and we don&rsquo;t reach {phase.county} yet.
            Your gift can convert to Fusion + waitlist priority, or a full
            refund — their choice is yours to make.
          </p>
          <button
            type="button"
            onClick={() => void handleFusionChoice()}
            disabled={busy}
            className={`${primaryBtnCls} mb-[10px]`}
          >
            Fusion + waitlist priority
          </button>
          <Link href="/contact" className={`${secondaryBtnCls} no-underline`}>
            Full refund — talk to a human
          </Link>
          <p aria-live="polite" className="mt-3 text-center text-[11.5px] text-caption">
            {notice ?? "Fusion works anywhere: your watch + any past bloodwork."}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="px-7 pb-7 pt-[30px]" noValidate>
        <h1 className="mb-2 font-serif text-[24px] font-normal leading-[1.15]">
          Redeem your gift
        </h1>
        <p className="mb-[18px] text-[13px] leading-[1.6] text-muted">
          A full Essential year, pre-paid. Essential ships kits by courier, so
          the same Eircode check applies — with the same honest fallback.
        </p>

        <label htmlFor="redeem-code" className={labelCls}>
          Gift code
        </label>
        <input
          id="redeem-code"
          type="text"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="GIFT-XXXX-XXXX"
          className={`${inputCls} font-mono tracking-[0.12em]`}
        />

        <label htmlFor="redeem-eircode" className={labelCls}>
          Your Eircode
        </label>
        <input
          id="redeem-eircode"
          type="text"
          required
          value={eircode}
          onChange={(e) => setEircode(e.target.value)}
          placeholder="D08 XY24"
          className={`${inputCls} mb-4 font-mono tracking-[0.08em]`}
        />

        <p aria-live="assertive" className={error ? errorCls : "sr-only"}>
          {error}
        </p>

        <button type="submit" disabled={busy} className={primaryBtnCls}>
          {busy ? "Checking…" : "Activate my gift"}
        </button>
      </form>
    </Card>
  );
}
