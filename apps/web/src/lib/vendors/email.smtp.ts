/**
 * SMTP email delivery — real nodemailer transport, pointed at a local
 * MailHog by default (docker-compose `mailhog` service: SMTP on host :1026,
 * web UI on http://localhost:8026).
 *
 * This is NOT a replacement for the Mongo outbox (email.mock.ts): the outbox
 * write always happens (e2e specs + the admin views read it). When
 * EMAIL_PROVIDER=mailhog or EMAIL_PROVIDER=smtp, the same rendered email is
 * ADDITIONALLY handed to this transport, fire-and-forget — an SMTP failure is
 * logged and must never break the API request that triggered the email.
 *
 * MailHog speaks plain unauthenticated SMTP, so the defaults use no auth and
 * no TLS. Auth + TLS are OPTIONAL and env-driven, so switching to a real
 * EU-friendly ESP (Scaleway TEM, Postmark EU) is a config change, not a code
 * change:
 *   - SMTP_USER + SMTP_PASS  → both set enables `auth`; unset = no auth (MailHog).
 *   - SMTP_SECURE="true"     → TLS-on-connect (465-style); default false
 *                              (MailHog / STARTTLS on 587).
 *   - EMAIL_FROM             → overrides the From address (defaults to
 *                              "Arcaevo <hello@arcaevo.com>").
 * Credentials are read from the environment and passed straight to nodemailer;
 * they are never logged.
 */
import nodemailer, { type Transporter } from "nodemailer";

/** Default sender for all transactional email (matches EMAIL_FROM in emails.ts). */
export const SMTP_FROM = "Arcaevo <hello@arcaevo.com>";

/** Resolved From header — EMAIL_FROM overrides the default when set. */
function resolveFrom(): string {
  const override = process.env.EMAIL_FROM?.trim();
  return override && override.length > 0 ? override : SMTP_FROM;
}

/** True when the env asks for real SMTP delivery alongside the outbox. */
export function smtpDeliveryEnabled(): boolean {
  const provider = (process.env.EMAIL_PROVIDER ?? "").toLowerCase();
  return provider === "mailhog" || provider === "smtp";
}

/**
 * Build the nodemailer transport config from the environment. Exported so it
 * can be asserted on in tests without opening a socket. Credentials, when
 * present, live only inside the returned object — never logged.
 */
export function buildSmtpTransportConfig(): {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
} {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  return {
    host: process.env.SMTP_HOST ?? "localhost",
    // 1026 = the host-side port of the compose mailhog service (1025/8025
    // are taken by other local projects). Inside compose, SMTP_PORT=1025.
    port: Number(process.env.SMTP_PORT ?? 1026),
    // TLS-on-connect only when explicitly asked for (real ESP on :465).
    // MailHog and STARTTLS (:587) leave this false.
    secure: process.env.SMTP_SECURE === "true",
    // Auth only when BOTH credentials are provided; MailHog stays anonymous.
    ...(user && pass ? { auth: { user, pass } } : {}),
  };
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport(buildSmtpTransportConfig());
  }
  return transporter;
}

/**
 * Send one already-rendered email over SMTP. Throws on transport errors —
 * callers decide whether that's fatal (email.mock.ts fire-and-forgets it).
 */
export async function sendViaSmtp(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  await getTransporter().sendMail({
    from: resolveFrom(),
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
}
