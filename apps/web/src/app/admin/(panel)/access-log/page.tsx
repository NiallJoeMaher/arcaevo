import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { currentAdmin } from "@/lib/auth";
import {
  CARD,
  DbDownNotice,
  MONO,
  OwnerOnlyNotice,
  PILL,
  PanelBody,
  Topbar,
} from "../chrome";
import { formatDateTime, loadAccessLog, type AccessLogRow } from "../data";

/**
 * /admin/access-log — owner-only viewer over the admin access log (DPIA R4 /
 * GDPR Art.32). Shows who did what, to whose record, when, the outcome and the
 * source ip — newest first. The log stores the FACT of access only, never a
 * health value, so this view adds no Art.9 surface.
 */
export const metadata: Metadata = { title: "Access log" };
export const dynamic = "force-dynamic";

const ROW_GRID = "1.3fr 1.4fr 0.7fr 1.4fr 0.7fr 1fr";

export default async function AdminAccessLogPage() {
  const me = await currentAdmin();
  const isOwner = me?.role === "owner";
  const rows = isOwner ? await loadAccessLog() : null;

  return (
    <>
      <Topbar kicker="ACCOUNTABILITY" title="Admin access log" />
      <PanelBody>
        {!isOwner ? (
          <OwnerOnlyNotice />
        ) : rows === null ? (
          <DbDownNotice />
        ) : (
          <LogTable rows={rows} />
        )}
      </PanelBody>
    </>
  );
}

const HEAD: CSSProperties = {
  display: "grid",
  gridTemplateColumns: ROW_GRID,
  gap: 12,
  padding: "14px 22px",
  background: "#1C2620",
  color: "#8FA89A",
  fontFamily: MONO,
  fontSize: 10,
  letterSpacing: "0.08em",
};

function LogTable({ rows }: { rows: AccessLogRow[] }) {
  return (
    <>
      <div style={{ fontSize: 12.5, color: "#5E6B63", marginBottom: 14 }}>
        The {rows.length} most recent admin actions, newest first. Records the
        fact of access only — never a health value.
      </div>
      <div style={{ ...CARD, overflow: "hidden" }}>
        <div style={HEAD}>
          <span>WHEN</span>
          <span>ADMIN</span>
          <span>ROLE</span>
          <span>ACTION</span>
          <span>OUTCOME</span>
          <span>MEMBER · IP</span>
        </div>
        {rows.length === 0 ? (
          <div style={{ padding: "15px 22px", fontSize: 13, color: "#7C887F" }}>
            No admin actions logged yet.
          </div>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              style={{
                display: "grid",
                gridTemplateColumns: ROW_GRID,
                gap: 12,
                padding: "13px 22px",
                borderBottom: "1px solid rgba(28,38,32,0.07)",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 12.5, color: "#4A554D" }}>
                {formatDateTime(r.at)}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: "#1C2620",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {r.email ?? r.adminId ?? "—"}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: "#5E6B63" }}>
                {r.role ?? "—"}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 12, color: "#1E5C45" }}>
                {r.action}
              </span>
              <span
                style={r.outcome === "failure" ? PILL.red : PILL.vitality}
              >
                {r.outcome === "failure" ? "Failure" : "Success"}
              </span>
              <span style={{ fontSize: 12.5, color: "#4A554D", minWidth: 0 }}>
                {r.targetMemberName ? (
                  <span style={{ fontWeight: 600 }}>{r.targetMemberName}</span>
                ) : null}
                {r.targetMemberName && r.ip ? " · " : null}
                {r.ip ? (
                  <span style={{ fontFamily: MONO, fontSize: 11 }}>{r.ip}</span>
                ) : null}
                {!r.targetMemberName && !r.ip ? "—" : null}
              </span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
