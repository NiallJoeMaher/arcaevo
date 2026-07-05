"use client";

/**
 * Checkout — three steps, one page each (design §07 W5→W7→W8).
 *
 *  Step 1 · eligibility — the Eircode gate (§06). Only the routing key is
 *          checked; fail → the early-access offer with the Eircode carried
 *          over, plus the Fusion alternative. Fusion skips this step
 *          entirely (never gated — nothing ships).
 *  Step 2 · details — name, delivery/visit address, email for guests
 *          (account created inline server-side), DOB (lab requirement).
 *  Step 3 · payment — both submit POST /api/v1/checkout. Then, split by vendor:
 *          · LIVE Stripe → redirect to the hosted Checkout `url`; activation
 *            happens only via the real signature-verified server webhook.
 *          · MOCK (dev/e2e/docker) → fire the mock checkout.session.completed
 *            webhook to activate, then → /welcome. (card form is mock-only)
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resolveCheckoutAction } from "@/lib/checkout-action";
import {
  Card,
  errorCls,
  inputCls,
  kickerCls,
  labelCls,
  primaryBtnCls,
} from "@/components/account/ui";

export type CheckoutTier = "essential" | "performance" | "fusion";

const TIER_PRICE: Record<CheckoutTier, number> = {
  fusion: 119,
  essential: 329,
  performance: 399,
};
const TIER_LABEL: Record<CheckoutTier, string> = {
  fusion: "Fusion",
  essential: "Essential",
  performance: "Performance",
};

function renewalLabel(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return new Intl.DateTimeFormat("en-IE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** "14 / 03 / 1991" → "1991-03-14" (the API's ISO dob). */
function parseDob(value: string): string | null {
  const match = /^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, d, m, y] = match;
  const day = Number(d);
  const month = Number(m);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

type Eligibility =
  | { state: "unchecked" }
  | { state: "eligible"; routingKey: string }
  | { state: "ineligible"; county: string };

export default function CheckoutClient({
  tier,
  member,
  paymentsLive = false,
}: {
  tier: CheckoutTier;
  member: { id: string; email: string; name: string } | null;
  /** True when real Stripe keys are live: redirect to hosted Checkout instead
   *  of firing the browser mock webhook (see handlePay). */
  paymentsLive?: boolean;
}) {
  const router = useRouter();
  const gated = tier !== "fusion"; // Fusion skips step 1 — never gated
  const [step, setStep] = useState<1 | 2 | 3>(gated ? 1 : 2);

  const [eircode, setEircode] = useState("");
  const [eligibility, setEligibility] = useState<Eligibility>({
    state: "unchecked",
  });
  const [name, setName] = useState(member?.name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [address, setAddress] = useState("");
  const [dob, setDob] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const price = TIER_PRICE[tier];
  const stepKicker = (n: number) =>
    `STEP ${n} OF 3 · ${TIER_LABEL[tier].toUpperCase()} — €${price}/YR`;

  /* ── step 1 · eligibility ──────────────────────────────────────── */

  /** POST /api/v1/eligibility/check; returns true when in the service area. */
  async function checkEircode(): Promise<boolean> {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/eligibility/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eircode }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.eligible) {
        setEligibility({ state: "eligible", routingKey: data.routingKey });
        return true;
      }
      if (res.ok) {
        setEligibility({ state: "ineligible", county: data.county ?? "your county" });
        return false;
      }
      setEligibility({ state: "unchecked" });
      setError(
        typeof data.message === "string"
          ? data.message
          : "That doesn't look like an Eircode — we only need the first 3 characters (e.g. D08)."
      );
      return false;
    } catch {
      setError("Something went wrong — try again in a moment.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Show the designed pass state as soon as the field is left (W5). */
  async function handleEircodeBlur() {
    if (eircode.trim().length >= 3 && eligibility.state === "unchecked") {
      await checkEircode();
    }
  }

  async function handleEligibility(event: React.FormEvent) {
    event.preventDefault();
    if (eligibility.state === "eligible") {
      setStep(2);
      return;
    }
    const eligible = await checkEircode();
    if (eligible) setStep(2);
  }

  /* ── step 3 · payment (MOCK Stripe + Apple Pay on web) ─────────── */

  async function handlePay() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          cadenceUpgrade: false,
          ...(gated ? { eircode } : {}),
          ...(member ? {} : { email }),
          ...(name ? { name } : {}),
          ...(dob && parseDob(dob) ? { dob: parseDob(dob) } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === "not_in_service_area") {
          setStep(1);
          setEligibility({ state: "ineligible", county: data.county ?? "your county" });
        } else if (data.error === "email_required") {
          setStep(2);
        }
        setError(
          typeof data.message === "string"
            ? data.message
            : "Something went wrong — try again in a moment."
        );
        return;
      }
      // LIVE Stripe: hand off to the real hosted Checkout page. Money is
      // actually collected there and the membership is activated ONLY by the
      // real, signature-verified server-to-server webhook — the browser NEVER
      // fires a webhook in live mode (that was the revenue-leak: it granted
      // membership with €0 collected). MOCK: fire the browser webhook as before.
      const action = resolveCheckoutAction(paymentsLive, data);
      if (action.kind === "redirect") {
        window.location.href = action.url; // leaves the page — no more work here
        return;
      }
      if (action.kind === "error") {
        // LIVE but no hosted URL — fail closed rather than silently activate.
        setError("Couldn't start secure checkout — try again in a moment.");
        setBusy(false);
        return;
      }
      // MOCK: the payment succeeded instantly — fire the webhook that a real
      // Stripe would send, activating the pending membership (+ E4 receipt).
      await fetch("/api/v1/webhooks/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "checkout.session.completed",
          data: { memberId: data.member.id },
        }),
      });
      // /welcome greets by name even for guests (no session cookie yet).
      try {
        sessionStorage.setItem(
          "arcaevo:welcome",
          JSON.stringify({ tier, name, email: data.member.email })
        );
      } catch {
        /* private mode — /welcome falls back to the session, if any */
      }
      router.push(`/welcome?tier=${tier}`);
    } catch {
      setError("Something went wrong — try again in a moment.");
      setBusy(false);
    }
  }

  /* ── render ────────────────────────────────────────────────────── */

  const errorLine = (
    <p aria-live="assertive" className={error ? errorCls : "sr-only"}>
      {error}
      {error?.includes("already have a") ? (
        <>
          {" "}
          <Link href="/account" className="font-semibold text-forest underline">
            Go to Account
          </Link>
        </>
      ) : null}
    </p>
  );

  // W5 · STEP 1 — ELIGIBILITY (pass / fail / invalid)
  if (step === 1) {
    if (eligibility.state === "ineligible") {
      // W6 inline — the refusal sells: a reason, a promise, a real alternative.
      return (
        <Card>
          <div className="px-7 pb-7 pt-[30px]">
            <div className="mb-4 flex items-center gap-[10px] rounded-[10px] border border-hairline-strong bg-white px-[14px] py-[11px]">
              <span className="font-mono text-[15px] tracking-[0.08em]">
                {eircode.toUpperCase()}
              </span>
              <span className="ml-auto text-[12px] font-semibold text-amber">
                {eligibility.county}
              </span>
            </div>
            <h1 className="mb-2 font-serif text-[24px] font-normal leading-[1.15]">
              Not in {eligibility.county} yet — but you&rsquo;re next.
            </h1>
            <p className="mb-[18px] text-[13px] leading-[1.6] text-muted">
              We&rsquo;re starting in Dublin so every kit, courier and nurse
              visit is flawless before we widen the map. Join the early-access
              list and we&rsquo;ll open your area in order of demand —
              you&rsquo;ll get first booking and founding-member pricing.
            </p>
            <Link
              href={`/early-access?eircode=${encodeURIComponent(eircode)}`}
              className={`${primaryBtnCls} mb-[10px] no-underline`}
            >
              Join the early-access list
            </Link>
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
        </Card>
      );
    }

    const eligible = eligibility.state === "eligible";
    return (
      <Card>
        {/* key: each step must mount a FRESH form. Reusing the DOM node lets a
            click's default action (form submit) land on the next step's submit
            button after the re-render — skipping the details step entirely. */}
        <form
          key="step-eligibility"
          onSubmit={handleEligibility}
          className="px-7 pb-7 pt-[30px]"
          noValidate
        >
          <div className={kickerCls}>{stepKicker(1)}</div>
          <h1 className="mb-2 font-serif text-[24px] font-normal leading-[1.15]">
            First — can we reach you?
          </h1>
          <p className="mb-5 text-[13px] leading-[1.55] text-caption">
            Essential ships kits by courier and Performance sends a nurse, so
            we&rsquo;re starting where we can do both well: Dublin.
          </p>
          <label htmlFor="checkout-eircode" className={labelCls}>
            Your Eircode
          </label>
          <div
            className={`mb-[10px] flex items-center gap-[10px] rounded-[10px] bg-white px-[14px] py-[11px] ${
              eligible
                ? "border-[1.5px] border-vitality"
                : "border border-hairline-strong"
            }`}
          >
            <input
              id="checkout-eircode"
              type="text"
              required
              value={eircode}
              onChange={(e) => {
                setEircode(e.target.value);
                setEligibility({ state: "unchecked" });
              }}
              onBlur={() => void handleEircodeBlur()}
              placeholder="D08 XY24"
              className="w-full bg-transparent font-mono text-[15px] tracking-[0.08em] outline-none placeholder:text-[#7C887F]"
            />
            {eligible ? (
              <span aria-hidden="true" className="ml-auto text-[13px] font-bold text-forest">
                ✓
              </span>
            ) : null}
          </div>
          <p
            aria-live="polite"
            className={
              eligible
                ? "mb-5 flex items-center gap-2 text-[13px] font-semibold text-forest"
                : "sr-only"
            }
          >
            {eligible ? (
              <>
                <span
                  aria-hidden="true"
                  className="h-[18px] w-[18px] rounded-full bg-[rgba(52,160,124,0.16)] text-center text-[11px] leading-[18px]"
                >
                  ✓
                </span>
                You&rsquo;re in the Dublin service area
              </>
            ) : null}
          </p>
          {errorLine}
          {eligible ? (
            <button
              type="button"
              onClick={() => setStep(2)}
              className={`${primaryBtnCls} mb-3`}
            >
              Continue to your details
            </button>
          ) : (
            <button type="submit" disabled={busy} className={`${primaryBtnCls} mb-3`}>
              {busy ? "Checking…" : "Continue to your details"}
            </button>
          )}
          <p className="text-center text-[11.5px] text-caption">
            Only the routing key is checked — we don&rsquo;t store it until you
            order.
          </p>
        </form>
      </Card>
    );
  }

  // W7 · STEP 2 — DETAILS & DELIVERY
  if (step === 2) {
    const heading =
      tier === "performance"
        ? "Where should the nurse come?"
        : tier === "essential"
          ? "Where do we send the kit?"
          : "Your details";
    return (
      <Card>
        <form
          key="step-details"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (tier !== "fusion" && dob && !parseDob(dob)) {
              setError("Date of birth should look like 14 / 03 / 1991.");
              return;
            }
            setStep(3);
          }}
          className="px-7 pb-7 pt-[30px]"
          noValidate
        >
          <div className={kickerCls}>{stepKicker(2)}</div>
          <h1 className="mb-5 font-serif text-[24px] font-normal leading-[1.15]">
            {heading}
          </h1>

          <label htmlFor="checkout-name" className={labelCls}>
            Name
          </label>
          <input
            id="checkout-name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Aoife Byrne"
            className={`${inputCls} mb-3`}
          />

          {member ? null : (
            <>
              <label htmlFor="checkout-email" className={labelCls}>
                Email
              </label>
              <input
                id="checkout-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="aoife@example.ie"
                className={`${inputCls} mb-3`}
              />
            </>
          )}

          {tier !== "fusion" ? (
            <>
              <label htmlFor="checkout-address" className={labelCls}>
                {tier === "performance" ? "Visit address" : "Delivery address"}
              </label>
              <input
                id="checkout-address"
                type="text"
                autoComplete="street-address"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={`14 Emmet Road, Inchicore, Dublin 8 · ${eircode.toUpperCase() || "D08 XY24"}`}
                className={`${inputCls} mb-3`}
              />

              <label htmlFor="checkout-dob" className={labelCls}>
                Date of birth{" "}
                <span className="font-normal text-caption">
                  · required by the lab
                </span>
              </label>
              <input
                id="checkout-dob"
                type="text"
                inputMode="numeric"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                placeholder="14 / 03 / 1991"
                className={`${inputCls} mb-[18px]`}
              />
            </>
          ) : null}

          {errorLine}
          <button type="submit" className={primaryBtnCls}>
            Continue to payment
          </button>
        </form>
      </Card>
    );
  }

  // W8 · STEP 3 — PAYMENT (STRIPE — MOCK: no card details leave the page)
  return (
    <Card>
      <form
        key="step-payment"
        onSubmit={(e) => {
          e.preventDefault();
          void handlePay();
        }}
        className="px-7 pb-7 pt-[30px]"
        noValidate
      >
        <div className={kickerCls}>STEP 3 OF 3 · PAYMENT</div>
        <h1 className="sr-only">Payment</h1>

        <div className="mb-4 rounded-[12px] border border-hairline-mid bg-white p-4">
          <div className="mb-[6px] flex justify-between text-[13.5px]">
            <span>{TIER_LABEL[tier]} membership · 1 year</span>
            <span className="font-mono">€{price.toFixed(2)}</span>
          </div>
          {tier === "essential" ? (
            <div className="mb-[6px] flex justify-between text-[12.5px] text-caption">
              <span>Kits, postage, lab &amp; clinician review</span>
              <span className="font-mono">Included</span>
            </div>
          ) : null}
          <div className="my-[10px] h-px bg-hairline" />
          <div className="flex justify-between text-[14px] font-bold">
            <span>Due today</span>
            <span className="font-mono">€{price.toFixed(2)}</span>
          </div>
          <p className="mt-[6px] text-[11.5px] text-caption">
            Renews {renewalLabel()} · reminder 30 days before
          </p>
        </div>

        {/* MOCK card form — never sent anywhere (docs/MOCKED_APIS.md §2). */}
        <label htmlFor="card-number" className="sr-only">
          Card number
        </label>
        <div className="mb-[10px] flex items-center justify-between rounded-[10px] border border-hairline-strong bg-white px-[14px] py-[11px]">
          <input
            id="card-number"
            type="text"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="4242 4242 4242 4242"
            className="w-full bg-transparent font-mono text-[13px] outline-none placeholder:text-[#7C887F]"
          />
          <span aria-hidden="true" className="text-[11px] text-caption">
            VISA
          </span>
        </div>
        <div className="mb-4 flex gap-[10px]">
          <label htmlFor="card-exp" className="sr-only">
            Expiry date
          </label>
          <input
            id="card-exp"
            type="text"
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="08 / 28"
            className="w-1/2 rounded-[10px] border border-hairline-strong bg-white px-[14px] py-[11px] font-mono text-[13px] outline-none placeholder:text-[#7C887F]"
          />
          <label htmlFor="card-cvc" className="sr-only">
            CVC
          </label>
          <input
            id="card-cvc"
            type="text"
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="CVC ···"
            className="w-1/2 rounded-[10px] border border-hairline-strong bg-white px-[14px] py-[11px] font-mono text-[13px] outline-none placeholder:text-[#7C887F]"
          />
        </div>

        {errorLine}
        {/* Apple Pay on the web — MOCK: same checkout session as the card. */}
        <button
          type="button"
          onClick={() => void handlePay()}
          disabled={busy}
          className="mb-[10px] block w-full cursor-pointer rounded-pill bg-ink py-[13px] text-center text-[14px] font-semibold text-white disabled:cursor-default disabled:opacity-60"
        >
           Pay — Apple Pay
        </button>
        <button type="submit" disabled={busy} className={`${primaryBtnCls} mb-3`}>
          {busy ? "Paying…" : `Pay €${price.toFixed(2)}`}
        </button>
        <p className="text-center text-[11.5px] text-caption">
          Full refund until your kit ships or your draw is booked.
        </p>
      </form>
    </Card>
  );
}
