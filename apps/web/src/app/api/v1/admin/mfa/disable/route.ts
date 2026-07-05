/**
 * POST /api/v1/admin/mfa/disable — turn OFF TOTP MFA for the SIGNED-IN admin.
 *
 * Requires a current second factor (TOTP or a single-use backup code) so a
 * hijacked *session* alone can't strip MFA off the account. OWNER OVERRIDE:
 * an owner may disable their own MFA without a code (break-glass recovery from a
 * lost authenticator). NOTE for review: whether owners should get this override
 * — and whether MFA should ever be mandatory-for-owners — is a founder policy
 * decision (docs/legal/ADMIN_AUTH_OPTIONS.md).
 */
import { currentAdmin, requireAdmin } from "@/lib/auth";
import { findAdminById } from "@/lib/admin-auth";
import { disableAdminMfa, verifyAdminSecondFactor } from "@/lib/admin-mfa";
import { logAdminAccess } from "@/lib/admin-audit";
import { parseJsonBody } from "@/lib/api";
import { clientIp } from "@/lib/rate-limit";
import { AdminMfaDisableInput } from "@/lib/models";

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const me = await currentAdmin();
  const record = me ? await findAdminById(me.adminId) : null;
  if (!me || !record) {
    return Response.json(
      { error: "no_account", message: "No admin account." },
      { status: 400 }
    );
  }
  if (!record.mfa) {
    return Response.json(
      { error: "not_enabled", message: "MFA is not enabled on this account." },
      { status: 400 }
    );
  }

  const parsed = await parseJsonBody(req, AdminMfaDisableInput);
  if (!parsed.ok) return parsed.response;

  const isOwnerOverride = me.role === "owner";
  const code = parsed.data.code ?? "";
  const codeOk = code
    ? await verifyAdminSecondFactor(record, code)
    : false;

  if (!codeOk && !isOwnerOverride) {
    return Response.json(
      {
        error: "bad_code",
        message: "Enter a current authenticator or backup code to turn MFA off.",
      },
      { status: 400 }
    );
  }

  await disableAdminMfa(me.adminId);
  logAdminAccess({
    action: "admin.mfa.disable",
    adminId: me.adminId,
    role: me.role,
    ip: clientIp(req),
  });

  return Response.json({ ok: true });
}
