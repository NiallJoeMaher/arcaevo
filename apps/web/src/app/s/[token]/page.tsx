import type { Metadata } from "next";
import { siteUrl } from "@/lib/api";
import { Orb } from "@/components/account/ui";
import PrintActions from "./PrintActions";

/**
 * G2 · WHAT THE GP SEES — arcaevo.com/s/… (design §15).
 *
 * Read-only, no account needed, IMC number visible — everything a GP needs
 * to trust it in a 10-minute consult. Deliberately NOT wrapped in SiteNav /
 * SiteFooter: this is a clinical document surface, not a marketing page.
 * The PDF is one tap away — generated fresh from this live page via the
 * print stylesheet. Revoked/expired links get the designed 410 state.
 */

export const metadata: Metadata = {
  title: "Clinician summary",
  robots: { index: false },
};

// Every open must hit the API (the access log the member sees) — never cache.
export const dynamic = "force-dynamic";

interface ShareRow {
  code: string;
  name: string;
  unit: string;
  previous: { value: number; takenAt: string } | null;
  current: { value: number; takenAt: string };
  rcvVerdict: "improved" | "no_real_change" | "worsened" | null;
  clinicianReviewed: boolean;
}

interface ShareData {
  member: { name: string };
  sharedAt: string;
  expiresAt: string;
  reviewedBy: string;
  labNote: string;
  rows: ShareRow[];
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat("en-IE", { day: "numeric", month: "short" })
    .format(new Date(value))
    .toUpperCase();
}

function monthYear(value: string): string {
  return new Intl.DateTimeFormat("en-IE", {
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

const VERDICT = {
  improved: { label: "Improved", cls: "text-forest" },
  no_real_change: { label: "No real change", cls: "text-caption" },
  worsened: { label: "Worsened", cls: "text-[#B3543A]" },
} as const;

function GoneState({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen w-full items-start justify-center bg-bone px-4 pt-24 font-sans text-ink">
      <div className="w-full max-w-[400px] rounded-[16px] border border-hairline-mid bg-surface p-7 shadow-[0_22px_44px_-32px_rgba(28,38,32,0.4)]">
        <div className="mb-[18px] flex items-center gap-[11px]">
          <Orb />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">
            Arcaevo
          </span>
        </div>
        <h1 className="mb-2 font-serif text-[24px] font-normal leading-[1.15]">
          This link is no longer live
        </h1>
        <p className="text-[13.5px] leading-[1.6] text-muted">{message}</p>
        <p className="mt-4 text-[11.5px] text-caption">
          Links expire after 30 days, or when the member revokes them — access
          is logged either way.
        </p>
      </div>
    </div>
  );
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let res: Response;
  try {
    res = await fetch(`${siteUrl()}/api/v1/share/${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
  } catch {
    return (
      <GoneState message="We couldn't load this summary — try again in a moment." />
    );
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return (
      <GoneState
        message={
          typeof data.message === "string"
            ? data.message
            : "This share link has been revoked or has expired. Ask the member for a fresh one."
        }
      />
    );
  }

  const data = (await res.json()) as ShareData;
  const rowCls =
    "grid grid-cols-[1.4fr_1fr_1fr_0.9fr] items-baseline gap-2 border-b border-hairline-soft px-3 py-2 text-[12.5px]";

  return (
    <div className="min-h-screen w-full bg-bone px-4 py-10 font-sans text-ink print:bg-white print:px-0 print:py-0">
      <main className="mx-auto w-full max-w-[640px] rounded-[16px] border border-hairline-mid bg-surface shadow-[0_22px_44px_-32px_rgba(28,38,32,0.4)] print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <div className="px-7 py-[26px]">
          <div className="mb-4 flex items-center gap-[11px]">
            <Orb size={16} />
            <span className="text-[14px] font-semibold tracking-[-0.01em]">
              Arcaevo
            </span>
          </div>

          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-[16px] font-bold">{data.member.name}</h1>
            <span className="font-mono text-[10px] text-caption">
              SHARED {shortDate(data.sharedAt)} · EXPIRES {shortDate(data.expiresAt)}
            </span>
          </div>
          <p className="mb-[18px] text-[12px] text-caption">
            {data.labNote} · reviewed by {data.reviewedBy}
          </p>

          <div
            className="mb-[6px] grid grid-cols-[1.4fr_1fr_1fr_0.9fr] gap-2 rounded-[8px] bg-bone-white px-3 py-2 text-[12px] font-bold"
            role="row"
          >
            <span>Marker</span>
            <span>Previous</span>
            <span>Current</span>
            <span>Verdict</span>
          </div>
          {data.rows.map((row) => {
            const verdict = row.rcvVerdict ? VERDICT[row.rcvVerdict] : null;
            const arrow = row.previous
              ? row.current.value < row.previous.value
                ? " ↓"
                : row.current.value > row.previous.value
                  ? " ↑"
                  : " →"
              : "";
            return (
              <div key={row.code} className={rowCls}>
                <span className="font-semibold">
                  {row.name}
                  <span className="ml-1 font-normal text-caption">{row.unit}</span>
                </span>
                <span className="font-mono">
                  {row.previous ? (
                    <>
                      {row.previous.value}
                      <span className="ml-1 text-[10.5px] text-caption">
                        {monthYear(row.previous.takenAt)}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </span>
                <span className={`font-mono ${verdict ? verdict.cls : ""}`}>
                  {row.current.value}
                  {arrow}
                  <span className="ml-1 text-[10.5px] text-caption">
                    {monthYear(row.current.takenAt)}
                  </span>
                </span>
                <span
                  className={`text-[11.5px] font-semibold ${verdict ? verdict.cls : "text-caption"}`}
                >
                  {verdict ? verdict.label : "First reading"}
                </span>
              </div>
            );
          })}

          <PrintActions />
        </div>
      </main>
    </div>
  );
}
