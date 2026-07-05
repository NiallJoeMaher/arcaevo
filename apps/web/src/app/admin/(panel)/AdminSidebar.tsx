"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import type { AdminRole } from "@/lib/models";

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
  /** Only rendered for owner sessions (admin-account management + audit log). */
  ownerOnly?: boolean;
}[] = [
  { href: "/admin", icon: "◧", label: "Dashboard" },
  { href: "/admin/members", icon: "◍", label: "Members" },
  { href: "/admin/results", icon: "✚", label: "Review queue", badge: "review" },
  { href: "/admin/support", icon: "✉", label: "Support", badge: "support" },
  // v2 ops views (design_handoff_v2 §18 ADM-1/2/3)
  { href: "/admin/waitlist", icon: "◔", label: "Waitlist" },
  { href: "/admin/eligibility", icon: "◫", label: "Eligibility" },
  { href: "/admin/consent", icon: "❋", label: "Consent audit" },
  // Self-service: every admin manages their own two-factor auth (MOCKED_APIS §3).
  { href: "/admin/security", icon: "⚷", label: "Security" },
  // Owner-only: self-hosted admin auth management (MOCKED_APIS §3).
  { href: "/admin/admins", icon: "⚿", label: "Admins", ownerOnly: true },
  { href: "/admin/access-log", icon: "☰", label: "Access log", ownerOnly: true },
];

export default function AdminSidebar({
  badges,
  role,
}: {
  badges: SidebarBadges;
  role: AdminRole | null;
}) {
  const pathname = usePathname();
  const nav = NAV.filter((n) => !n.ownerOnly || role === "owner");

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
        {nav.map((n) => {
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
