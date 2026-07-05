"use client";

/**
 * W1 · CREATE ACCOUNT — arcaevo.com/join (design §03).
 *
 * One field to start; the password is optional — a magic link covers
 * everyone. Edge states per §03:
 *  - Email already registered → the server response is IDENTICAL either way
 *    (non-revealing), so this screen simply shows "check your inbox"; the
 *    inbox owner gets a sign-in link instead of a verify link.
 *  - Resend throttle (60s) → server message surfaced under the resend button.
 *  - Expired / used links and password reset are handled on /verify.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import InboxCard from "@/components/account/InboxCard";
import {
  Card,
  Orb,
  errorCls,
  inputCls,
  labelCls,
  primaryBtnCls,
} from "@/components/account/ui";

export default function JoinForm({
  initialRef = null,
}: {
  /** Referral code from `/join?ref=<code>` — attributed at signup. */
  initialRef?: string | null;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  // Validate the referral code so we only show the "invited" banner for a real
  // code. The code is still POSTed to signup regardless — an unknown code is
  // ignored server-side, so a stale banner never blocks anyone.
  const [invited, setInvited] = useState(false);

  useEffect(() => {
    if (!initialRef) return;
    let cancelled = false;
    fetch(`/api/v1/referral/resolve?code=${encodeURIComponent(initialRef)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setInvited(Boolean(d?.valid));
      })
      .catch(() => {
        /* validation is cosmetic — ignore failures */
      });
    return () => {
      cancelled = true;
    };
  }, [initialRef]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!agreed) {
      setError("Please confirm you're over 18 and agree to the Terms.");
      return;
    }
    if (password && password.length < 10) {
      setError(
        "Passwords need at least 10 characters — or leave it blank and we'll email you a link instead."
      );
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          ...(password ? { password } : {}),
          ...(initialRef ? { ref: initialRef } : {}),
          surface: "web",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSent(true);
      } else {
        setError(
          typeof data.message === "string"
            ? data.message
            : "Something went wrong — try again in a moment."
        );
      }
    } catch {
      setError("Something went wrong — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <InboxCard email={email} purpose="signup" onEdit={() => setSent(false)} />
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="px-7 pb-7 pt-[30px]" noValidate>
        <div className="mb-[18px]">
          <Orb />
        </div>
        <h1 className="mb-[6px] font-serif text-[24px] font-normal leading-[1.15]">
          Create your account
        </h1>
        <p className="mb-[22px] text-[13px] text-caption">
          Free. No card, no commitment — Dublin or not.
        </p>

        {invited && (
          <p className="mb-[22px] rounded-[10px] bg-forest/10 px-3 py-2 text-[12.5px] font-semibold text-forest">
            You&rsquo;ve been invited — a free month lands on your first year
            when you join.
          </p>
        )}

        <label htmlFor="join-email" className={labelCls}>
          Email
        </label>
        <input
          id="join-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="aoife@example.ie"
          className={inputCls}
        />

        <label htmlFor="join-password" className={labelCls}>
          Password{" "}
          <span className="font-normal text-caption">
            · optional — we can email you a link instead
          </span>
        </label>
        <input
          id="join-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••"
          className={`${inputCls} mb-4`}
        />

        <label className="mb-4 flex items-start gap-[9px]">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-[2px] h-[15px] w-[15px] shrink-0 accent-forest"
          />
          <span className="text-[12px] leading-[1.5] text-muted">
            I&rsquo;m over 18 and agree to the{" "}
            <Link href="/legal/terms" className="text-muted underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="text-muted underline">
              Privacy Policy
            </Link>
          </span>
        </label>

        <p aria-live="assertive" className={error ? errorCls : "sr-only"}>
          {error}
        </p>

        <button type="submit" disabled={busy} className={`${primaryBtnCls} mb-[14px]`}>
          {busy ? "Creating…" : "Create account"}
        </button>
        <p className="text-center text-[12.5px] text-caption">
          Already a member?{" "}
          <Link href="/signin" className="font-semibold text-forest no-underline">
            Sign in
          </Link>
        </p>
      </form>
    </Card>
  );
}
