"use client";

/**
 * arcaevo.com/verify (design §03 W2 + edge states).
 *
 * Three jobs, one URL — the address every auth email points at:
 *  1. ?token=…          → redeem the magic link (verify/sign-in), then route:
 *                         needsConsent → /consent, else /account.
 *  2. ?token=…&reset=1  → password reset: ask for the new password, POST
 *                         /api/v1/auth/reset/confirm (signs out all other
 *                         sessions), then → /account.
 *  3. no token          → the plain "check your inbox" screen (W2).
 *
 * Expired/used link → the designed edge state: "That link has expired — they
 * only live 30 minutes." One button: send a fresh one. Email pre-filled from
 * ?email= when present, nothing to retype.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import InboxCard from "@/components/account/InboxCard";
import {
  Card,
  errorCls,
  inputCls,
  labelCls,
  primaryBtnCls,
} from "@/components/account/ui";

type Phase =
  | { name: "verifying" }
  | { name: "reset_form" }
  | { name: "expired"; message: string }
  | { name: "inbox" }
  | { name: "resent"; email: string };

export default function VerifyClient({
  token,
  reset,
  email,
}: {
  token: string | null;
  reset: boolean;
  email: string | null;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(() => {
    if (!token) return { name: "inbox" };
    if (reset) return { name: "reset_form" };
    return { name: "verifying" };
  });
  const [resendEmail, setResendEmail] = useState(email ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fired = useRef(false);

  // 1. Plain magic-link redemption — fire once on mount.
  useEffect(() => {
    if (!token || reset || fired.current) return;
    fired.current = true;
    (async () => {
      try {
        const res = await fetch("/api/v1/auth/magic-link/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          router.replace(data.needsConsent ? "/consent" : "/account");
          return;
        }
        setPhase({
          name: "expired",
          message:
            typeof data.message === "string"
              ? data.message
              : "That link has expired — they only live 30 minutes.",
        });
      } catch {
        setPhase({
          name: "expired",
          message: "Something went wrong — try again in a moment.",
        });
      }
    })();
  }, [token, reset, router]);

  // 2. Password reset confirm.
  async function handleReset(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (newPassword.length < 10) {
      setError("Passwords need at least 10 characters.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/auth/reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.replace("/account");
        return;
      }
      if (res.status === 401) {
        setPhase({
          name: "expired",
          message:
            typeof data.message === "string"
              ? data.message
              : "That link has expired — they only live 30 minutes.",
        });
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

  // Expired/used link → one button: send a fresh one.
  async function handleFresh(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!resendEmail) {
      setError("Enter your email and we'll send a fresh link.");
      return;
    }
    setBusy(true);
    try {
      const res = reset
        ? await fetch("/api/v1/auth/reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: resendEmail }),
          })
        : await fetch("/api/v1/auth/magic-link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: resendEmail, purpose: "signin" }),
          });
      const data = await res.json().catch(() => ({}));
      if (res.ok || res.status === 429) {
        setPhase({ name: "resent", email: resendEmail });
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

  if (phase.name === "verifying") {
    return (
      <Card>
        <div className="px-7 py-[38px] text-center">
          <h1 className="mb-[10px] font-serif text-[24px] font-normal leading-[1.15]">
            One moment
          </h1>
          <p aria-live="polite" className="text-[13.5px] leading-[1.6] text-muted">
            Checking your link…
          </p>
        </div>
      </Card>
    );
  }

  if (phase.name === "reset_form") {
    return (
      <Card>
        <form onSubmit={handleReset} className="px-7 pb-7 pt-[30px]" noValidate>
          <h1 className="mb-[6px] font-serif text-[24px] font-normal leading-[1.15]">
            Set a new password
          </h1>
          <p className="mb-[22px] text-[13px] leading-[1.55] text-caption">
            All other sessions will be signed out, and we&rsquo;ll email a
            confirmation — so you always know when it changes.
          </p>
          <label htmlFor="reset-password" className={labelCls}>
            New password
          </label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••••"
            className={`${inputCls} mb-4`}
          />
          <p aria-live="assertive" className={error ? errorCls : "sr-only"}>
            {error}
          </p>
          <button type="submit" disabled={busy} className={primaryBtnCls}>
            {busy ? "Saving…" : "Save new password"}
          </button>
        </form>
      </Card>
    );
  }

  if (phase.name === "expired") {
    return (
      <Card>
        <form onSubmit={handleFresh} className="px-7 pb-7 pt-[30px]" noValidate>
          <h1 className="mb-[10px] font-serif text-[24px] font-normal leading-[1.15]">
            That link has expired
          </h1>
          <p aria-live="polite" className="mb-[22px] text-[13.5px] leading-[1.6] text-muted">
            {phase.message}
          </p>
          <label htmlFor="fresh-email" className={labelCls}>
            Email
          </label>
          <input
            id="fresh-email"
            type="email"
            autoComplete="email"
            required
            value={resendEmail}
            onChange={(e) => setResendEmail(e.target.value)}
            placeholder="aoife@example.ie"
            className={`${inputCls} mb-4`}
          />
          <p aria-live="assertive" className={error ? errorCls : "sr-only"}>
            {error}
          </p>
          <button type="submit" disabled={busy} className={primaryBtnCls}>
            {busy ? "Sending…" : "Send a fresh one"}
          </button>
        </form>
      </Card>
    );
  }

  if (phase.name === "resent") {
    return <InboxCard email={phase.email} purpose={reset ? "reset" : "signin"} />;
  }

  // 3. No token — the plain W2 screen (direct visit).
  if (email) {
    return <InboxCard email={email} purpose="signin" />;
  }
  return (
    <Card>
      <form onSubmit={handleFresh} className="px-7 py-[38px] text-center" noValidate>
        <div
          aria-hidden="true"
          className="mx-auto mb-[18px] h-[52px] w-[52px] rounded-full bg-[rgba(52,160,124,0.14)] text-center text-[22px] leading-[52px] text-forest"
        >
          ✉
        </div>
        <h1 className="mb-[10px] font-serif text-[24px] font-normal leading-[1.15]">
          Check your inbox
        </h1>
        <p className="mb-[22px] text-[13.5px] leading-[1.6] text-muted">
          Follow the link we emailed you — it&rsquo;s valid for 30 minutes.
          Need another one?
        </p>
        <label htmlFor="verify-email" className="sr-only">
          Email
        </label>
        <input
          id="verify-email"
          type="email"
          autoComplete="email"
          required
          value={resendEmail}
          onChange={(e) => setResendEmail(e.target.value)}
          placeholder="aoife@example.ie"
          className={`${inputCls} text-center`}
        />
        <p aria-live="assertive" className={error ? errorCls : "sr-only"}>
          {error}
        </p>
        <button type="submit" disabled={busy} className={primaryBtnCls}>
          {busy ? "Sending…" : "Resend email"}
        </button>
      </form>
    </Card>
  );
}
