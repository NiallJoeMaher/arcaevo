"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";

const MONO = "var(--font-mono)";

const NAV_BASE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 11,
  textDecoration: "none",
  fontSize: 13.5,
  padding: "10px 12px",
  borderRadius: 9,
};

export interface SidebarBadges {
  /** Results awaiting clinician review (null when the DB is unreachable). */
  review: number | null;
  /** Open + pending support tickets (null when the DB is unreachable). */
  support: number | null;
}

const NAV: {
  href: string;
  icon: string;
  label: string;
  badge?: keyof SidebarBadges;
}[] = [
  { href: "/admin", icon: "◧", label: "Dashboard" },
  { href: "/admin/members", icon: "◍", label: "Members" },
  { href: "/admin/results", icon: "✚", label: "Review queue", badge: "review" },
  { href: "/admin/support", icon: "✉", label: "Support", badge: "support" },
];

export default function AdminSidebar({ badges }: { badges: SidebarBadges }) {
  const pathname = usePathname();

  return (
    <aside
      style={{
        background: "#161E18",
        color: "#9FB0A6",
        padding: "22px 16px",
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        position: "sticky",
        top: 0,
        alignSelf: "start",
        height: "100vh",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "6px 10px 22px",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 16, color: "#F4F1EA" }}>
          Arcaevo
        </span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 9,
            letterSpacing: "0.1em",
            color: "#5B6A61",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 5,
            padding: "2px 5px",
          }}
        >
          ADMIN
        </span>
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map((n) => {
          const active = pathname === n.href;
          const badge =
            !active && n.badge ? badges[n.badge] : null;
          return (
            <Link
              key={n.href}
              href={n.href}
              style={{
                ...NAV_BASE,
                ...(active
                  ? {
                      background: "rgba(52,160,124,0.16)",
                      color: "#F4F1EA",
                      fontWeight: 600,
                    }
                  : { color: "#9FB0A6", fontWeight: 500 }),
              }}
            >
              <span style={{ width: 16, textAlign: "center" }}>{n.icon}</span>
              <span>{n.label}</span>
              {badge != null && badge > 0 ? (
                <span
                  style={{
                    marginLeft: "auto",
                    fontFamily: MONO,
                    fontSize: 10,
                    background: "#D99A4E",
                    color: "#1A130A",
                    borderRadius: 100,
                    padding: "1px 7px",
                  }}
                >
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div
        style={{
          marginTop: "auto",
          padding: "14px 10px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#5FB592,#1E5C45)",
            }}
          />
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ fontSize: 13, color: "#F4F1EA", fontWeight: 600 }}>
              Dr. N. Keane
            </div>
            <div style={{ fontSize: 11, color: "#5B6A61" }}>
              Medical Director
            </div>
          </div>
        </div>
        <Link
          href="/"
          style={{
            display: "block",
            marginTop: 12,
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.08em",
            color: "#5B6A61",
            textDecoration: "none",
          }}
        >
          ← BACK TO SITE
        </Link>
      </div>
    </aside>
  );
}
