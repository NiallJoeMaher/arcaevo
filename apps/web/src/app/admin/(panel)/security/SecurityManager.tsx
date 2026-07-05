"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CSSProperties } from "react";
import { CARD, MONO, PILL } from "../chrome";

/**
 * Self-service TOTP MFA for the signed-in admin. Drives the owner-neutral API
 * routes (/api/v1/admin/mfa/setup|enable|disable), which act only on the
 * caller's own account. No QR-image dependency — the otpauth URI + the base32
 * key are shown as copyable text ("paste into your authenticator, or enter the
 * key"). Backup codes are shown ONCE, right after enabling.
 */

const INPUT: CSSProperties = {
  fontFamily: "inherit",
  fontSize: 14,
  background: "#fff",
  border: "1px solid rgba(28,38,32,0.16)",
  borderRadius: 8,
  padding: "10px 12px",
  color: "#1C2620",
  outline: "none",
};

const PRIMARY_BTN: CSSProperties = {
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 600,
  background: "#1C2620",
  color: "#F4F1EA",
  border: "none",
  borderRadius: 8,
  padding: "10px 20px",
  cursor: "pointer",
};

const GHOST_BTN: CSSProperties = {
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 600,
  background: "rgba(200,80,60,0.12)",
  color: "#B5483A",
  border: "none",
  borderRadius: 8,
  padding: "10px 20px",
  cursor: "pointer",
};

const LABEL: CSSProperties = {
  fontFamily: MONO,
  fontSize: 10,
  letterSpacing: "0.06em",
  color: "#7C887F",
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

export default function SecurityManager({
  email,
  mfaEnabled: initialEnabled,
}: {
  email: string;
  mfaEnabled: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Enrolment state.
  const [setup, setSetup] = useState<Setup | null>(null);
  const [enableCode, setEnableCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  // Disable state.
  const [showDisable, setShowDisable] = useState(false);
  const [disableCode, setDisableCode] = useState("");

  async function beginSetup() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setBackupCodes(null);
    try {
      const res = await fetch("/api/v1/admin/mfa/setup", { method: "POST" });
      if (!res.ok) {
        const p = await res.json().catch(() => null);
        setError(p?.message ?? "Couldn't start MFA setup.");
      } else {
        setSetup(await res.json());
        setEnableCode("");
      }
    } catch {
      setError("Couldn't reach the server.");
    }
    setBusy(false);
  }

  async function confirmEnable(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !setup) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/mfa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: setup.secret, code: enableCode.trim() }),
      });
      const p = await res.json().catch(() => null);
      if (!res.ok) {
        setError(p?.message ?? "Couldn't enable MFA.");
      } else {
        setBackupCodes(p.backupCodes ?? []);
        setEnabled(true);
        setSetup(null);
        setEnableCode("");
        router.refresh();
      }
    } catch {
      setError("Couldn't reach the server.");
    }
    setBusy(false);
  }

  async function confirmDisable(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: disableCode.trim() || undefined }),
      });
      const p = await res.json().catch(() => null);
      if (!res.ok) {
        setError(p?.message ?? "Couldn't disable MFA.");
      } else {
        setEnabled(false);
        setShowDisable(false);
        setDisableCode("");
        setBackupCodes(null);
        router.refresh();
      }
    } catch {
      setError("Couldn't reach the server.");
    }
    setBusy(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 620 }}>
      {/* Status card ---------------------------------------------------------- */}
      <div style={{ ...CARD, padding: 22 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              Two-factor authentication (TOTP)
            </div>
            <div style={{ fontSize: 12.5, color: "#5E6B63", marginTop: 4 }}>
              Protects <span style={{ fontFamily: MONO }}>{email}</span>. An
              authenticator app generates a 6-digit code you enter after your
              password.
            </div>
          </div>
          <span style={enabled ? PILL.vitality : PILL.neutral}>
            {enabled ? "ON" : "OFF"}
          </span>
        </div>
      </div>

      {error ? (
        <div
          style={{
            ...CARD,
            padding: "12px 18px",
            borderLeft: "4px solid #B5483A",
            fontSize: 13,
            color: "#B5483A",
          }}
        >
          {error}
        </div>
      ) : null}

      {/* Backup codes (shown once, right after enabling) --------------------- */}
      {backupCodes ? (
        <div
          style={{ ...CARD, padding: 22, borderLeft: "4px solid #D99A4E" }}
        >
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
            Save your backup codes now
          </div>
          <div style={{ fontSize: 12.5, color: "#5E6B63", marginBottom: 14 }}>
            Each code works once, if you lose your authenticator. They are shown
            only this once — store them somewhere safe.
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            {backupCodes.map((c) => (
              <div key={c} style={CODE_BLOCK}>
                {c}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Enrolment / management --------------------------------------------- */}
      {!enabled ? (
        setup ? (
          <div style={{ ...CARD, padding: 22 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              Add Arcaevo to your authenticator
            </div>
            <div style={{ fontSize: 12.5, color: "#5E6B63", marginBottom: 14 }}>
              Paste this link into an authenticator that accepts otpauth URIs, or
              enter the key by hand. Then type the current 6-digit code to
              confirm.
            </div>

            <div style={{ display: "grid", gap: 5, marginBottom: 14 }}>
              <span style={LABEL}>OTPAUTH URI</span>
              <div style={CODE_BLOCK}>{setup.otpauthUri}</div>
            </div>
            <div style={{ display: "grid", gap: 5, marginBottom: 18 }}>
              <span style={LABEL}>SETUP KEY (BASE32)</span>
              <div style={CODE_BLOCK}>{setup.secret}</div>
            </div>

            <form
              onSubmit={confirmEnable}
              style={{ display: "flex", gap: 10, alignItems: "end" }}
            >
              <label style={{ display: "grid", gap: 5, flex: 1 }}>
                <span style={LABEL}>6-digit code</span>
                <input
                  value={enableCode}
                  onChange={(e) => setEnableCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  style={{ ...INPUT, letterSpacing: "0.2em" }}
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                style={{ ...PRIMARY_BTN, opacity: busy ? 0.6 : 1 }}
              >
                {busy ? "Enabling…" : "Enable MFA"}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={beginSetup}
              disabled={busy}
              style={{ ...PRIMARY_BTN, opacity: busy ? 0.6 : 1 }}
            >
              {busy ? "Starting…" : "Set up two-factor auth"}
            </button>
          </div>
        )
      ) : (
        <div style={{ ...CARD, padding: 22 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
            Turn off two-factor auth
          </div>
          <div style={{ fontSize: 12.5, color: "#5E6B63", marginBottom: 14 }}>
            Enter a current authenticator or backup code to disable MFA on your
            account.
          </div>
          {!showDisable ? (
            <button
              type="button"
              onClick={() => setShowDisable(true)}
              style={GHOST_BTN}
            >
              Disable MFA
            </button>
          ) : (
            <form
              onSubmit={confirmDisable}
              style={{ display: "flex", gap: 10, alignItems: "end" }}
            >
              <label style={{ display: "grid", gap: 5, flex: 1 }}>
                <span style={LABEL}>Authenticator or backup code</span>
                <input
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  autoComplete="one-time-code"
                  placeholder="123456"
                  style={{ ...INPUT, letterSpacing: "0.2em" }}
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                style={{ ...GHOST_BTN, opacity: busy ? 0.6 : 1 }}
              >
                {busy ? "Disabling…" : "Confirm disable"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
