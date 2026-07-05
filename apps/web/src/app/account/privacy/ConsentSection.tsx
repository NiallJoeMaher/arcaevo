"use client";

/**
 * Account → Data & privacy: the same three switches from the consent gate
 * (design §04), plus the honest exit (§10 W11).
 *
 * - research / clinician_review toggle freely → POST /api/v1/consents
 *   (append-only, versioned trail; grant and withdraw are both POSTs).
 * - Turning off health_processing (the required purpose) opens the honest
 *   exit — full export offered first, then type-DELETE arming. Executing
 *   calls POST /api/v1/account/delete, which records the withdrawal, revokes
 *   every session, queues real erasure (+30 days) and sends the confirmation
 *   email. The "erasure started" confirmation only shows AFTER that succeeds.
 */
import { useState } from "react";

const PURPOSES = [
  {
    key: "health_processing" as const,
    title: "Process my health data",
    tag: "REQUIRED",
    desc: "Blood results, wearable metrics and the health profile I provide — to generate my baselines, insights and verdicts. Stored in the EU, never sold.",
  },
  {
    key: "clinician_review" as const,
    title: "Clinician review",
    tag: "REQUIRED FOR TESTS",
    desc: "A registered clinician sees my results to sign them off — and contacts me directly if a value is critical.",
  },
  {
    key: "research" as const,
    title: "Anonymised research",
    tag: "OPTIONAL",
    desc: "De-identified data may improve Arcaevo's rules and ranges. Off by default.",
  },
];

type Grants = Record<"health_processing" | "clinician_review" | "research", boolean>;

export default function ConsentSection({ initial }: { initial: Grants }) {
  const [grants, setGrants] = useState<Grants>(initial);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [armText, setArmText] = useState("");
  const [closureStarted, setClosureStarted] = useState(false);
  const [exportState, setExportState] = useState<
    "idle" | "working" | "done" | "error"
  >("idle");

  /**
   * The "export first" step — a REAL GDPR Art. 20 download before erasure
   * (GAP_REVIEW_2 #8). Hits GET /api/v1/account/export (member-auth via the
   * session cookie) and saves the machine-readable JSON. Nothing is emailed.
   */
  async function downloadExport() {
    setExportState("working");
    try {
      const res = await fetch("/api/v1/account/export", {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        setExportState("error");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const filename =
        match?.[1] ??
        `arcaevo-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportState("done");
    } catch {
      setExportState("error");
    }
  }

  async function post(purpose: keyof Grants, value: boolean) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/v1/consents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surface: "web",
          grants: [{ purpose, granted: value }],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setGrants((g) => ({ ...g, [purpose]: value }));
        if (data.closureRequired) setClosureStarted(true);
        else setNotice("Saved — your consent trail keeps every decision, dated and versioned.");
      } else {
        setNotice(
          typeof data.message === "string"
            ? data.message
            : "Something went wrong — try again in a moment."
        );
      }
    } catch {
      setNotice("Something went wrong — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  function handleToggle(purpose: keyof Grants) {
    const next = !grants[purpose];
    if (purpose === "health_processing" && !next) {
      // Withdrawing the required purpose = the account-closure flow (§10).
      setDeleteOpen(true);
      return;
    }
    void post(purpose, next);
  }

  /**
   * The real deletion. Records the withdrawal, revokes every session, queues
   * erasure (+30 days) and sends the confirmation email — server-side. Only
   * show the "erasure started" confirmation AFTER the endpoint returns ok.
   */
  async function deleteAccount() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/v1/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surface: "web" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setGrants((g) => ({ ...g, health_processing: false }));
        setClosureStarted(true);
      } else {
        setNotice(
          typeof data.message === "string"
            ? data.message
            : "We couldn't start the deletion — try again in a moment."
        );
      }
    } catch {
      setNotice("We couldn't start the deletion — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  if (closureStarted) {
    return (
      <section className="mb-4 rounded-[16px] border border-[rgba(217,154,78,0.4)] bg-surface p-6" aria-live="polite">
        <h2 className="mb-2 font-serif text-[22px] font-normal leading-[1.15]">
          Account closure started
        </h2>
        <p className="text-[13px] leading-[1.6] text-muted">
          Your consent withdrawal is recorded. Your results, baselines,
          history and profile will be erased permanently — from our systems
          and our lab partners&rsquo; — within 30 days. A confirmation email
          with the erasure date is on its way; remaining membership value is
          refunded pro-rata for unused tests.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-4">
      <h2 className="mb-2 text-[13.5px] font-bold">Your consents</h2>
      <p className="mb-3 text-[12px] leading-[1.5] text-caption">
        The same three switches you saw at sign-up. You can withdraw any of
        them — and erase everything — at any time.
      </p>

      {PURPOSES.map((p) => (
        <div
          key={p.key}
          className="mb-[10px] flex items-start justify-between gap-[14px] rounded-[12px] border border-hairline-mid bg-white p-[14px]"
        >
          <div>
            <div className="text-[13px] font-bold">
              {p.title}{" "}
              <span
                className={`ml-1 font-mono text-[9px] tracking-[0.08em] ${
                  p.tag === "OPTIONAL" ? "text-caption" : "text-forest"
                }`}
              >
                {p.tag}
              </span>
            </div>
            <div className="mt-[3px] text-[12px] leading-[1.5] text-caption">
              {p.desc}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={grants[p.key]}
            aria-label={p.title}
            disabled={busy}
            onClick={() => handleToggle(p.key)}
            className={`relative mt-[2px] h-5 w-[34px] shrink-0 cursor-pointer rounded-pill transition-colors ${
              grants[p.key] ? "bg-forest" : "bg-[rgba(28,38,32,0.18)]"
            }`}
          >
            <span
              className={`absolute top-[2px] h-4 w-4 rounded-full bg-white transition-all ${
                grants[p.key] ? "left-[16px]" : "left-[2px]"
              }`}
            />
          </button>
        </div>
      ))}

      <p aria-live="polite" className={notice ? "mb-3 text-[12px] text-caption" : "sr-only"}>
        {notice}
      </p>

      <p className="mb-4 text-[12px] leading-[1.5] text-caption">
        To access, export, erase or object to how we use your data, use the
        controls here or email our privacy team at privacy@arcaevo.com — we
        respond within one month.
      </p>

      {/* W11 · DELETE ACCOUNT — THE HONEST EXIT (§10) */}
      <div className="mt-5 rounded-[16px] border border-[rgba(217,154,78,0.4)] bg-surface p-6">
        <h2 className="mb-2 font-serif text-[22px] font-normal leading-[1.15]">
          Delete your account and data
        </h2>
        <p className="mb-4 text-[13px] leading-[1.6] text-muted">
          This erases your results, baselines, history and profile permanently
          — from our systems and our lab partners&rsquo; — within 30 days. It
          cannot be undone.
        </p>
        <div className="mb-[14px] flex items-start gap-[10px]">
          <span className="font-mono text-[11px] text-forest">01</span>
          <span className="text-[12.5px] leading-[1.5]">
            We offer a full export first — a machine-readable JSON of everything
            we hold about you.{" "}
            <button
              type="button"
              onClick={() => void downloadExport()}
              disabled={exportState === "working"}
              className="cursor-pointer font-semibold text-forest underline disabled:no-underline disabled:opacity-70"
            >
              {exportState === "working"
                ? "Preparing…"
                : exportState === "done"
                  ? "Downloaded ✓ — download again"
                  : exportState === "error"
                    ? "Couldn't export — retry"
                    : "Download my data"}
            </button>
          </span>
        </div>
        <div className="mb-[14px] flex items-start gap-[10px]">
          <span className="font-mono text-[11px] text-forest">02</span>
          <span className="text-[12.5px] leading-[1.5]">
            Type <strong>DELETE</strong> to confirm — no password quiz, no
            phone call.
          </span>
        </div>
        <div className="mb-[18px] flex items-start gap-[10px]">
          <span className="font-mono text-[11px] text-forest">03</span>
          <span className="text-[12.5px] leading-[1.5]">
            Confirmation email with the erasure date. Remaining membership
            value refunded pro-rata for unused tests.
          </span>
        </div>

        {deleteOpen ? (
          <div>
            <label htmlFor="delete-confirm" className="mb-[6px] block text-[12px] font-semibold">
              Type DELETE to confirm
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={armText}
              onChange={(e) => setArmText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              className="mb-3 block w-full rounded-[10px] border border-hairline-strong bg-white px-[14px] py-[11px] font-mono text-[13px] tracking-[0.08em]"
            />
            <button
              type="button"
              disabled={armText.trim() !== "DELETE" || busy}
              onClick={() => void deleteAccount()}
              className="block w-full cursor-pointer rounded-pill border border-[#B3543A] py-3 text-center text-[13.5px] font-semibold text-[#B3543A] disabled:cursor-default disabled:opacity-40"
            >
              Delete everything
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="block w-full cursor-pointer rounded-pill border border-[#B3543A] py-3 text-center text-[13.5px] font-semibold text-[#B3543A]"
          >
            Delete everything
          </button>
        )}
      </div>
    </section>
  );
}
