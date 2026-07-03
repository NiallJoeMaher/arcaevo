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
 * MailHog speaks plain unauthenticated SMTP, so no auth/TLS is configured.
 * To productionise: point SMTP_HOST/SMTP_PORT at an EU-friendly ESP's SMTP
 * endpoint (Scaleway TEM, Postmark EU) and add auth + TLS here.
 */
import nodemailer, { type Transporter } from "nodemailer";

/** Sender for all transactional email (matches EMAIL_FROM in emails.ts). */
export const SMTP_FROM = "Arcaevo <hello@arcaevo.com>";

/** True when the env asks for real SMTP delivery alongside the outbox. */
export function smtpDeliveryEnabled(): boolean {
  const provider = (process.env.EMAIL_PROVIDER ?? "").toLowerCase();
  return provider === "mailhog" || provider === "smtp";
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "localhost",
      // 1026 = the host-side port of the compose mailhog service (1025/8025
      // are taken by other local projects). Inside compose, SMTP_PORT=1025.
      port: Number(process.env.SMTP_PORT ?? 1026),
      secure: false, // MailHog: no TLS…
      // …and no auth. Real ESPs get credentials + TLS at productionisation.
    });
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
    from: SMTP_FROM,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
}
