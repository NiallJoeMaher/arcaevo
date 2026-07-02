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
import { formatAge, loadSupport } from "../data";
import type { SupportTicket } from "@/lib/models";

export const metadata: Metadata = { title: "Support" };
export const dynamic = "force-dynamic";

/** Deterministic subject → queue tag (presentational, like the design's). */
function ticketTag(t: SupportTicket): { label: string; style: CSSProperties } {
  const s = t.subject.toLowerCase();
  if (/kit|arriv|ship|deliver|nurse|reschedul|draw|tracking/.test(s))
    return { label: "FULFILMENT", style: PILL.forest };
  if (/renew|payment|card|billing|cancel|refund|invoice/.test(s))
    return { label: "BILLING", style: PILL.neutral };
  if (/export|gdpr|privacy|delete/.test(s))
    return { label: "PRIVACY", style: PILL.vitality };
  if (/hba1c|apob|marker|result|blood|clinic/.test(s))
    return { label: "CLINICAL", style: PILL.amber };
  if (/sync|watch|app|upload|login/.test(s))
    return { label: "TECH", style: PILL.neutral };
  return { label: "GENERAL", style: PILL.neutral };
}

const TIER_LABEL = {
  fusion: "Fusion",
  essential: "Essential",
  performance: "Performance",
} as const;

export default async function AdminSupportPage() {
  const data = await loadSupport();

  return (
    <>
      <Topbar kicker="SUPPORT" title="Support inbox" />
      <PanelBody>
        {data === null ? (
          <DbDownNotice />
        ) : data.tickets.length === 0 ? (
          <EmptyDbNotice />
        ) : (
          <SupportInbox data={data} />
        )}
      </PanelBody>
    </>
  );
}

function SupportInbox({
  data,
}: {
  data: NonNullable<Awaited<ReturnType<typeof loadSupport>>>;
}) {
  const selected = data.tickets[0];
  const selectedUser = selected.memberId
    ? data.userById.get(selected.memberId)
    : undefined;
  const selectedTier = selected.memberId
    ? data.tierByMember.get(selected.memberId)
    : undefined;
  const selectedTag = ticketTag(selected);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "340px 1fr",
        gap: 16,
        alignItems: "start",
      }}
    >
      <div style={{ ...CARD, overflow: "hidden" }}>
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid rgba(28,38,32,0.08)",
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          Inbox{" "}
          <span style={{ fontFamily: MONO, fontSize: 11, color: "#D99A4E" }}>
            · {data.openCount} open
          </span>
        </div>
        {data.tickets.map((t, i) => {
          const tag = ticketTag(t);
          const user = t.memberId ? data.userById.get(t.memberId) : undefined;
          return (
            <div
              key={t._id}
              style={{
                padding: "15px 20px",
                borderBottom: "1px solid rgba(28,38,32,0.07)",
                background: i === 0 ? "#EDE9E1" : "#FBFAF6",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  {user?.name ?? "—"}
                </span>
                <span
                  style={{ fontFamily: MONO, fontSize: 10, color: "#7C887F" }}
                >
                  {formatAge(t.createdAt)}
                </span>
              </div>
              <div
                style={{ fontSize: 12.5, color: "#4A554D", marginBottom: 6 }}
              >
                {t.subject}
              </div>
              <span style={tag.style}>{tag.label}</span>
            </div>
          );
        })}
      </div>
      <div
        style={{
          ...CARD,
          padding: 24,
          minHeight: 420,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: 16,
            borderBottom: "1px solid rgba(28,38,32,0.08)",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {selectedUser?.name ?? "—"}
            </div>
            <div style={{ fontSize: 12.5, color: "#7C887F" }}>
              {selectedUser
                ? `${selectedUser.email}${
                    selectedTier ? ` · ${TIER_LABEL[selectedTier]} member` : ""
                  }`
                : "No member on file"}
            </div>
          </div>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 11,
              padding: "6px 12px",
              background: "rgba(217,154,78,0.16)",
              color: "#A66A1F",
              borderRadius: 100,
            }}
          >
            {selectedTag.label} · {selected.status.toUpperCase()}
          </span>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            padding: "20px 0",
          }}
        >
          <div
            style={{
              alignSelf: "flex-start",
              maxWidth: "80%",
              background: "#EDE9E1",
              borderRadius: 14,
              borderTopLeftRadius: 4,
              padding: "13px 16px",
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            {selected.body}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            borderTop: "1px solid rgba(28,38,32,0.08)",
            paddingTop: 16,
          }}
        >
          <div
            style={{
              flex: 1,
              background: "#EDE9E1",
              borderRadius: 100,
              padding: "12px 18px",
              fontSize: 13.5,
              color: "#9AA39C",
            }}
          >
            Type a reply… (clinical replies reviewed)
          </div>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "#1C2620",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ↑
          </div>
        </div>
      </div>
    </div>
  );
}
