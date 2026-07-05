import type { Metadata } from "next";
import { currentAdmin } from "@/lib/auth";
import { findAdminById } from "@/lib/admin-auth";
import { CARD, MONO, PanelBody, Topbar } from "../chrome";
import SecurityManager from "./SecurityManager";

/**
 * /admin/security — the signed-in admin manages their OWN two-factor auth
 * (docs/MOCKED_APIS.md §3). Available to every role (self-service); the API
 * routes it drives (POST /api/v1/admin/mfa/setup|enable|disable) act only on the
 * caller's own account. Not owner-gated — MFA is per individual.
 */
export const metadata: Metadata = { title: "Security" };
export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  const me = await currentAdmin();
  // The env break-glass bootstrap owner has no DB record → it can't enrol MFA.
  const record = me ? await findAdminById(me.adminId) : null;

  return (
    <>
      <Topbar kicker="ACCESS" title="Your security" />
      <PanelBody>
        {!record ? (
          <div
            style={{
              ...CARD,
              padding: "20px 22px",
              borderLeft: "4px solid #D99A4E",
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: 10,
                letterSpacing: "0.08em",
                color: "#A66A1F",
              }}
            >
              NO ADMIN ACCOUNT
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, margin: "8px 0 4px" }}>
              You&apos;re signed in with the bootstrap owner password.
            </div>
            <div style={{ fontSize: 13.5, color: "#4A554D", lineHeight: 1.5 }}>
              Two-factor auth is set up per admin account. Sign in as a real
              admin account (from{" "}
              <span style={{ fontFamily: MONO, fontSize: 12 }}>/admin/admins</span>
              ) to enable it.
            </div>
          </div>
        ) : (
          <SecurityManager
            email={record.email}
            mfaEnabled={Boolean(record.mfa)}
          />
        )}
      </PanelBody>
    </>
  );
}
