"use client";

/**
 * Prefetch-safe sign-in code entry (Phase 21). The human types the short code
 * from their email — immune to virus-scanner link prefetching, which can burn
 * a single-use magic link before it's ever clicked. POSTs { email, code } to
 * the same verify endpoint as the link, routing on success exactly like the
 * link path. Used by /signin ("Enter a code instead") and /verify (offered
 * when the link is expired/used/invalid).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  errorCls,
  inputCls,
  labelCls,
  primaryBtnCls,
} from "@/components/account/ui";

/** Uppercase, keep only the unambiguous alphabet, group as XXX-XXX (max 6). */
export function formatCodeInput(raw: string): string {
  const cleaned = raw
    .toUpperCase()
    .replace(/[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g, "")
    .slice(0, 6);
  return cleaned.length > 3 ? `${cleaned.slice(0, 3)}-${cleaned.slice(3)}` : cleaned;
}

export default function CodeForm({
  initialEmail = "",
  onBack,
}: {
  initialEmail?: string;
  onBack?: () => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!email) {
      setError("Enter your email so we know which code to check.");
      return;
    }
    if (code.replace(/-/g, "").length !== 6) {
      setError("The code is six characters, like KX4-9WP.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/auth/magic-link/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.replace(data.needsConsent ? "/consent" : "/account");
        return;
      }
      setError(
        typeof data.message === "string"
          ? data.message
          : "That code isn't valid — check it, or ask for a fresh sign-in email."
      );
    } catch {
      setError("Something went wrong — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="px-7 pb-7 pt-[30px]" noValidate>
        <h1 className="mb-[6px] font-serif text-[24px] font-normal leading-[1.15]">
          Enter your code
        </h1>
        <p className="mb-[22px] text-[13px] leading-[1.55] text-caption">
          The six-character code from your email works even when the link
          doesn&rsquo;t. It&rsquo;s good for 30 minutes.
        </p>

        <label htmlFor="code-email" className={labelCls}>
          Email
        </label>
        <input
          id="code-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="aoife@example.ie"
          className={inputCls}
        />

        <label htmlFor="code-input" className={labelCls}>
          Code
        </label>
        <input
          id="code-input"
          type="text"
          inputMode="text"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          required
          value={code}
          onChange={(e) => setCode(formatCodeInput(e.target.value))}
          placeholder="KX4-9WP"
          aria-describedby="code-error"
          className={`${inputCls} text-center font-mono text-[18px] tracking-[0.18em]`}
        />

        <p id="code-error" aria-live="assertive" className={error ? errorCls : "sr-only"}>
          {error}
        </p>

        <button type="submit" disabled={busy} className={primaryBtnCls}>
          {busy ? "Signing in…" : "Sign in with code"}
        </button>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="mt-3 block w-full cursor-pointer text-center text-[12.5px] font-semibold text-forest"
          >
            Use the link instead
          </button>
        ) : null}
      </form>
    </Card>
  );
}
