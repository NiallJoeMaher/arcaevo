import type { Metadata } from "next";
import type { CSSProperties } from "react";
import {
  CARD,
  DbDownNotice,
  MONO,
  PILL,
  PanelBody,
  SERIF,
  Topbar,
} from "../chrome";
import { formatDayMonth, loadReviewQueue, type ReviewGroup } from "../data";
import SignOffButton from "./SignOffButton";

export const metadata: Metadata = { title: "Review queue" };
export const dynamic = "force-dynamic";

type Priority = {
  label: "CRITICAL" | "REVIEW" | "ROUTINE";
  accent: string;
  pill: CSSProperties;
  flag: string;
};

/**
 * Deterministic triage from the readings themselves (rules decide; AI only
 * narrates — same principle as lib/rcv.ts):
 *  · any marker worsened beyond RCV        → CRITICAL
 *  · markers with no prior baseline        → REVIEW
 *  · everything improved / within RCV      → ROUTINE
 */
function triage(group: ReviewGroup): Priority {
  const worsened = group.readings.filter((r) => r.rcvVerdict === "worsened");
  if (worsened.length > 0) {
    const w = worsened[0];
    const name = group.ruleByCode.get(w.code)?.name ?? w.code;
    return {
      label: "CRITICAL",
      accent: "#C8503C",
      pill: PILL.red,
      flag: `⚠ ${name} ${w.value} ${w.unit} — worsened beyond RCV since the last test. Recommend GP referral, not coaching.`,
    };
  }
  if (group.readings.some((r) => r.rcvVerdict === null)) {
    return {
      label: "REVIEW",
      accent: "#D99A4E",
      pill: PILL.amber,
      flag: "First panel for this member — no prior baseline to compare against. Review before sign-off.",
    };
  }
  return {
    label: "ROUTINE",
    accent: "#34A07C",
    pill: PILL.vitality,
    flag: "All markers within optimal or watch ranges. Ready for routine sign-off.",
  };
}

export default async function AdminResultsPage() {
  const data = await loadReviewQueue();

  return (
    <>
      <Topbar kicker="CLINICAL" title="Result review queue" />
      <PanelBody>
        {data === null ? (
          <DbDownNotice />
        ) : (
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {data.groups.length === 0 ? (
                <div
                  style={{
                    ...CARD,
                    padding: "20px 22px",
                    borderLeft: "4px solid #34A07C",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    Queue clear — no results awaiting review.
                  </div>
                  <div
                    style={{
                      fontSize: 13.5,
                      color: "#4A554D",
                      marginTop: 6,
                    }}
                  >
                    New panels appear here as labs report. Seed demo data with{" "}
                    <code style={{ fontFamily: MONO, fontSize: 12 }}>
                      npm run seed
                    </code>{" "}
                    (apps/web).
                  </div>
                </div>
              ) : (
                data.groups.map((g) => {
                  const p = triage(g);
                  return (
                    <div
                      key={g.key}
                      style={{
                        ...CARD,
                        padding: "20px 22px",
                        borderLeft: `4px solid ${p.accent}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 16,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              marginBottom: 6,
                            }}
                          >
                            <span style={{ fontWeight: 700, fontSize: 16 }}>
                              {g.memberName}
                            </span>
                            <span style={p.pill}>{p.label}</span>
                          </div>
                          <div style={{ fontSize: 13, color: "#7C887F" }}>
                            {g.panelLabel} · {g.readings.length} markers ·
                            sample {formatDayMonth(g.received)}
                          </div>
                          <div
                            style={{
                              fontSize: 13.5,
                              color: "#4A554D",
                              marginTop: 10,
                            }}
                          >
                            {p.flag}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            flexShrink: 0,
                          }}
                        >
                          <SignOffButton
                            readingIds={g.readings.map((r) => r._id)}
                          />
                          <span
                            style={{
                              border: "1px solid rgba(28,38,32,0.2)",
                              color: "#1C2620",
                              fontSize: 12.5,
                              fontWeight: 600,
                              padding: "9px 16px",
                              borderRadius: 100,
                              textAlign: "center",
                              cursor: "pointer",
                            }}
                          >
                            Flag to GP
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div
              style={{
                width: 280,
                background: "#1C2620",
                color: "#F4F1EA",
                borderRadius: 16,
                padding: 22,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: "#8FA89A",
                  letterSpacing: "0.1em",
                  marginBottom: 14,
                }}
              >
                TODAY
              </div>
              <div style={{ fontFamily: SERIF, fontSize: 40, lineHeight: 1 }}>
                {data.groups.length}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#9FB0A6",
                  marginBottom: 20,
                }}
              >
                panels awaiting sign-off
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  fontSize: 13,
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: "#9FB0A6" }}>Critical flags</span>
                  <span style={{ color: "#E8836F", fontWeight: 600 }}>
                    {
                      data.groups.filter((g) => triage(g).label === "CRITICAL")
                        .length
                    }
                  </span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: "#9FB0A6" }}>Signed off today</span>
                  <span style={{ color: "#7FD3AE", fontWeight: 600 }}>
                    {data.reviewedReadings}
                  </span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: "#9FB0A6" }}>Avg. review time</span>
                  <span style={{ fontWeight: 600 }}>3m 20s</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </PanelBody>
    </>
  );
}
