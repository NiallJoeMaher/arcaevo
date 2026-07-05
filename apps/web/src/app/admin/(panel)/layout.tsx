import { redirect } from "next/navigation";
import { currentAdmin, currentAdminEnrollment } from "@/lib/auth";
import { adminBasePath, adminPath } from "@/lib/admin-path";
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
  // currentAdmin() also gives the live DB role, so the sidebar can show the
  // owner-only tabs (Admins / Access log) to owners only.
  const admin = await currentAdmin();
  if (!admin) {
    // "Signed in but MFA not yet enrolled" is NOT authorised for any data route
    // — the scoped enrol state only reaches the enrolment flow. Send them there;
    // otherwise (no session, no enrol state) send them to sign in.
    if (await currentAdminEnrollment()) redirect(adminPath("enroll-mfa"));
    redirect(adminPath("login"));
  }

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
      <AdminSidebar badges={badges} role={admin.role} basePath={adminBasePath()} />
      <main style={{ padding: 0, minWidth: 0 }}>{children}</main>
    </div>
  );
}
