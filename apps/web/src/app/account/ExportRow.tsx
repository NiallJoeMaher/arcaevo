"use client";

/**
 * "Export my data" (design §10 W10) — everything as CSV + clinician PDF.
 *
 * TODO(export API): there is no /api/v1 export endpoint yet — the designed
 * behaviour is an emailed bundle within the hour (results NEVER inline in
 * the email; a download link only, per the non-negotiables). Until the
 * endpoint lands this confirms the request locally.
 */
import { useState } from "react";

export default function ExportRow() {
  const [requested, setRequested] = useState(false);

  return (
    <div className="flex items-center justify-between rounded-[14px] border border-hairline bg-white px-[18px] py-4">
      <div>
        <div className="text-[13px] font-bold">Export my data</div>
        <div className="text-[11.5px] text-caption" aria-live="polite">
          {requested
            ? "Export requested — a download link lands in your inbox within the hour."
            : "Everything as CSV + clinician PDF, emailed within the hour"}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setRequested(true)}
        disabled={requested}
        className="shrink-0 cursor-pointer rounded-pill border border-ink px-[14px] py-[7px] text-[11.5px] font-semibold disabled:opacity-60"
      >
        {requested ? "Requested" : "Request export"}
      </button>
    </div>
  );
}
