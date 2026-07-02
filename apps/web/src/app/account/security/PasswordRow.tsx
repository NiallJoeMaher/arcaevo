"use client";

/**
 * Password set/change (design §17 W12). Changing goes through the reset
 * link flow — POST /api/v1/auth/reset emails a 30-minute link to
 * /verify?token=…&reset=1, and saving the new password signs out every
 * other session. No separate change-password endpoint to maintain.
 */
import { useState } from "react";

export default function PasswordRow({
  email,
  hasPassword,
}: {
  email: string;
  hasPassword: boolean;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleChange() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/v1/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      setNotice(
        typeof data.message === "string"
          ? data.message
          : "Check your inbox — the link is valid for 30 minutes."
      );
    } catch {
      setNotice("Something went wrong — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3 rounded-[14px] border border-hairline bg-white px-[18px] py-4">
      <div className="flex items-center justify-between gap-[14px]">
        <div>
          <div className="mb-[2px] text-[13.5px] font-bold">Password</div>
          <div className="text-[12px] text-caption">
            {hasPassword
              ? "Set"
              : "Not set — a magic link covers everything"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleChange()}
          disabled={busy}
          className="shrink-0 cursor-pointer rounded-pill border border-[rgba(28,38,32,0.2)] px-4 py-2 text-[12px] font-semibold disabled:opacity-60"
        >
          {hasPassword ? "Change" : "Set one"}
        </button>
      </div>
      <p aria-live="polite" className={notice ? "mt-2 text-[12px] text-caption" : "sr-only"}>
        {notice}
      </p>
    </div>
  );
}
