import type { Metadata } from "next";
import {
  CARD,
  DbDownNotice,
  EmptyDbNotice,
  MONO,
  PanelBody,
  SERIF,
  Topbar,
} from "../chrome";
import {
  formatDayMonth,
  loadWaitlistDemand,
  type WaitlistDemandData,
} from "../data";

/**
 * /admin/waitlist — "Where do we open next?" (design_handoff_v2 §18 ADM-1).
 * Waitlist demand aggregated by county: signups, top routing keys, oldest
 * entry. Expansion decisions come from here, not from gut feel.
 */

export const metadata: Metadata = { title: "Waitlist demand" };
export const dynamic = "force-dynamic";

const ROW_GRID = "1.3fr 0.7fr 1.5fr 1fr";

/** The 1,000-signup line from the design — crossing it triggers the
 * courier-partner checklist and the "you're up" send (§14 X5). */
const OPEN_LINE = 1000;

export default async function AdminWaitlistPage() {
  const data = await loadWaitlistDemand();

  return (
    <>
      <Topbar kicker="EXPANSION" title="Waitlist demand" />
      <PanelBody>
        {data === null ? (
          <DbDownNotice />
        ) : data.total === 0 ? (
          <EmptyDbNotice />
        ) : (
          <Demand data={data} />
        )}
      </PanelBody>
    </>
  );
}

function Demand({ data }: { data: WaitlistDemandData }) {
  const top = data.counties[0];
  const oldest = data.counties.reduce(
    (min, c) => (c.oldest < min ? c.oldest : min),
    data.counties[0].oldest
  );
  const maxCount = top.count;

  const kpis: { label: string; value: string; sub?: string }[] = [
    { label: "TOTAL SIGNUPS", value: data.total.toLocaleString("en-IE") },
    { label: "COUNTIES WAITING", value: String(data.counties.length) },
    {
      label: "TOP COUNTY",
      value: top.county,
      sub: `${top.count.toLocaleString("en-IE")} signups`,
    },
    { label: "OLDEST ENTRY", value: formatDayMonth(oldest) },
  ];

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 16,
          marginBottom: 20,
        }}
      >
        {kpis.map((k) => (
          <div key={k.label} style={{ ...CARD, padding: 20 }}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: "0.08em",
                color: "#7C887F",
              }}
            >
              {k.label}
            </div>
            <div
              style={{
                fontFamily: SERIF,
                fontSize: 38,
                lineHeight: 1.1,
                margin: "8px 0 2px",
              }}
            >
              {k.value}
            </div>
            {k.sub ? (
              <div style={{ fontSize: 12.5, color: "#1E7D57", fontWeight: 600 }}>
                {k.sub}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16 }}
      >
        {/* Dark demand card — reproduced from §18 ADM-1. */}
        <div
          style={{
            background: "#1C2620",
            color: "#F4F1EA",
            borderRadius: 18,
            padding: 24,
            alignSelf: "start",
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.12em",
              color: "#7FD3AE",
              marginBottom: 14,
            }}
          >
            ADM-1 · WAITLIST DEMAND
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
            Where do we open next?
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 14,
            }}
          >
            {data.counties.map((c) => (
              <div key={c.county}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{c.county}</span>
                  <span style={{ fontFamily: MONO, color: "#7FD3AE" }}>
                    {c.count.toLocaleString("en-IE")}
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 100,
                    background: "rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    style={{
                      // The design's busiest county caps at 86% of the track.
                      width: `${Math.max(2, Math.round((c.count / maxCount) * 86))}%`,
                      height: "100%",
                      borderRadius: 100,
                      background: "#34A07C",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: "#9FB0A6",
              lineHeight: 1.55,
              borderTop: "1px solid rgba(255,255,255,0.1)",
              paddingTop: 12,
            }}
          >
            {top.count >= OPEN_LINE ? (
              <>
                {top.county} crosses the 1,000-signup line → triggers the
                courier-partner checklist and the &ldquo;{top.county},
                you&rsquo;re up&rdquo; send.
              </>
            ) : (
              <>
                {top.county} leads at{" "}
                <span style={{ color: "#7FD3AE" }}>
                  {top.count.toLocaleString("en-IE")}
                </span>
                . Crossing the 1,000-signup line triggers the courier-partner
                checklist and the &ldquo;{top.county}, you&rsquo;re up&rdquo;
                send.
              </>
            )}
          </div>
        </div>

        {/* County table — count, top routing keys, oldest entry. */}
        <div style={{ ...CARD, overflow: "hidden", alignSelf: "start" }}>
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
            <span>COUNTY</span>
            <span>SIGNUPS</span>
            <span>TOP ROUTING KEYS</span>
            <span>OLDEST ENTRY</span>
          </div>
          {data.counties.map((c) => (
            <div
              key={c.county}
              style={{
                display: "grid",
                gridTemplateColumns: ROW_GRID,
                gap: 12,
                padding: "15px 22px",
                borderBottom: "1px solid rgba(28,38,32,0.07)",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>{c.county}</span>
              <span style={{ fontFamily: MONO, fontSize: 13, color: "#1E5C45" }}>
                {c.count.toLocaleString("en-IE")}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 12, color: "#4A554D" }}>
                {c.topKeys
                  .map((k) => (k.count > 1 ? `${k.key} ×${k.count}` : k.key))
                  .join(" · ")}
              </span>
              <span style={{ fontSize: 13, color: "#4A554D" }}>
                {formatDayMonth(c.oldest)}
              </span>
            </div>
          ))}
          <div
            style={{
              padding: "13px 22px",
              fontSize: 12,
              color: "#7C887F",
              lineHeight: 1.55,
            }}
          >
            Waitlist entries store the routing key only — never a full Eircode
            or address. Rejected checkout checks are logged separately on the{" "}
            <a href="/admin/eligibility" style={{ color: "#1E5C45" }}>
              Eligibility
            </a>{" "}
            view.
          </div>
        </div>
      </div>
    </>
  );
}
