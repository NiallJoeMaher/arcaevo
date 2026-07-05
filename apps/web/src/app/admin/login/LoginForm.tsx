"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const MONO = "var(--font-mono)";

export default function LoginForm({ basePath }: { basePath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Second-factor step: shown only when step 1 returns { mfaRequired: true }.
  // The bootstrap password path (no MFA) redirects straight to the dashboard,
  // exactly as before (keeps the e2e password login unchanged).
  const [mfaRequired, setMfaRequired] = useState(false);
  const [code, setCode] = useState("");

  function goToDashboard() {
    router.push(basePath);
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Email is optional: submit it only when filled so a password-only entry
      // still takes the bootstrap OWNER path (unchanged for the e2e flow).
      const trimmedEmail = email.trim();
      const res = await fetch("/api/v1/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          trimmedEmail ? { email: trimmedEmail, password } : { password }
        ),
      });
      if (res.ok) {
        const data: {
          ok?: boolean;
          mfaRequired?: boolean;
          enrollMfaRequired?: boolean;
        } = await res.json().catch(() => ({}));
        if (data.enrollMfaRequired) {
          // Password verified but this account has no MFA — enrolment is
          // MANDATORY. No session yet; go set up two-factor auth.
          router.push(`${basePath}/enroll-mfa`);
          router.refresh();
          return;
        }
        if (data.mfaRequired) {
          // Password verified; a second factor is now required. No session yet.
          setMfaRequired(true);
          setBusy(false);
          return;
        }
        goToDashboard();
        return;
      }
      setError(
        res.status === 401
          ? "Wrong password."
          : "Sign-in is unavailable right now — check the server logs."
      );
      setBusy(false);
    } catch {
      setError("Sign-in is unavailable right now — check the server logs.");
      setBusy(false);
    }
  }

  async function onSubmitMfa(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/login/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (res.ok) {
        goToDashboard();
        return;
      }
      setError(
        res.status === 401
          ? "That code didn't work. Try again, or use a backup code."
          : "Sign-in is unavailable right now — check the server logs."
      );
      setBusy(false);
    } catch {
      setError("Sign-in is unavailable right now — check the server logs.");
      setBusy(false);
    }
  }

  if (mfaRequired) {
    return (
      <form
        onSubmit={onSubmitMfa}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div style={{ fontSize: 13, color: "#4A554D", lineHeight: 1.5 }}>
          Enter the 6-digit code from your authenticator app, or a backup code.
        </div>
        <label style={{ display: "block" }}>
          <span
            style={{
              display: "block",
              fontSize: 12,
              color: "#7C887F",
              marginBottom: 6,
            }}
          >
            Authenticator or backup code
          </span>
          <input
            type="text"
            name="code"
            inputMode="text"
            autoComplete="one-time-code"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            style={{
              width: "100%",
              background: "#EDE9E1",
              border: "1px solid rgba(28,38,32,0.12)",
              borderRadius: 10,
              padding: "12px 14px",
              fontFamily: MONO,
              fontSize: 14,
              letterSpacing: "0.2em",
              color: "#1C2620",
              outline: "none",
            }}
          />
        </label>
        {error ? (
          <div style={{ fontSize: 13, color: "#B5483A", fontWeight: 600 }}>
            {error}
          </div>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          style={{
            background: "#1E5C45",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "inherit",
            padding: "12px 16px",
            border: "none",
            borderRadius: 100,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? "Verifying…" : "Verify"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label style={{ display: "block" }}>
        <span
          style={{
            display: "block",
            fontSize: 12,
            color: "#7C887F",
            marginBottom: 6,
          }}
        >
          Email <span style={{ color: "#A9B2AA" }}>(optional)</span>
        </span>
        <input
          type="email"
          name="email"
          autoComplete="username"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            background: "#EDE9E1",
            border: "1px solid rgba(28,38,32,0.12)",
            borderRadius: 10,
            padding: "12px 14px",
            fontFamily: MONO,
            fontSize: 14,
            color: "#1C2620",
            outline: "none",
          }}
        />
      </label>
      <label style={{ display: "block" }}>
        <span
          style={{
            display: "block",
            fontSize: 12,
            color: "#7C887F",
            marginBottom: 6,
          }}
        >
          Password
        </span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            background: "#EDE9E1",
            border: "1px solid rgba(28,38,32,0.12)",
            borderRadius: 10,
            padding: "12px 14px",
            fontFamily: MONO,
            fontSize: 14,
            color: "#1C2620",
            outline: "none",
          }}
        />
      </label>
      {error ? (
        <div style={{ fontSize: 13, color: "#B5483A", fontWeight: 600 }}>
          {error}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        style={{
          background: "#1E5C45",
          color: "#fff",
          fontSize: 14,
          fontWeight: 600,
          fontFamily: "inherit",
          padding: "12px 16px",
          border: "none",
          borderRadius: 100,
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
