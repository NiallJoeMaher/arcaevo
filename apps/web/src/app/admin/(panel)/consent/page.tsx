import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { adminPath } from "@/lib/admin-path";
import { ConsentPurpose } from "@/lib/models";
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
  formatDateTime,
  loadConsentAudit,
  type ConsentAuditData,
} from "../data";

/**
 * /admin/consent — "Prove it, per person, per purpose" (§18 ADM-3).
 * Append-only consent audit log: every grant stores wording version,
 * timestamp and surface. Filterable by purpose; when the notice ships a new
 * version, this view shows exactly who needs the re-consent screen.
 */

export const metadata: Metadata = { title: "Consent audit" };
export const dynamic = "force-dynamic";

const ROW_GRID = "1.5fr 1fr 0.8fr 1.1fr 0.5fr 1fr";

const FILTER_ACTIVE: CSSProperties = {
  fontFamily: MONO,
  fontSize: 12,
  padding: "8px 15px",
  borderRadius: 100,
  background: "#1C2620",
  color: "#F4F1EA",
  textDecoration: "none",
};

const FILTER_IDLE: CSSProperties = {
  fontFamily: MONO,
  fontSize: 12,
  padding: "8px 15px",
  borderRadius: 100,
  background: "#FBFAF6",
  border: "1px solid rgba(28,38,32,0.12)",
  color: "#4A554D",
  textDecoration: "none",
};

/** "health_processing" → "health-processing" (the design's spelling). */
function purposeLabel(purpose: ConsentPurpose): string {
  return purpose.replace(/_/g, "-");
}

export default async function AdminConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ purpose?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.purpose) ? sp.purpose[0] : sp.purpose;
  const parsed = ConsentPurpose.safeParse(raw);
  const purpose = parsed.success ? parsed.data : null;

  const data = await loadConsentAudit(purpose);

  return (
    <>
      <Topbar kicker="GDPR" title="Consent audit" />
      <PanelBody>
        {data === null ? (
          <DbDownNotice />
        ) : data.totalDecisions === 0 ? (
          <EmptyDbNotice />
        ) : (
          <Audit data={data} purpose={purpose} />
        )}
      </PanelBody>
    </>
  );
}

function Audit({
  data,
  purpose,
}: {
  data: ConsentAuditData;
  purpose: ConsentPurpose | null;
}) {
  const allCurrent = data.reconsentDue === 0;

  return (
    <>
      {/* Current-version banner + re-consent count. */}
      <div
        style={{
          ...CARD,
          padding: "18px 22px",
          borderLeft: `4px solid ${allCurrent ? "#34A07C" : "#D99A4E"}`,
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.08em",
              color: allCurrent ? "#1E7D57" : "#A66A1F",
            }}
          >
            CURRENT NOTICE VERSION · {data.currentVersion}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, margin: "8px 0 4px" }}>
            {allCurrent
              ? "Every current grant is on this wording version."
              : `${data.reconsentDue} member${data.reconsentDue === 1 ? "" : "s"} need${data.reconsentDue === 1 ? "s" : ""} the re-consent screen on next sign-in.`}
          </div>
          <div style={{ fontSize: 13, color: "#4A554D", lineHeight: 1.5 }}>
            Every grant stores wording version, timestamp and surface. When the
            notice ships a new version, this view shows exactly who needs the
            re-consent screen.
          </div>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 12, color: "#7C887F" }}>
          {data.totalDecisions.toLocaleString("en-IE")} decisions on record
        </div>
      </div>

      {/* Purpose filter — searchParams-driven, server-rendered. */}
      <div
        style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}
      >
        <Link
          href={adminPath("consent")}
          style={purpose === null ? FILTER_ACTIVE : FILTER_IDLE}
        >
          All {data.totalDecisions.toLocaleString("en-IE")}
        </Link>
        {ConsentPurpose.options.map((p) => (
          <Link
            key={p}
            href={`${adminPath("consent")}?purpose=${p}`}
            style={purpose === p ? FILTER_ACTIVE : FILTER_IDLE}
          >
            {purposeLabel(p)} {data.countsByPurpose[p]}
          </Link>
        ))}
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
          <span>PURPOSE</span>
          <span>DECISION</span>
          <span>VERSION</span>
          <span>SURFACE</span>
          <span>WHEN</span>
        </div>
        {data.rows.length === 0 ? (
          <div style={{ padding: "15px 22px", fontSize: 13, color: "#7C887F" }}>
            No decisions recorded for this purpose yet.
          </div>
        ) : (
          data.rows.map((row) => {
            const stale =
              row.isLatest &&
              row.consent.granted &&
              row.consent.version !== data.currentVersion;
            return (
              <div
                key={row.consent._id}
                style={{
                  display: "grid",
                  gridTemplateColumns: ROW_GRID,
                  gap: 12,
                  padding: "14px 22px",
                  borderBottom: "1px solid rgba(28,38,32,0.07)",
                  alignItems: "center",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                    {row.memberName}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#7C887F",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.memberEmail}
                  </div>
                </div>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: "#4A554D" }}>
                  {purposeLabel(row.consent.purpose)}
                </span>
                <span style={row.consent.granted ? PILL.vitality : PILL.neutral}>
                  {row.consent.granted ? "GRANTED" : "DECLINED"}
                </span>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    color: stale ? "#A66A1F" : "#4A554D",
                  }}
                >
                  {row.consent.version}
                  {stale ? " · RE-CONSENT DUE" : ""}
                </span>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    letterSpacing: "0.06em",
                    color: "#4A554D",
                  }}
                >
                  {row.consent.surface.toUpperCase()}
                </span>
                <span style={{ fontSize: 12.5, color: "#4A554D" }}>
                  {formatDateTime(row.consent.timestamp)}
                </span>
              </div>
            );
          })
        )}
        <div
          style={{
            padding: "13px 22px",
            fontSize: 12,
            color: "#7C887F",
            lineHeight: 1.55,
          }}
        >
          The log is append-only — withdrawals are new rows, nothing is ever
          edited in place. Erasure requests show a 30-day countdown to
          completion.
        </div>
      </div>
    </>
  );
}
