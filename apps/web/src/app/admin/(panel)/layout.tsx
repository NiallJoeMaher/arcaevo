import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import AdminSidebar from "./AdminSidebar";
import { loadSidebarBadges } from "./data";

/**
 * Auth gate + admin chrome for every /admin tab (dashboard, members,
 * results, support). Session verification reuses src/lib/auth.ts — the
 * HMAC-signed cookie checked by isAdmin(). Signed out ⇒ /admin/login.
 *
 * Admin pages deliberately do NOT use SiteNav/SiteFooter — the design
 * (Admin.dc.html) has its own sidebar + topbar chrome.
 */
export const dynamic = "force-dynamic";

export default async function AdminPanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!(await isAdmin())) redirect("/admin/login");

  // Badge counts for the sidebar (review queue + open tickets). Null when
  // Mongo is unreachable — the sidebar simply hides the badges.
  const badges = await loadSidebarBadges();

  return (
    <div
      style={{
        fontFamily: "var(--font-sans)",
        background: "#EDE9E1",
        color: "#1C2620",
        width: "100%",
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "236px 1fr",
      }}
    >
      <AdminSidebar badges={badges} />
      <main style={{ padding: 0, minWidth: 0 }}>{children}</main>
    </div>
  );
}
