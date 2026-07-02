"use client";

/**
 * W2 · VERIFY — CHECK YOUR INBOX (design §03). One pattern, learned once:
 * the same screen serves sign-up verification, magic-link sign-in and
 * password reset. Resend is throttled server-side to once per 60s.
 */
import { useState } from "react";
import { Card, secondaryBtnCls } from "@/components/account/ui";

type ResendPurpose = "signup" | "signin" | "reset";

async function resend(email: string, purpose: ResendPurpose) {
  if (purpose === "signup") {
    // Signup is non-revealing + idempotent: existing addresses get an E2
    // sign-in link instead — the right resend either way.
    return fetch("/api/v1/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  }
  if (purpose === "reset") {
    return fetch("/api/v1/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  }
  return fetch("/api/v1/auth/magic-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, purpose: "signin" }),
  });
}

export default function InboxCard({
  email,
  purpose = "signin",
  onEdit,
  headingId,
}: {
  email: string;
  purpose?: ResendPurpose;
  /** "Wrong address? Edit it" — return to the form. */
  onEdit?: () => void;
  /** Pass an id when the page's H1 lives inside this card. */
  headingId?: string;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleResend() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await resend(email, purpose);
      const data = await res.json().catch(() => ({}));
      setNotice(
        typeof data.message === "string"
          ? data.message
          : "A fresh link is on its way."
      );
    } catch {
      setNotice("Something went wrong — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="px-7 py-[38px] text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-[18px] h-[52px] w-[52px] rounded-full bg-[rgba(52,160,124,0.14)] text-center text-[22px] leading-[52px] text-forest"
        >
          ✉
        </div>
        <h1
          id={headingId}
          className="mb-[10px] font-serif text-[24px] font-normal leading-[1.15]"
        >
          Check your inbox
        </h1>
        <p className="mb-[22px] text-[13.5px] leading-[1.6] text-muted">
          We&rsquo;ve sent a confirmation link to
          <br />
          <strong>{email}</strong>. It&rsquo;s valid for 30 minutes.
        </p>
        <button
          type="button"
          onClick={handleResend}
          disabled={busy}
          className={secondaryBtnCls}
        >
          Resend email
        </button>
        <p aria-live="polite" className="min-h-[18px] pt-3 text-[12px] text-caption">
          {notice}
        </p>
        {onEdit ? (
          <p className="text-[12px] text-caption">
            Wrong address?{" "}
            <button
              type="button"
              onClick={onEdit}
              className="cursor-pointer font-semibold text-forest"
            >
              Edit it
            </button>
          </p>
        ) : null}
      </div>
    </Card>
  );
}
