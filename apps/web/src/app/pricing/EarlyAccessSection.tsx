"use client";

import { useState } from "react";
import Link from "next/link";

type Plan = "Essential" | "Performance" | "Either";
const PLAN_CHIPS: Plan[] = ["Essential", "Performance", "Either"];

/**
 * Early-access gate for the tested plans (EMPTY_STATES.md + Pricing.dc.html
 * earlyAccessMode). Rendered only while BLOOD_TIERS_ENABLED is off. Posts to
 * the real waitlist — same promise as the in-app waitlist: one email on area
 * opening, founding-member pricing honoured.
 */
export default function EarlyAccessSection() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [eircode, setEircode] = useState("");
  const [plan, setPlan] = useState<Plan>("Essential");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          eircode,
          name: name || undefined,
          planInterest: plan.toLowerCase() as
            | "essential"
            | "performance"
            | "either",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof body.message === "string"
            ? body.message
            : "Something went wrong — try again."
        );
        return;
      }
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  const confirm =
    plan === "Either" ? "Noted for both tested plans." : `Noted for ${plan}.`;

  return (
    <section
      id="early-access"
      className="mx-auto max-w-[1100px] scroll-mt-24 px-[22px] py-6 md:px-10"
    >
      <div className="grid gap-10 rounded-[22px] bg-ink px-[26px] py-9 text-bone-white md:grid-cols-2 md:px-10 md:py-11">
        <div>
          <div className="mb-4 font-mono text-xs tracking-[0.14em] text-[#E9BC85]">
            EARLY ACCESS · TESTED PLANS
          </div>
          <h2 className="mb-4 mt-0 font-serif text-[clamp(28px,3.4vw,36px)] font-normal leading-[1.08] tracking-[-0.01em]">
            Kits and nurses are almost ready.
          </h2>
          <p className="mb-5 mt-0 text-[15px] leading-[1.6] text-[#CFD6CF]">
            Essential and Performance go on sale when every courier route, lab
            slot and nurse rota runs flawlessly — we&apos;d rather you wait a
            few weeks than have a kit sit in a depot. Leave your details and
            you get the first booking window when your area opens.
          </p>
          <div className="mb-5 flex flex-wrap gap-2">
            {[
              "FIRST BOOKING WINDOW",
              "FOUNDING-MEMBER PRICING",
              "NO CARD · NO COMMITMENT",
            ].map((pill) => (
              <span
                key={pill}
                className="rounded-pill border border-[rgba(127,211,174,0.3)] px-3 py-[6px] font-mono text-[10px] tracking-[0.06em] text-vitality-light"
              >
                {pill}
              </span>
            ))}
          </div>
          <p className="m-0 text-sm">
            Want to start today?{" "}
            <Link
              href="/join"
              className="font-semibold text-vitality-light no-underline"
            >
              Fusion is live everywhere →
            </Link>
          </p>
        </div>

        {sent ? (
          <div className="motion-confirm self-center rounded-[18px] border border-[rgba(52,160,124,0.35)] bg-[rgba(52,160,124,0.1)] px-[30px] py-9 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-vitality text-2xl text-[#04130D]">
              ✓
            </div>
            <h3 className="mb-2 mt-0 font-serif text-[26px] font-normal">
              You&apos;re on the list.
            </h3>
            <p className="mb-4 mt-0 text-sm leading-[1.6] text-[#CFD6CF]">
              {confirm}{" "}
              We&apos;ll email once — with your booking window and
              founding-member pricing — the moment your area opens.
            </p>
            <div className="font-mono text-[10px] tracking-[0.08em] text-vitality-light">
              CONFIRMATION SENT · MONTHLY PROGRESS NOTES OPTIONAL
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="text-[13px] font-medium">
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Aoife Byrne"
                autoComplete="name"
                className="mt-1 w-full rounded-xl border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.06)] px-4 py-[13px] text-sm text-bone-white outline-none placeholder:text-[rgba(244,241,234,0.4)] focus:border-vitality"
              />
            </label>
            <label className="text-[13px] font-medium">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="aoife@example.ie"
                autoComplete="email"
                className="mt-1 w-full rounded-xl border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.06)] px-4 py-[13px] text-sm text-bone-white outline-none placeholder:text-[rgba(244,241,234,0.4)] focus:border-vitality"
              />
            </label>
            <label className="text-[13px] font-medium">
              Eircode{" "}
              <span className="font-normal text-[#8FA89A]">
                · routing key only — so we open your area in order of demand
              </span>
              <input
                required
                value={eircode}
                onChange={(e) => setEircode(e.target.value)}
                placeholder="D08"
                className="mt-1 w-full rounded-xl border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.06)] px-4 py-[13px] font-mono text-sm text-bone-white outline-none placeholder:text-[rgba(244,241,234,0.4)] focus:border-vitality"
              />
            </label>
            <div className="text-[13px] font-medium">
              Which plan?
              <div className="mt-2 flex flex-wrap gap-2">
                {PLAN_CHIPS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlan(p)}
                    aria-pressed={plan === p}
                    className={`rounded-pill border px-4 py-2 text-[13px] font-medium transition-colors duration-[220ms] ${
                      plan === p
                        ? "border-[rgba(52,160,124,0.7)] bg-[rgba(52,160,124,0.16)] text-vitality-light"
                        : "border-[rgba(255,255,255,0.16)] bg-transparent text-[#CFD6CF]"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            {error && (
              <p className="m-0 text-[13px] text-[#E9BC85]" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="mt-1 rounded-pill bg-vitality px-6 py-[13px] text-[15px] font-bold text-[#04130D] transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              Join the early-access list
            </button>
            <p className="m-0 text-center text-xs text-[#8FA89A]">
              One email when your area opens. Nothing else, ever.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
