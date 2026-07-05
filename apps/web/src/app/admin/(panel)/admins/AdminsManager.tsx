"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { AdminRole } from "@/lib/models";
import type { AdminAccountRow } from "../data";
import { CARD, MONO, PILL } from "../chrome";

/**
 * Owner-only admin management. Renders the accounts table + an add form, and
 * drives every mutation through the owner-gated API routes
 * (POST /api/v1/admin/admins, .../[id]/disable|enable|role). The server is
 * authoritative on the self-lockout / last-owner guards; the buttons here only
 * mirror them so the affordance is clear (disabled + a tooltip) before a click.
 */

const ROLE_OPTIONS: { value: AdminRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "ops", label: "Ops" },
  { value: "clinician", label: "Clinician" },
];

const ROLE_LABEL: Record<AdminRole, string> = {
  owner: "Owner",
  ops: "Ops",
  clinician: "Clinician",
};

const ROLE_PILL: Record<AdminRole, CSSProperties> = {
  owner: PILL.forest,
  ops: PILL.neutral,
  clinician: PILL.amber,
};

const ROW_GRID = "1.6fr 0.9fr 0.9fr 1fr 1.4fr";

const INPUT: CSSProperties = {
  fontFamily: "inherit",
  fontSize: 13,
  background: "#fff",
  border: "1px solid rgba(28,38,32,0.16)",
  borderRadius: 8,
  padding: "9px 12px",
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
  padding: "9px 18px",
  cursor: "pointer",
};

function formatDate(d: Date): string {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminsManager({
  admins,
  currentAdminId,
}: {
  admins: AdminAccountRow[];
  currentAdminId: string | null;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add-admin form state.
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AdminRole>("ops");
  const [password, setPassword] = useState("");

  const enabledOwners = useMemo(
    () => admins.filter((a) => a.role === "owner" && !a.disabledAt).length,
    [admins]
  );

  async function call(url: string, body?: unknown): Promise<boolean> {
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (res.ok) {
        router.refresh();
        return true;
      }
      const payload: { message?: string } | null = await res
        .json()
        .catch(() => null);
      setError(payload?.message ?? "Update failed.");
      return false;
    } catch {
      setError("Update failed — couldn't reach the server.");
      return false;
    }
  }

  async function addAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (busyId) return;
    setBusyId("__new__");
    const ok = await call("/api/v1/admin/admins", {
      email: email.trim(),
      name: name.trim() || undefined,
      role,
      password,
    });
    if (ok) {
      setEmail("");
      setName("");
      setRole("ops");
      setPassword("");
    }
    setBusyId(null);
  }

  async function rowAction(id: string, url: string, body?: unknown) {
    if (busyId) return;
    setBusyId(id);
    await call(url, body);
    setBusyId(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Add-admin form ------------------------------------------------------ */}
      <div style={{ ...CARD, padding: 22 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
          Add an admin
        </div>
        <div style={{ fontSize: 12.5, color: "#5E6B63", marginBottom: 16 }}>
          Creates a per-admin account with a scrypt-hashed password. Share the
          temporary password out of band; the admin can be disabled any time.
        </div>
        <form
          onSubmit={addAdmin}
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1.1fr 0.8fr 1fr auto",
            gap: 10,
            alignItems: "end",
          }}
        >
          <label style={{ display: "grid", gap: 5 }}>
            <span style={LABEL}>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="new.admin@arcaevo.local"
              style={INPUT}
            />
          </label>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={LABEL}>Name (optional)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              style={INPUT}
            />
          </label>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={LABEL}>Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AdminRole)}
              style={INPUT}
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={LABEL}>Temp password</span>
            <input
              type="password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="≥ 10 characters"
              style={INPUT}
            />
          </label>
          <button
            type="submit"
            disabled={busyId === "__new__"}
            style={{
              ...PRIMARY_BTN,
              opacity: busyId === "__new__" ? 0.6 : 1,
              cursor: busyId === "__new__" ? "default" : "pointer",
            }}
          >
            {busyId === "__new__" ? "Adding…" : "Add admin"}
          </button>
        </form>
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

      {/* Accounts table ------------------------------------------------------ */}
      <div style={{ ...CARD, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: ROW_GRID,
            gap: 12,
            padding: "14px 22px",
            background: "#1C2620",
            color: "#8FA89A",
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.08em",
          }}
        >
          <span>ADMIN</span>
          <span>ROLE</span>
          <span>STATUS</span>
          <span>CREATED</span>
          <span>ACTIONS</span>
        </div>
        {admins.map((a) => {
          const isSelf = a.id === currentAdminId;
          const isDisabled = Boolean(a.disabledAt);
          const isLastOwner =
            a.role === "owner" && !isDisabled && enabledOwners <= 1;
          const busy = busyId === a.id;
          // Mirror the server guards as disabled buttons + a reason tooltip.
          const disableReason = isSelf
            ? "You can't disable your own account."
            : isLastOwner
              ? "Can't disable the last enabled owner."
              : null;
          const roleLocked = isLastOwner
            ? "Can't change the role of the last enabled owner."
            : null;

          return (
            <div
              key={a.id}
              style={{
                display: "grid",
                gridTemplateColumns: ROW_GRID,
                gap: 12,
                padding: "15px 22px",
                borderBottom: "1px solid rgba(28,38,32,0.07)",
                alignItems: "center",
                opacity: isDisabled ? 0.62 : 1,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {a.name ?? a.email}
                  {isSelf ? (
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: 9,
                        color: "#7C887F",
                        marginLeft: 8,
                      }}
                    >
                      YOU
                    </span>
                  ) : null}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#7C887F",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {a.email}
                </div>
              </div>

              <div>
                <select
                  value={a.role}
                  disabled={busy || Boolean(roleLocked)}
                  title={roleLocked ?? "Change role"}
                  onChange={(e) =>
                    rowAction(a.id, `/api/v1/admin/admins/${a.id}/role`, {
                      role: e.target.value as AdminRole,
                    })
                  }
                  style={{
                    ...INPUT,
                    padding: "6px 8px",
                    fontSize: 12,
                    ...ROLE_PILL[a.role],
                    borderRadius: 8,
                    cursor: roleLocked ? "not-allowed" : "pointer",
                  }}
                  aria-label={`Role for ${a.email}`}
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {ROLE_LABEL[o.value]}
                    </option>
                  ))}
                </select>
              </div>

              <span style={isDisabled ? PILL.red : PILL.vitality}>
                {isDisabled ? "Disabled" : "Active"}
              </span>

              <span style={{ fontSize: 13, color: "#4A554D" }}>
                {formatDate(a.createdAt)}
              </span>

              <div style={{ display: "flex", gap: 8 }}>
                {isDisabled ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      rowAction(a.id, `/api/v1/admin/admins/${a.id}/enable`)
                    }
                    style={{
                      ...SMALL_BTN,
                      background: "rgba(52,160,124,0.16)",
                      color: "#1E7D57",
                    }}
                  >
                    {busy ? "…" : "Enable"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy || Boolean(disableReason)}
                    title={disableReason ?? "Disable this admin"}
                    onClick={() =>
                      rowAction(a.id, `/api/v1/admin/admins/${a.id}/disable`)
                    }
                    style={{
                      ...SMALL_BTN,
                      background: "rgba(200,80,60,0.12)",
                      color: "#B5483A",
                      cursor: disableReason ? "not-allowed" : "pointer",
                      opacity: disableReason ? 0.5 : 1,
                    }}
                  >
                    {busy ? "…" : "Disable"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const LABEL: CSSProperties = {
  fontFamily: MONO,
  fontSize: 10,
  letterSpacing: "0.06em",
  color: "#7C887F",
};

const SMALL_BTN: CSSProperties = {
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 600,
  border: "none",
  borderRadius: 7,
  padding: "7px 14px",
  cursor: "pointer",
};
