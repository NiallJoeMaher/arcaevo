"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const MONO = "var(--font-mono)";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push("/admin");
        router.refresh();
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
          Password
        </span>
        <input
          type="password"
          name="password"
          autoFocus
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
