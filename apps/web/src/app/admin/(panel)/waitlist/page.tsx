import type { Metadata } from "next";
import { adminPath } from "@/lib/admin-path";
import {
  CARD,
  DbDownNotice,
  EmptyDbNotice,
  MONO,
  PILL,
  PanelBody,
  SERIF,
  Topbar,
} from "../chrome";
import {
  formatDateTime,
  formatDayMonth,
  loadWaitlistDemand,
  type WaitlistDemandData,
} from "../data";
import type { WaitlistEntry } from "@/lib/models";

/**
 * /admin/waitlist — "Where do we open next?" (design_handoff_v2 §18 ADM-1).
 * Waitlist demand aggregated by county: signups, top routing keys, oldest
 * entry. Expansion decisions come from here, not from gut feel.
 *
 * Task 7b adds "People on the list" below the aggregates — the individual
 * entries (newest first, capped at 200 on screen) plus a CSV export of the
 * full list, so the founder can actually send the "your area opens" email.
 * The export route access-logs every download (DPIA R4).
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
          <>
            {/* Launch-gate signups from ELIGIBLE areas are NOT expansion
                demand — they get their own honest one-liner and are excluded
                from the county aggregates below (data.ts). */}
            {data.launchArea > 0 ? <LaunchAreaCard count={data.launchArea} /> : null}
            {/* Every entry could be launch-area (flag-off Dublin joins only)
                — then there is no expansion demand to aggregate. */}
            {data.counties.length > 0 ? <Demand data={data} /> : null}
            <People entries={data.entries} />
          </>
        )}
      </PanelBody>
    </>
  );
}

/**
 * "Launch-area early access" — people whose Eircode is already in the Dublin
 * service area, who joined while BLOOD_TIERS_ENABLED was off. They're waiting
 * for sales to OPEN, not for their county, so they'd fake the "where do we
 * open next?" numbers if counted. Styled like the KPI cards above.
 */
function LaunchAreaCard({ count }: { count: number }) {
  return (
    <div
      style={{
        ...CARD,
        padding: "16px 20px",
        marginBottom: 20,
        display: "flex",
        alignItems: "baseline",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: "0.08em",
          color: "#7C887F",
        }}
      >
        LAUNCH-AREA EARLY ACCESS
      </span>
      <span style={{ fontFamily: SERIF, fontSize: 28, lineHeight: 1 }}>
        {count.toLocaleString("en-IE")}
      </span>
      <span style={{ fontSize: 12.5, color: "#4A554D" }}>
        {count === 1 ? "person" : "people"} waiting for sales to open — already
        in the service area, so not counted as expansion demand.
      </span>
    </div>
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
            <a href={adminPath("eligibility")} style={{ color: "#1E5C45" }}>
              Eligibility
            </a>{" "}
            view.
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// People on the list (Task 7b) — individual entries + CSV export
// ---------------------------------------------------------------------------

/** On-screen cap; the CSV export is never capped. */
const MAX_TABLE_ROWS = 200;

const PEOPLE_GRID = "1.1fr 1.7fr 0.7fr 0.8fr 0.9fr 0.6fr 1.1fr";

function People({ entries }: { entries: WaitlistEntry[] }) {
  const shown = entries.slice(0, MAX_TABLE_ROWS);

  return (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 16,
          marginBottom: 12,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            People on the list
          </h2>
          <div style={{ fontSize: 12.5, color: "#7C887F", marginTop: 2 }}>
            Showing {shown.length.toLocaleString("en-IE")} of{" "}
            {entries.length.toLocaleString("en-IE")} — newest first. The CSV
            includes everyone.
          </div>
        </div>
        {/* Every download is recorded in the admin access log (DPIA R4). */}
        <a
          href="/api/v1/admin/waitlist/export"
          style={{
            background: "#1C2620",
            color: "#F4F1EA",
            borderRadius: 100,
            padding: "9px 18px",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Download CSV
        </a>
      </div>

      <div style={{ ...CARD, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: PEOPLE_GRID,
            gap: 12,
            padding: "14px 22px",
            background: "#1C2620",
            color: "#8FA89A",
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.08em",
          }}
        >
          <span>NAME</span>
          <span>EMAIL</span>
          <span>ROUTING KEY</span>
          <span>COUNTY</span>
          <span>PLAN INTEREST</span>
          <span>POSITION</span>
          <span>JOINED</span>
        </div>
        {shown.map((e) => (
          <div
            key={e._id}
            style={{
              display: "grid",
              gridTemplateColumns: PEOPLE_GRID,
              gap: 12,
              padding: "13px 22px",
              borderBottom: "1px solid rgba(28,38,32,0.07)",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>
              {e.name ?? "—"}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 12, color: "#4A554D" }}>
              {e.email}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 12, color: "#1E5C45" }}>
              {e.routingKey}
              {e.eligibleAtJoin ? (
                // Launch-gate join from an ELIGIBLE area — waiting for sales
                // to open, not expansion demand.
                <span style={{ ...PILL.vitality, marginLeft: 6 }}>
                  LAUNCH AREA
                </span>
              ) : null}
            </span>
            <span style={{ fontSize: 13, color: "#4A554D" }}>{e.county}</span>
            <span style={{ fontSize: 13, color: "#4A554D" }}>
              {e.planInterest ?? "—"}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 12, color: "#4A554D" }}>
              #{e.position}
            </span>
            <span style={{ fontSize: 13, color: "#4A554D" }}>
              {formatDateTime(e.createdAt)}
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
          Personal data — used only for the &ldquo;your area opens&rdquo; email
          promised at signup. CSV downloads are recorded in the admin access
          log.
        </div>
      </div>
    </div>
  );
}
