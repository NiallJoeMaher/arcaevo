"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

/**
 * Mandatory TOTP enrolment flow (no QR-image dependency — the otpauth URI + the
 * base32 key are shown as copyable text). Drives the enrol-cookie-authorised
 * routes /api/v1/admin/mfa/enroll/{setup,complete}. On success the complete
 * route seals the secret AND issues the admin session; we then show the backup
 * codes once and let the admin continue to the dashboard.
 */

const MONO = "var(--font-mono)";

const INPUT: CSSProperties = {
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
};

const PRIMARY_BTN: CSSProperties = {
  background: "#1E5C45",
  color: "#fff",
  fontSize: 14,
  fontWeight: 600,
  fontFamily: "inherit",
  padding: "12px 16px",
  border: "none",
  borderRadius: 100,
  cursor: "pointer",
};

const LABEL: CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#7C887F",
  marginBottom: 6,
};

const CODE_BLOCK: CSSProperties = {
  fontFamily: MONO,
  fontSize: 12.5,
  background: "#EDE9E1",
  border: "1px solid rgba(28,38,32,0.12)",
  borderRadius: 8,
  padding: "10px 12px",
  wordBreak: "break-all",
  color: "#1C2620",
};

type Setup = { secret: string; otpauthUri: string };

export default function EnrollMfaForm({
  dashboardPath,
}: {
  dashboardPath: string;
}) {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  // Fetch a fresh secret as soon as the (already-authorised-by-enrol-cookie)
  // page mounts, so the admin sees the key + URI immediately.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/admin/mfa/enroll/setup", {
          method: "POST",
        });
        if (res.status === 401) {
          // Enrol window expired / cookie gone — restart from sign-in.
          router.push(`${dashboardPath}/login`);
          return;
        }
        if (!res.ok) {
          setError("Couldn't start MFA setup. Reload and try again.");
          return;
        }
        const data: Setup = await res.json();
        if (!cancelled) setSetup(data);
      } catch {
        if (!cancelled) setError("Couldn't reach the server.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dashboardPath, router]);

  async function onConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !setup) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/mfa/enroll/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: setup.secret, code: code.trim() }),
      });
      const p = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          p?.message ?? "That code didn't work. Check your authenticator."
        );
        setBusy(false);
        return;
      }
      // Session is now issued server-side. Show backup codes once, then let the
      // admin continue.
      setBackupCodes(p.backupCodes ?? []);
      setBusy(false);
    } catch {
      setError("Sign-in is unavailable right now — check the server logs.");
      setBusy(false);
    }
  }

  if (backupCodes) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{
            ...CODE_BLOCK,
            borderLeft: "4px solid #D99A4E",
            background: "#FBFAF6",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
            Save your backup codes now
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 12.5,
              color: "#5E6B63",
              letterSpacing: "normal",
            }}
          >
            Each works once if you lose your authenticator. Shown only this once.
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {backupCodes.map((c) => (
            <div key={c} style={CODE_BLOCK}>
              {c}
            </div>
          ))}
        </div>
        <button
          type="button"
          style={PRIMARY_BTN}
          onClick={() => {
            router.push(dashboardPath);
            router.refresh();
          }}
        >
          Continue to dashboard
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onConfirm}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div>
        <span style={LABEL}>OTPAUTH URI</span>
        <div style={CODE_BLOCK}>
          {setup ? setup.otpauthUri : "Generating…"}
        </div>
      </div>
      <div>
        <span style={LABEL}>SETUP KEY (BASE32)</span>
        <div style={CODE_BLOCK}>{setup ? setup.secret : "…"}</div>
      </div>
      <label style={{ display: "block" }}>
        <span style={LABEL}>6-digit code from your authenticator</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
          style={INPUT}
        />
      </label>
      {error ? (
        <div style={{ fontSize: 13, color: "#B5483A", fontWeight: 600 }}>
          {error}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={busy || !setup}
        style={{ ...PRIMARY_BTN, opacity: busy || !setup ? 0.7 : 1 }}
      >
        {busy ? "Confirming…" : "Confirm & sign in"}
      </button>
    </form>
  );
}
