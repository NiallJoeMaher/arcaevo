/**
 * POST /api/v1/auth/reset/confirm — set the new password.
 *
 * Body: { token, newPassword }. On success (README §3):
 *  - password replaced (scrypt), failed-attempt counter cleared
 *  - ALL other sessions revoked ("signs out all other sessions")
 *  - a fresh session opened for this device
 *  - confirmation email sent — "so you always know when it changes" (E3 copy)
 */
import { parseJsonBody } from "@/lib/api";
import { collections } from "@/lib/db";
import { renderEmailLayout } from "@/lib/emails";
import {
  clearFailedAttempts,
  consumeMagicLink,
  createSession,
  findUserByEmail,
  hashPassword,
  revokeSessions,
  setMemberSessionCookie,
} from "@/lib/member-auth";
import { ResetConfirmInput } from "@/lib/models";
import { emailVendor } from "@/lib/vendors/email.mock";

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, ResetConfirmInput);
  if (!parsed.ok) return parsed.response;

  const result = await consumeMagicLink(parsed.data.token);
  if (result.state !== "valid" || result.purpose !== "reset") {
    const expired = result.state === "expired" || result.state === "used";
    return Response.json(
      {
        error: expired ? "link_expired" : "link_invalid",
        message: expired
          ? "That link has expired — they only live 30 minutes."
          : "That link isn't valid.",
      },
      { status: 401 }
    );
  }

  const user = await findUserByEmail(result.email);
  if (!user) {
    return Response.json(
      { error: "link_invalid", message: "That link isn't valid." },
      { status: 401 }
    );
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await collections.users().then((c) =>
    c.updateOne(
      { _id: user._id },
      { $set: { passwordHash, emailVerified: true, ...clearFailedAttempts() } }
    )
  );

  // Sign out everywhere else, then open a fresh session for this device.
  await revokeSessions(user._id);
  const { token } = await createSession(
    user._id,
    req.headers.get("user-agent") ?? "unknown"
  );
  await setMemberSessionCookie(token);

  // Confirmation email (ops notice; not one of the 11 designed templates).
  await emailVendor.send({
    to: user.email,
    subject: "Your password was changed",
    body: renderEmailLayout({
      headline: "Your password was changed.",
      bodyHtml:
        '<p style="font-size:13px;line-height:1.6;color:#4A554D;margin:0 0 18px;">Every other session has been signed out. If this wasn\'t you, reply to this email — a person reads it.</p>',
      footerHtml: "Arcaevo — a product of Codú Limited · Dublin, Ireland",
    }),
    template: "password_changed",
  });

  return Response.json({
    ok: true,
    member: { id: user._id, email: user.email, name: user.name },
    sessionToken: token,
    otherSessionsRevoked: true,
  });
}
