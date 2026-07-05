/**
 * POST /api/v1/admin/mfa/setup — begin TOTP enrolment for the SIGNED-IN admin.
 *
 * Returns a FRESH base32 secret + its otpauth:// URI. Nothing is persisted yet
 * and MFA is NOT enabled by this call — the admin adds the secret to their
 * authenticator, then proves it works via POST /api/v1/admin/mfa/enable (which
 * seals + stores it). The secret is round-tripped through the client (shown to
 * the admin anyway) rather than stashed server-side, so there is no half-built
 * pending state to reap.
 */
import { currentAdmin, requireAdmin } from "@/lib/auth";
import { findAdminById } from "@/lib/admin-auth";
import { generateTotpSecret, totpUri } from "@/lib/admin-mfa";
import { logAdminAccess } from "@/lib/admin-audit";
import { clientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const me = await currentAdmin();
  // MFA lives on a real admin record; the env break-glass bootstrap owner has
  // none, so it can't self-enrol (sign in as a real seeded owner to do that).
  const record = me ? await findAdminById(me.adminId) : null;
  if (!me || !record) {
    return Response.json(
      {
        error: "no_account",
        message:
          "MFA can only be enrolled on a real admin account, not the bootstrap owner.",
      },
      { status: 400 }
    );
  }

  const secret = generateTotpSecret();
  logAdminAccess({
    action: "admin.mfa.setup",
    adminId: me.adminId,
    role: me.role,
    ip: clientIp(req),
  });

  return Response.json({
    secret,
    otpauthUri: totpUri({ email: record.email, secret }),
  });
}
