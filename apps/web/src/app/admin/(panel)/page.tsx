import type { Metadata } from "next";
import {
  CARD,
  DbDownNotice,
  EmptyDbNotice,
  MONO,
  PanelBody,
  SERIF,
  Topbar,
} from "./chrome";
import { formatEur, loadDashboard, type DashboardData } from "./data";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const data = await loadDashboard();

  return (
    <>
      <Topbar kicker="OVERVIEW" title="Business dashboard" />
      <PanelBody>
        {data === null ? (
          <DbDownNotice />
        ) : data.activeMembers === 0 ? (
          <EmptyDbNotice />
        ) : (
          <Dashboard data={data} />
        )}
      </PanelBody>
    </>
  );
}

function Dashboard({ data }: { data: DashboardData }) {
  // Real seeded numbers where the data exists; deltas + NPS stay as the
  // design's mock copy (no historical series to compute them from).
  const kpis = [
    { label: "MRR", value: formatEur(data.mrrEquivalentEur), delta: "▲ 18% YTD" },
    {
      label: "ACTIVE MEMBERS",
      value: data.activeMembers.toLocaleString("en-IE"),
      delta: "▲ 212 this month",
    },
    {
      label: "TESTS THIS MONTH",
      value: data.testsThisMonth.toLocaleString("en-IE"),
      delta: "▲ 9%",
    },
    { label: "NPS", value: "72", delta: "▲ 4 pts" },
  ];

  const total =
    data.membersByTier.essential +
    data.membersByTier.performance +
    data.membersByTier.fusion;
  const pct = (n: number) =>
    total === 0 ? "0%" : `${Math.round((n / total) * 100)}%`;
  const planMix = [
    { name: "Essential", pct: pct(data.membersByTier.essential), color: "#1E5C45" },
    {
      name: "Performance (venous)",
      pct: pct(data.membersByTier.performance),
      color: "#34A07C",
    },
    { name: "Fusion", pct: pct(data.membersByTier.fusion), color: "#D99A4E" },
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
            <div style={{ fontSize: 12.5, color: "#1E7D57", fontWeight: 600 }}>
              {k.delta}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}
      >
        <div style={{ ...CARD, padding: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 16 }}>
              Monthly recurring revenue
            </span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: "#34A07C" }}>
              +18% YTD
            </span>
          </div>
          <svg viewBox="0 0 480 160" style={{ width: "100%", height: "auto" }}>
            <polyline
              points="10,140 60,132 110,120 160,124 210,104 260,96 310,80 360,74 410,52 470,38"
              fill="none"
              stroke="#1E5C45"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <polyline
              points="10,140 60,132 110,120 160,124 210,104 260,96 310,80 360,74 410,52 470,38 470,160 10,160"
              fill="rgba(30,92,69,0.08)"
              stroke="none"
            />
          </svg>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: MONO,
              fontSize: 10,
              color: "#9AA39C",
              marginTop: 8,
            }}
          >
            <span>JAN</span>
            <span>MAR</span>
            <span>MAY</span>
            <span>JUL</span>
            <span>SEP</span>
            <span>NOV</span>
          </div>
        </div>
        <div style={{ ...CARD, padding: 24 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Members by plan</span>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              marginTop: 20,
            }}
          >
            {planMix.map((p) => (
              <div key={p.name}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  <span style={{ fontFamily: MONO, color: "#4A554D" }}>
                    {p.pct}
                  </span>
                </div>
                <div
                  style={{
                    height: 8,
                    borderRadius: 100,
                    background: "rgba(28,38,32,0.08)",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: p.pct,
                      borderRadius: 100,
                      background: p.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
