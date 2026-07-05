/**
 * POST /api/v1/admin/mfa/enable — finish TOTP enrolment for the SIGNED-IN admin.
 *
 * Body: { secret (from /mfa/setup), code (a current TOTP) }. We verify the code
 * against the pending secret (proof the authenticator is set up), then SEAL the
 * secret (AES-256-GCM) and persist it with 8 freshly generated backup codes.
 * The raw backup codes are returned ONCE here and never again — only their
 * SHA-256 hashes are stored. Idempotency: re-enabling replaces the secret and
 * mints a new backup-code set.
 */
import { currentAdmin, requireAdmin } from "@/lib/auth";
import { findAdminById } from "@/lib/admin-auth";
import { buildMfaEnrollment, enableAdminMfa } from "@/lib/admin-mfa";
import { logAdminAccess } from "@/lib/admin-audit";
import { parseJsonBody } from "@/lib/api";
import { clientIp } from "@/lib/rate-limit";
import { AdminMfaEnableInput } from "@/lib/models";

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const me = await currentAdmin();
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

  const parsed = await parseJsonBody(req, AdminMfaEnableInput);
  if (!parsed.ok) return parsed.response;
  const { secret, code } = parsed.data;

  // Validate the secret + prove the authenticator (verify the code), then seal
  // the secret and mint backup codes. Shared with the mandatory-enrolment route.
  const built = buildMfaEnrollment(secret, code);
  if (!built.ok) {
    return Response.json(
      { error: built.error, message: built.message },
      { status: 400 }
    );
  }

  await enableAdminMfa(me.adminId, built.mfa);

  logAdminAccess({
    action: "admin.mfa.enable",
    adminId: me.adminId,
    role: me.role,
    ip: clientIp(req),
  });

  // Backup codes are returned exactly once — the client must show + let the
  // admin save them now.
  return Response.json({ ok: true, backupCodes: built.backupCodes });
}
