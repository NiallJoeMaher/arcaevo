import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentAdmin, currentAdminEnrollment } from "@/lib/auth";
import { findAdminById } from "@/lib/admin-auth";
import { adminBasePath, adminPath } from "@/lib/admin-path";
import EnrollMfaForm from "./EnrollMfaForm";

/**
 * /admin/enroll-mfa — MANDATORY two-factor enrolment gate. Reached only when a
 * real admin has passed the password step but has no MFA yet: they hold the
 * scoped `mfa-enroll` cookie (NOT a session). They must enrol + confirm a code
 * here before any admin session is issued, so no admin can operate without MFA.
 *
 * Lives OUTSIDE the (panel) group (like /admin/login) so the full-session gate
 * doesn't bounce it. Served under the secret slug in prod via the proxy.
 */
export const metadata: Metadata = { title: "Set up two-factor auth" };
export const dynamic = "force-dynamic";

const MONO = "var(--font-mono)";

export default async function AdminEnrollMfaPage() {
  // Already a full session ⇒ already enrolled/authorised ⇒ go to the dashboard.
  if (await currentAdmin()) redirect(adminBasePath());

  // Otherwise require the scoped enrol state; without it, back to sign-in.
  const enrolling = await currentAdminEnrollment();
  const record = enrolling ? await findAdminById(enrolling.adminId) : null;
  if (!enrolling || !record || record.disabledAt) redirect(adminPath("login"));

  return (
    <div
      style={{
        fontFamily: "var(--font-sans)",
        background: "#EDE9E1",
        color: "#1C2620",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div
          style={{
            background: "#FBFAF6",
            border: "1px solid rgba(28,38,32,0.08)",
            borderRadius: 16,
            padding: "28px 28px 26px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 18,
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 16 }}>Arcaevo</span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 9,
                letterSpacing: "0.1em",
                color: "#7C887F",
                border: "1px solid rgba(28,38,32,0.16)",
                borderRadius: 5,
                padding: "2px 5px",
              }}
            >
              ADMIN
            </span>
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.1em",
              color: "#7C887F",
              marginBottom: 4,
            }}
          >
            TWO-FACTOR REQUIRED
          </div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              margin: "0 0 6px",
            }}
          >
            Set up two-factor auth to continue
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "#4A554D",
              lineHeight: 1.5,
              margin: "0 0 18px",
            }}
          >
            Admin access to member health data requires two-factor
            authentication. Enrol{" "}
            <span style={{ fontFamily: MONO, fontSize: 12 }}>{record.email}</span>{" "}
            now — you&apos;ll only be signed in once it&apos;s confirmed.
          </p>
          <EnrollMfaForm dashboardPath={adminBasePath()} />
        </div>
      </div>
    </div>
  );
}
