"use client";

/**
 * W3 · SIGN IN — arcaevo.com/signin (design §03).
 *
 * The magic link is a first-class button, not a footnote — it doubles as
 * passwordless recovery. Edge states per §03:
 *  - Wrong password → inline error under the field, magic-link button
 *    promoted: "Or skip the password — we'll email you a link."
 *  - Five failures → 15-minute cool-off (server 429, message verbatim).
 *  - Forgot? → password reset via the same inbox screen as W2; the emailed
 *    link lands on /verify?token=…&reset=1.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CodeForm from "@/components/account/CodeForm";
import InboxCard from "@/components/account/InboxCard";
import {
  Card,
  Orb,
  errorCls,
  inputCls,
  labelCls,
  primaryBtnCls,
  secondaryBtnCls,
} from "@/components/account/ui";

type Sent = { purpose: "signin" | "reset" } | null;

export default function SigninForm({
  initialEmail = "",
  codeFirst = false,
}: {
  initialEmail?: string;
  codeFirst?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [passwordFailed, setPasswordFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Sent>(null);
  // Prefetch-safe fallback: type the code from the email instead of the link.
  const [codeMode, setCodeMode] = useState(codeFirst);

  function requireEmail(): boolean {
    if (email) return true;
    setError("Enter your email first.");
    return false;
  }

  async function handlePassword(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push(data.needsConsent ? "/consent" : "/account");
        return;
      }
      // 401 wrong password / 429 cool-off — verbatim server copy either way.
      setPasswordFailed(true);
      setError(
        typeof data.message === "string"
          ? data.message
          : "That didn't work — check the details, or skip the password and we'll email you a link."
      );
    } catch {
      setError("Something went wrong — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMagicLink() {
    if (!requireEmail()) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "signin" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok || res.status === 429) {
        setSent({ purpose: "signin" });
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

  async function handleForgot() {
    if (!requireEmail()) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok || res.status === 429) {
        setSent({ purpose: "reset" });
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

  if (codeMode) {
    return <CodeForm initialEmail={email} onBack={() => setCodeMode(false)} />;
  }

  if (sent) {
    return (
      <InboxCard
        email={email}
        purpose={sent.purpose}
        onEdit={() => setSent(null)}
      />
    );
  }

  return (
    <Card>
      <form onSubmit={handlePassword} className="px-7 pb-7 pt-[30px]" noValidate>
        <div className="mb-[18px]">
          <Orb />
        </div>
        <h1 className="mb-[22px] font-serif text-[24px] font-normal leading-[1.15]">
          Welcome back
        </h1>

        <label htmlFor="signin-email" className={labelCls}>
          Email
        </label>
        <input
          id="signin-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="aoife@example.ie"
          className={inputCls}
        />

        <div className="mb-[6px] flex items-center justify-between">
          <label htmlFor="signin-password" className="text-[12px] font-semibold">
            Password
          </label>
          <button
            type="button"
            onClick={handleForgot}
            disabled={busy}
            className="cursor-pointer text-[12px] font-semibold text-forest"
          >
            Forgot?
          </button>
        </div>
        <input
          id="signin-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••"
          aria-describedby="signin-error"
          className={`${inputCls} mb-4`}
        />

        <p
          id="signin-error"
          aria-live="assertive"
          className={error ? errorCls : "sr-only"}
        >
          {error}
        </p>

        <button
          type="submit"
          disabled={busy}
          className={`${primaryBtnCls} mb-[10px]`}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {/* Wrong password promotes the magic link (§03 edge state). */}
        <button
          type="button"
          onClick={handleMagicLink}
          disabled={busy}
          className={
            passwordFailed
              ? `${primaryBtnCls} mb-[14px] bg-ink`
              : `${secondaryBtnCls} mb-[14px]`
          }
        >
          {passwordFailed
            ? "Or skip the password — we'll email you a link."
            : "✉  Email me a sign-in link instead"}
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setCodeMode(true);
          }}
          className="mb-[14px] block w-full cursor-pointer text-center text-[12.5px] font-semibold text-forest"
        >
          Enter a code instead
        </button>
        <p className="text-center text-[12.5px] text-caption">
          New here?{" "}
          <Link href="/join" className="font-semibold text-forest no-underline">
            Create an account
          </Link>
        </p>
      </form>
    </Card>
  );
}
