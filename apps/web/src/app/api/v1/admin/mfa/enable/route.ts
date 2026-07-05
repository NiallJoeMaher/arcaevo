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
import {
  base32Decode,
  enableAdminMfa,
  generateBackupCodes,
  sealSecret,
  verifyTotp,
} from "@/lib/admin-mfa";
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

  // Reject a malformed / too-short secret before trusting it.
  let secretBytes: Buffer;
  try {
    secretBytes = base32Decode(secret);
  } catch {
    return Response.json(
      { error: "bad_secret", message: "Invalid secret." },
      { status: 400 }
    );
  }
  if (secretBytes.length < 16) {
    return Response.json(
      { error: "bad_secret", message: "Secret is too short." },
      { status: 400 }
    );
  }

  if (!verifyTotp(secret, code)) {
    return Response.json(
      {
        error: "bad_code",
        message: "That code didn't match — check your authenticator and retry.",
      },
      { status: 400 }
    );
  }

  const { codes, hashes } = generateBackupCodes();
  // sealSecret() throws in production if MFA_ENC_KEY is unset (fail-closed) —
  // that surfaces as a 500 rather than storing an unsealed/weakly-sealed secret.
  const secretEnc = sealSecret(secret);
  await enableAdminMfa(me.adminId, {
    enabledAt: new Date(),
    secretEnc,
    backupCodeHashes: hashes,
  });

  logAdminAccess({
    action: "admin.mfa.enable",
    adminId: me.adminId,
    role: me.role,
    ip: clientIp(req),
  });

  // Backup codes are returned exactly once — the client must show + let the
  // admin save them now.
  return Response.json({ ok: true, backupCodes: codes });
}
