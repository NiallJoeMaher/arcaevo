// MOCK: Email vendor — the Mongo `outbox` is the source of truth.
//
// Every "send" is appended to the Mongo `outbox` collection (and logged to
// the console) so receipts / kit reminders / results-ready emails are
// inspectable in mongo-express — the e2e suite and the admin views rely on
// this, so the outbox write ALWAYS happens, whatever the provider.
//
// When EMAIL_PROVIDER=mailhog (or =smtp), the same email is ADDITIONALLY
// delivered over real SMTP via email.smtp.ts (nodemailer → the compose
// `mailhog` service, UI at http://localhost:8026). That delivery is
// fire-and-forget: an SMTP failure is logged and never breaks the API
// request that triggered the email. See docs/MOCKED_APIS.md §7:
// productionise with an EU-friendly ESP (e.g. Scaleway TEM, Postmark with
// EU DPA) + real templates.
import { collections } from "@/lib/db";
import { newId } from "@/lib/ids";
import { logError } from "@/lib/log";
import { sendViaSmtp, smtpDeliveryEnabled } from "@/lib/vendors/email.smtp";
import type { EmailVendor } from "@/lib/vendors/types";

class EmailMock implements EmailVendor {
  async send(params: {
    to: string;
    subject: string;
    body: string;
    template: string;
  }): Promise<{ outboxId: string }> {
    const outbox = await collections.outbox();
    const outboxId = newId("email"); // collision-free (see lib/ids) — two
    // concurrent sends can't mint the same _id and fail the insert.
    await outbox.insertOne({
      _id: outboxId,
      to: params.to,
      subject: params.subject,
      body: params.body,
      template: params.template,
      createdAt: new Date(),
    });
    // MOCK: console echo so dev logs show what *would* have been sent.
    console.log(
      `[email.mock] outbox ${outboxId} → ${params.to} · ${params.template} · "${params.subject}"`
    );

    // Optional real SMTP delivery (MailHog / dev ESP) — fire-and-forget so a
    // dead SMTP host can never fail the request that sent the email.
    if (smtpDeliveryEnabled()) {
      void sendViaSmtp({
        to: params.to,
        subject: params.subject,
        html: params.body,
      }).catch((err) => {
        // Structured + PII-free (outbox id + template enum only; never the
        // recipient address or body) so the failure shows in Vercel logs.
        logError("email.smtp.delivery_failed", err, {
          outboxId,
          template: params.template,
        });
      });
    }

    return { outboxId };
  }
}

/** The one EmailVendor the app uses. Swap for a real ESP client here. */
export const emailVendor: EmailVendor = new EmailMock();
