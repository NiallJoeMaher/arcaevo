import type { CSSProperties } from "react";

/**
 * Shared admin chrome + style tokens, lifted verbatim from
 * design_handoff/designs/Admin.dc.html (all styling inline, per the design).
 */

export const MONO = "var(--font-mono)";
export const SERIF = "var(--font-serif)";

/** Status pill — mirrors the design's `pill(bg, col)` helper exactly. */
export function pillStyle(bg: string, col: string): CSSProperties {
  return {
    fontFamily: MONO,
    fontSize: 10,
    padding: "4px 9px",
    borderRadius: 100,
    background: bg,
    color: col,
    justifySelf: "start",
    letterSpacing: "0.04em",
  };
}

/** The design's five pill tints. */
export const PILL = {
  vitality: pillStyle("rgba(52,160,124,0.16)", "#1E7D57"),
  amber: pillStyle("rgba(217,154,78,0.18)", "#A66A1F"),
  red: pillStyle("rgba(200,80,60,0.14)", "#B5483A"),
  forest: pillStyle("rgba(30,92,69,0.1)", "#1E5C45"),
  neutral: pillStyle("rgba(28,38,32,0.07)", "#5E6B63"),
} as const;

export const CARD: CSSProperties = {
  background: "#FBFAF6",
  border: "1px solid rgba(28,38,32,0.08)",
  borderRadius: 16,
};

/** Sticky topbar — kicker + panel title + search / add affordances. */
export function Topbar({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div
      style={{
        background: "#F6F3EC",
        borderBottom: "1px solid rgba(28,38,32,0.1)",
        padding: "16px 32px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: "0.1em",
            color: "#7C887F",
          }}
        >
          {kicker}
        </div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            margin: "2px 0 0",
          }}
        >
          {title}
        </h1>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#EDE9E1",
            border: "1px solid rgba(28,38,32,0.1)",
            borderRadius: 100,
            padding: "8px 16px",
          }}
        >
          <span style={{ color: "#9AA39C" }}>⌕</span>
          <span style={{ fontSize: 13, color: "#9AA39C" }}>Search…</span>
        </div>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "#1C2620",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15,
          }}
        >
          ＋
        </div>
      </div>
    </div>
  );
}

/** Content wrapper below the topbar. */
export function PanelBody({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "28px 32px 60px" }}>{children}</div>;
}

/** Rendered when MongoDB can't be reached — never crash the admin. */
export function DbDownNotice() {
  return (
    <div style={{ ...CARD, padding: "20px 22px", borderLeft: "4px solid #D99A4E" }}>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: "0.08em",
          color: "#A66A1F",
        }}
      >
        DATABASE UNREACHABLE
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, margin: "8px 0 4px" }}>
        Couldn&apos;t connect to MongoDB.
      </div>
      <div style={{ fontSize: 13.5, color: "#4A554D", lineHeight: 1.5 }}>
        Start it with{" "}
        <code style={{ fontFamily: MONO, fontSize: 12 }}>
          docker compose up -d mongo
        </code>{" "}
        (repo root), then seed with{" "}
        <code style={{ fontFamily: MONO, fontSize: 12 }}>npm run seed</code> and
        reload.
      </div>
    </div>
  );
}

/** Rendered on an owner-only page when the current admin isn't an owner. */
export function OwnerOnlyNotice() {
  return (
    <div style={{ ...CARD, padding: "20px 22px", borderLeft: "4px solid #B5483A" }}>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: "0.08em",
          color: "#B5483A",
        }}
      >
        OWNER ONLY
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, margin: "8px 0 4px" }}>
        This area is restricted to owner accounts.
      </div>
      <div style={{ fontSize: 13.5, color: "#4A554D", lineHeight: 1.5 }}>
        Admin-account management and the access log are visible only to owners.
        Ask an owner if you need access.
      </div>
    </div>
  );
}

/** Rendered when the database is reachable but has no data yet. */
export function EmptyDbNotice() {
  return (
    <div style={{ ...CARD, padding: "20px 22px", borderLeft: "4px solid #34A07C" }}>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: "0.08em",
          color: "#1E7D57",
        }}
      >
        NO DATA YET
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, margin: "8px 0 4px" }}>
        The database is empty.
      </div>
      <div style={{ fontSize: 13.5, color: "#4A554D", lineHeight: 1.5 }}>
        Seed demo data with{" "}
        <code style={{ fontFamily: MONO, fontSize: 12 }}>npm run seed</code>{" "}
        (apps/web), then reload.
      </div>
    </div>
  );
}
