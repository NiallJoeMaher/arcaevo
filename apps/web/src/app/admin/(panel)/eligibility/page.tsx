import type { Metadata } from "next";
import {
  CARD,
  DbDownNotice,
  MONO,
  PanelBody,
  SERIF,
  Topbar,
} from "../chrome";
import {
  formatDateTime,
  formatDayMonth,
  loadEligibilityAdmin,
  type EligibilityAdminData,
} from "../data";
import AllowlistEditor from "./AllowlistEditor";

/**
 * /admin/eligibility — "The gate is data, not a deploy" (§18 ADM-2).
 * The live Eircode routing-key allowlist as editable chips (add/remove via
 * POST /api/v1/admin/eligibility), the change history, and the rejected-key
 * log that drives expansion decisions.
 */

export const metadata: Metadata = { title: "Eligibility config" };
export const dynamic = "force-dynamic";

const REJECT_GRID = "0.8fr 1.2fr 0.8fr 1fr";

export default async function AdminEligibilityPage() {
  const data = await loadEligibilityAdmin();

  return (
    <>
      <Topbar kicker="ELIGIBILITY" title="Eircode allowlist" />
      <PanelBody>
        {data === null ? <DbDownNotice /> : <Config data={data} />}
      </PanelBody>
    </>
  );
}

function Config({ data }: { data: EligibilityAdminData }) {
  const topRejected = data.topRejected[0] ?? null;
  const kpis: { label: string; value: string; sub?: string }[] = [
    {
      label: "LIVE ROUTING KEYS",
      value: String(data.allowedRoutingKeys.length),
      sub: data.updatedAt
        ? `Updated ${formatDayMonth(data.updatedAt)}`
        : "Launch allowlist",
    },
    {
      label: "REJECTED CHECKS · 7 DAYS",
      value: String(data.rejectionsLast7d),
      sub: `${data.rejectionsTotal} all-time`,
    },
    {
      label: "TOP REJECTED KEY",
      value: topRejected ? topRejected.key : "—",
      sub: topRejected
        ? `${topRejected.county} · ${topRejected.count} check${topRejected.count === 1 ? "" : "s"}`
        : "No rejections logged",
    },
  ];

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
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
              <div style={{ fontSize: 12.5, color: "#5E6B63", fontWeight: 600 }}>
                {k.sub}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16 }}
      >
        {/* Dark config card — reproduced from §18 ADM-2, keys editable. */}
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
            ADM-2 · ELIGIBILITY CONFIG
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
            The gate is data, not a deploy
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: 14,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>Dublin</span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 9,
                  color: "#04130D",
                  background: "#34A07C",
                  padding: "3px 8px",
                  borderRadius: 100,
                }}
              >
                LIVE
              </span>
            </div>
            <AllowlistEditor keys={[...data.allowedRoutingKeys]} />
          </div>
          {/* Staged regions are design mock — there's no staging in the v2
              config schema yet; Cork opens by adding its keys above. */}
          <div
            style={{
              background: "rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: 14,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>Cork</span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 9,
                  color: "#E9BC85",
                  border: "1px solid rgba(217,154,78,0.5)",
                  padding: "3px 8px",
                  borderRadius: 100,
                }}
              >
                STAGED · OPENS 1 SEP
              </span>
            </div>
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
            Rejected checks last 7 days:{" "}
            <span style={{ color: "#7FD3AE" }}>{data.rejectionsLast7d}</span>
            {topRejected ? (
              <>
                {" "}
                · top rejected key {topRejected.key} ({topRejected.county})
              </>
            ) : null}
            . Staged regions flip on schedule, with the founding-member window
            armed automatically.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Change history — the changeLog appended by the API route. */}
          <div style={{ ...CARD, padding: 24 }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>
              Change history
            </span>
            {data.changeLog.length === 0 ? (
              <div
                style={{
                  fontSize: 13,
                  color: "#7C887F",
                  lineHeight: 1.55,
                  marginTop: 12,
                }}
              >
                No changes yet — the launch allowlist is live as seeded. Edits
                made here apply instantly at checkout; nothing ships.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  marginTop: 14,
                }}
              >
                {data.changeLog.map((change, i) => (
                  <div
                    key={`${change.at.getTime()}-${i}`}
                    style={{
                      borderBottom:
                        i < data.changeLog.length - 1
                          ? "1px solid rgba(28,38,32,0.07)"
                          : "none",
                      paddingBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: MONO,
                        fontSize: 10,
                        letterSpacing: "0.06em",
                        color: "#7C887F",
                        marginBottom: 6,
                      }}
                    >
                      {formatDateTime(change.at)}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {change.added.map((key) => (
                        <span
                          key={`+${key}`}
                          style={{
                            fontFamily: MONO,
                            fontSize: 11,
                            padding: "3px 9px",
                            borderRadius: 100,
                            background: "rgba(52,160,124,0.16)",
                            color: "#1E7D57",
                          }}
                        >
                          + {key}
                        </span>
                      ))}
                      {change.removed.map((key) => (
                        <span
                          key={`-${key}`}
                          style={{
                            fontFamily: MONO,
                            fontSize: 11,
                            padding: "3px 9px",
                            borderRadius: 100,
                            background: "rgba(200,80,60,0.14)",
                            color: "#B5483A",
                          }}
                        >
                          − {key}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rejected-key log (key only, no address — eligibility.ts). */}
          <div style={{ ...CARD, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: REJECT_GRID,
                gap: 12,
                padding: "14px 22px",
                background: "#1C2620",
                color: "#8FA89A",
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: "0.08em",
              }}
            >
              <span>KEY</span>
              <span>COUNTY</span>
              <span>CHECKS</span>
              <span>LAST SEEN</span>
            </div>
            {data.topRejected.length === 0 ? (
              <div style={{ padding: "15px 22px", fontSize: 13, color: "#7C887F" }}>
                No rejected checks logged yet.
              </div>
            ) : (
              data.topRejected.map((r) => (
                <div
                  key={r.key}
                  style={{
                    display: "grid",
                    gridTemplateColumns: REJECT_GRID,
                    gap: 12,
                    padding: "13px 22px",
                    borderBottom: "1px solid rgba(28,38,32,0.07)",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600 }}>
                    {r.key}
                  </span>
                  <span style={{ fontSize: 13, color: "#4A554D" }}>
                    {r.county}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 12.5, color: "#1E5C45" }}>
                    {r.count}
                  </span>
                  <span style={{ fontSize: 13, color: "#4A554D" }}>
                    {formatDayMonth(r.last)}
                  </span>
                </div>
              ))
            )}
            <div
              style={{
                padding: "13px 22px",
                fontSize: 12,
                color: "#7C887F",
                lineHeight: 1.55,
              }}
            >
              Rejected checkout checks store the routing key only — never an
              address, never an email.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
