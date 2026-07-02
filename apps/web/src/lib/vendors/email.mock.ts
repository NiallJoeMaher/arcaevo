// MOCK: Email vendor — nothing is ever sent.
//
// Every "send" is appended to the Mongo `outbox` collection (and logged to the
// console) so receipts / kit reminders / results-ready emails are inspectable
// in mongo-express. See docs/MOCKED_APIS.md §7: productionise with an
// EU-friendly ESP (e.g. Scaleway TEM, Postmark with EU DPA) + real templates.
import { collections } from "@/lib/db";
import type { EmailVendor } from "@/lib/vendors/types";

class EmailMock implements EmailVendor {
  async send(params: {
    to: string;
    subject: string;
    body: string;
    template: string;
  }): Promise<{ outboxId: string }> {
    const outbox = await collections.outbox();
    const count = await outbox.countDocuments();
    const outboxId = `email_${String(count + 1).padStart(4, "0")}`;
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
    return { outboxId };
  }
}

/** The one EmailVendor the app uses. Swap for a real ESP client here. */
export const emailVendor: EmailVendor = new EmailMock();
