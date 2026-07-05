"use client";

/**
 * W4 · CONSENT — SHOWN ONCE, REVOCABLE ALWAYS (design §04).
 *
 * GDPR Article 9(2)(a): explicit, separate, revocable consent before we
 * process a single heartbeat — never bundled into the terms checkbox.
 * Three named purposes, one sentence each. The two required purposes are
 * pre-explained and fixed on; the optional one is OFF by default — the
 * pattern the DPC expects. Grants are stored versioned (wording version +
 * timestamp + surface) by POST /api/v1/consents.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, errorCls, primaryBtnCls } from "@/components/account/ui";

function RequiredCheck() {
  return (
    <span
      aria-hidden="true"
      className="mt-[1px] block h-4 w-4 shrink-0 rounded-[4px] border-[1.5px] border-forest bg-forest text-center text-[10px] leading-[15px] text-white"
    >
      ✓
    </span>
  );
}

export default function ConsentForm({ next }: { next: string }) {
  const router = useRouter();
  const [research, setResearch] = useState(false); // OFF by default (§04)
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/consents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surface: "web",
          grants: [
            { purpose: "health_processing", granted: true },
            { purpose: "clinician_review", granted: true },
            { purpose: "research", granted: research },
          ],
        }),
      });
      if (res.ok) {
        router.push(next);
        return;
      }
      if (res.status === 401) {
        router.push("/signin");
        return;
      }
      const data = await res.json().catch(() => ({}));
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

  return (
    <Card>
      <form onSubmit={handleSubmit} className="px-7 pb-7 pt-[30px]">
        <h1 className="mb-2 font-serif text-[24px] font-normal leading-[1.15]">
          Your health data, on your terms
        </h1>
        <p className="mb-5 text-[13px] leading-[1.55] text-caption">
          Before Arcaevo can read a blood result or a night&rsquo;s sleep, we
          need your explicit permission. You can withdraw it — and erase
          everything — at any time in Account.
        </p>

        {/* Required — fixed on. Withdrawal later = Account → Data & privacy. */}
        <div className="mb-[10px] flex items-start gap-[10px] rounded-[12px] border border-hairline-mid bg-white p-[14px]">
          <RequiredCheck />
          <div>
            <div className="text-[13px] font-bold">
              Process my health data{" "}
              <span className="ml-1 font-mono text-[9px] tracking-[0.08em] text-forest">
                REQUIRED
              </span>
            </div>
            <div className="mt-[3px] text-[12px] leading-[1.5] text-caption">
              Blood results, wearable metrics and the health profile I provide
              — to generate my baselines, insights and verdicts. Stored in the
              EU, never sold.
            </div>
          </div>
        </div>

        <div className="mb-[10px] flex items-start gap-[10px] rounded-[12px] border border-hairline-mid bg-white p-[14px]">
          <RequiredCheck />
          <div>
            <div className="text-[13px] font-bold">
              Clinician review{" "}
              <span className="ml-1 font-mono text-[9px] tracking-[0.08em] text-forest">
                REQUIRED FOR TESTS
              </span>
            </div>
            <div className="mt-[3px] text-[12px] leading-[1.5] text-caption">
              A registered clinician sees my results to sign them off — and
              contacts me directly if a value is critical.
            </div>
          </div>
        </div>

        <label className="mb-5 flex cursor-pointer items-start gap-[10px] rounded-[12px] border border-hairline-mid bg-white p-[14px]">
          <input
            type="checkbox"
            checked={research}
            onChange={(e) => setResearch(e.target.checked)}
            className="mt-[1px] h-4 w-4 shrink-0 accent-forest"
          />
          <span>
            <span className="block text-[13px] font-bold">
              Anonymised research{" "}
              <span className="ml-1 font-mono text-[9px] tracking-[0.08em] text-caption">
                OPTIONAL
              </span>
            </span>
            <span className="mt-[3px] block text-[12px] leading-[1.5] text-caption">
              De-identified data may improve Arcaevo&rsquo;s rules and ranges.
              Off by default.
            </span>
          </span>
        </label>

        <p aria-live="assertive" className={error ? errorCls : "sr-only"}>
          {error}
        </p>

        <button type="submit" disabled={busy} className={primaryBtnCls}>
          {busy ? "Saving…" : "Agree & continue"}
        </button>
        <p className="mt-3 text-center text-[11.5px] text-caption">
          Full details in our{" "}
          <Link href="/legal/gdpr-consent" className="text-caption underline">
            Health Data Notice
          </Link>{" "}
          · GDPR Art. 9(2)(a)
        </p>
        <p className="mt-1 text-center text-[11.5px] text-caption">
          Questions or to exercise your rights: privacy@arcaevo.com
        </p>
      </form>
    </Card>
  );
}
