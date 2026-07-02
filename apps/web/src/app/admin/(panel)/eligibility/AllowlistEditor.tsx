"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const MONO = "var(--font-mono)";

/**
 * Live routing-key chips + add form inside the dark ADM-2 card. Every edit
 * goes through POST /api/v1/admin/eligibility (the gate is config, not code)
 * so the changeLog history is written server-side.
 */
export default function AllowlistEditor({ keys }: { keys: string[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mutate(body: { add?: string[]; remove?: string[] }) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setDraft("");
        router.refresh();
      } else {
        const payload: { message?: string } | null = await res
          .json()
          .catch(() => null);
        setError(payload?.message ?? "Update failed.");
      }
    } catch {
      setError("Update failed — couldn't reach the server.");
    }
    setBusy(false);
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {keys.map((key) => (
          <span
            key={key}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontFamily: MONO,
              fontSize: 11,
              color: "#CFD6CF",
              background: "rgba(255,255,255,0.08)",
              borderRadius: 100,
              padding: "4px 6px 4px 10px",
            }}
          >
            {key}
            <button
              type="button"
              aria-label={`Remove ${key}`}
              title={`Remove ${key} from the allowlist`}
              onClick={() => mutate({ remove: [key] })}
              disabled={busy}
              style={{
                fontFamily: MONO,
                fontSize: 11,
                lineHeight: 1,
                width: 16,
                height: 16,
                borderRadius: "50%",
                border: "none",
                background: "rgba(255,255,255,0.1)",
                color: "#8FA89A",
                cursor: busy ? "default" : "pointer",
                padding: 0,
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) mutate({ add: [draft] });
        }}
        style={{ display: "flex", gap: 8, marginTop: 14 }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add routing key — D25, T12…"
          aria-label="Routing key to add"
          style={{
            flex: 1,
            fontFamily: MONO,
            fontSize: 12,
            textTransform: "uppercase",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.16)",
            borderRadius: 100,
            padding: "8px 14px",
            color: "#F4F1EA",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          style={{
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: 600,
            background: "#34A07C",
            color: "#04130D",
            border: "none",
            borderRadius: 100,
            padding: "8px 18px",
            cursor: busy || !draft.trim() ? "default" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? "Saving…" : "Add"}
        </button>
      </form>
      {error ? (
        <div style={{ fontSize: 11.5, color: "#E9BC85", marginTop: 10 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
