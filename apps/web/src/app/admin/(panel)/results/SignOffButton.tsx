"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * "Sign off" — approves every reading in the panel by POSTing each one to
 * /api/v1/admin/results/[id]/review (the review action deliberately goes
 * through the API route so it's exercised end-to-end).
 */
export default function SignOffButton({ readingIds }: { readingIds: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOff() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const responses = await Promise.all(
        readingIds.map((id) =>
          fetch(`/api/v1/admin/results/${id}/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reviewed: true }),
          })
        )
      );
      if (responses.every((r) => r.ok)) {
        router.refresh();
        return;
      }
      setFailed(true);
      setBusy(false);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={signOff}
      disabled={busy}
      style={{
        background: "#1E5C45",
        color: "#fff",
        fontSize: 12.5,
        fontWeight: 600,
        fontFamily: "inherit",
        padding: "9px 16px",
        borderRadius: 100,
        textAlign: "center",
        cursor: busy ? "default" : "pointer",
        border: "none",
        opacity: busy ? 0.7 : 1,
      }}
    >
      {busy ? "Signing off…" : failed ? "Retry sign off" : "Sign off"}
    </button>
  );
}
