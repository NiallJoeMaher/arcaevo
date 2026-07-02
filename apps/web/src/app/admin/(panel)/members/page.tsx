import type { Metadata } from "next";
import type { CSSProperties } from "react";
import {
  CARD,
  DbDownNotice,
  EmptyDbNotice,
  MONO,
  PILL,
  PanelBody,
  Topbar,
} from "../chrome";
import {
  formatDayMonth,
  formatMonthYear,
  loadMembers,
  type MemberRow,
} from "../data";

export const metadata: Metadata = { title: "Members" };
export const dynamic = "force-dynamic";

const ROW_GRID = "1.6fr 1fr 0.9fr 1fr 1fr";

const FILTER_ACTIVE: CSSProperties = {
  fontFamily: MONO,
  fontSize: 12,
  padding: "8px 15px",
  borderRadius: 100,
  background: "#1C2620",
  color: "#F4F1EA",
};

const FILTER_IDLE: CSSProperties = {
  fontFamily: MONO,
  fontSize: 12,
  padding: "8px 15px",
  borderRadius: 100,
  background: "#FBFAF6",
  border: "1px solid rgba(28,38,32,0.12)",
  color: "#4A554D",
};

const STATUS: Record<
  MemberRow["user"]["flag"],
  { label: string; style: CSSProperties }
> = {
  active: { label: "Active", style: PILL.vitality },
  new: { label: "New", style: PILL.amber },
  churn_risk: { label: "Churn risk", style: PILL.red },
};

const PLAN_LABEL = {
  fusion: "Fusion",
  essential: "Essential",
  performance: "Performance",
} as const;

export default async function AdminMembersPage() {
  const rows = await loadMembers();

  return (
    <>
      <Topbar kicker="PEOPLE" title="Members & users" />
      <PanelBody>
        {rows === null ? (
          <DbDownNotice />
        ) : rows.length === 0 ? (
          <EmptyDbNotice />
        ) : (
          <>
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 16,
                flexWrap: "wrap",
              }}
            >
              <span style={FILTER_ACTIVE}>
                All {rows.length.toLocaleString("en-IE")}
              </span>
              <span style={FILTER_IDLE}>Active</span>
              <span style={FILTER_IDLE}>Trialists</span>
              <span style={FILTER_IDLE}>Churn risk</span>
            </div>
            <div style={{ ...CARD, overflow: "hidden" }}>
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
                <span>MEMBER</span>
                <span>PLAN</span>
                <span>STATUS</span>
                <span>JOINED</span>
                <span>LAST TEST</span>
              </div>
              {rows.map((m) => {
                const status = STATUS[m.user.flag];
                return (
                  <div
                    key={m.user._id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: ROW_GRID,
                      gap: 12,
                      padding: "15px 22px",
                      borderBottom: "1px solid rgba(28,38,32,0.07)",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 11 }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background:
                            "linear-gradient(135deg,#5FB592,#1E5C45)",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                          {m.user.name}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#7C887F",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {m.user.email}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: 13, color: "#4A554D" }}>
                      {m.tier ? PLAN_LABEL[m.tier] : "—"}
                    </span>
                    <span style={status.style}>{status.label}</span>
                    <span style={{ fontSize: 13, color: "#4A554D" }}>
                      {formatMonthYear(m.user.joinedAt)}
                    </span>
                    <span style={{ fontSize: 13, color: "#4A554D" }}>
                      {m.lastTest ? formatDayMonth(m.lastTest) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </PanelBody>
    </>
  );
}
