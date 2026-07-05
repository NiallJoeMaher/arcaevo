"use client";

/**
 * "Export my data" (design §10 W10) — a REAL GDPR Art. 20 download.
 *
 * Hits GET /api/v1/account/export (member-auth via the session cookie, sent
 * automatically) and saves the returned machine-readable JSON to the device.
 * NOTHING is emailed — health data is an authenticated in-app download only
 * (project non-negotiable). Satisfies GAP_REVIEW_2 #8.
 */
import { useState } from "react";

type Status = "idle" | "working" | "done" | "error";

export default function ExportRow() {
  const [status, setStatus] = useState<Status>("idle");

  async function download() {
    setStatus("working");
    try {
      const res = await fetch("/api/v1/account/export", {
        method: "GET",
        // Send the member session cookie.
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const blob = await res.blob();
      // Prefer the server-supplied filename; fall back to a dated default.
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const filename =
        match?.[1] ?? `arcaevo-my-data-${new Date().toISOString().slice(0, 10)}.json`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  const subtitle =
    status === "done"
      ? "Downloaded — a machine-readable JSON of everything we hold about you."
      : status === "error"
        ? "Couldn't build the export just now — please try again in a moment."
        : status === "working"
          ? "Building your export…"
          : "Everything we hold about you, as a machine-readable JSON download";

  return (
    <div className="flex items-center justify-between rounded-[14px] border border-hairline bg-white px-[18px] py-4">
      <div>
        <div className="text-[13px] font-bold">Export my data</div>
        <div className="text-[11.5px] text-caption" aria-live="polite">
          {subtitle}
        </div>
      </div>
      <button
        type="button"
        onClick={() => void download()}
        disabled={status === "working"}
        className="shrink-0 cursor-pointer rounded-pill border border-ink px-[14px] py-[7px] text-[11.5px] font-semibold disabled:opacity-60"
      >
        {status === "working"
          ? "Preparing…"
          : status === "done"
            ? "Download again"
            : "Download"}
      </button>
    </div>
  );
}
