/**
 * Transactional emails E1–E11 (design_handoff_v2 §12 + §14 X5).
 *
 * One template for all eleven: sender hello@arcaevo.com, the brand orb, one
 * serif headline, a short body, one primary button (E8 adds an equal-weight
 * cancel button — EU consumer rules), plain-text footer. Copy is verbatim
 * from the designed emails, parameterised only where the design shows
 * user-specific values (names, dates, cards, counties, positions).
 *
 * Hard rules:
 *  - E7 (results ready) NEVER contains health values — only the invitation.
 *  - E8 (renewal) shows the price and gives Cancel equal visual weight.
 *  - E9 (payment failed) is calm, not alarming ("A small hiccup…").
 *
 * MOCK: rendered HTML is "sent" via email.mock.ts → the Mongo `outbox`.
 */
import { emailVendor } from "@/lib/vendors/email.mock";
import { canonicalUrl } from "@/lib/seo";

export const EMAIL_FROM = "hello@arcaevo.com";

// --- shared layout -------------------------------------------------------------

interface LayoutParams {
  headline: string;
  /** Paragraph(s) + optional inset cards, already HTML. */
  bodyHtml: string;
  button?: { label: string; url: string };
  /** E8 only: rendered beside the primary button at equal weight. */
  secondaryButton?: { label: string; url: string };
  /** Rendered between the button and the footer (e.g. the sign-in code block). */
  afterButtonHtml?: string;
  footerHtml: string;
}

// Hosted raster: email clients don't render SVG or radial-gradient reliably,
// so the brand mark is a PNG served from the site origin.
const ORB = `<img src="${canonicalUrl(
  "/email-logo.png"
)}" width="48" height="48" alt="Arcaevo" style="display:block;border:0;border-radius:50%;margin-bottom:16px;" />`;

function button(label: string, url: string, variant: "primary" | "outline"): string {
  const style =
    variant === "primary"
      ? "background:#1E5C45;color:#ffffff;border:1px solid #1E5C45;"
      : "background:#FBFAF6;color:#1C2620;border:1px solid rgba(28,38,32,0.2);";
  return `<a href="${url}" style="display:block;flex:1;${style}text-align:center;padding:12px;border-radius:100px;font-weight:600;font-size:13px;text-decoration:none;">${label}</a>`;
}

/** The one email template — logo, serif headline, short body, button, footer. */
export function renderEmailLayout(params: LayoutParams): string {
  const buttons = params.secondaryButton
    ? `<div style="display:flex;gap:10px;margin-bottom:16px;">${button(
        params.button!.label,
        params.button!.url,
        "primary"
      )}${button(params.secondaryButton.label, params.secondaryButton.url, "outline")}</div>`
    : params.button
      ? `<div style="margin-bottom:16px;">${button(params.button.label, params.button.url, "primary")}</div>`
      : "";
  return `<div style="background:#FBFAF6;border:1px solid rgba(28,38,32,0.12);border-radius:16px;max-width:420px;margin:0 auto;font-family:'Hanken Grotesk',Arial,sans-serif;color:#1C2620;">
  <div style="padding:28px 26px;">
    ${ORB}
    <div style="font-family:'Instrument Serif',Georgia,serif;font-size:21px;line-height:1.2;margin-bottom:10px;">${params.headline}</div>
    ${params.bodyHtml}
    ${buttons}
    ${params.afterButtonHtml ?? ""}
    <div style="font-size:11px;color:#7C887F;line-height:1.6;border-top:1px solid rgba(28,38,32,0.08);padding-top:12px;">${params.footerHtml}</div>
  </div>
</div>`;
}

function p(text: string): string {
  return `<p style="font-size:13px;line-height:1.6;color:#4A554D;margin:0 0 18px;">${text}</p>`;
}

function insetCard(html: string): string {
  return `<div style="background:#ffffff;border:1px solid rgba(28,38,32,0.1);border-radius:12px;padding:14px 16px;margin-bottom:14px;">${html}</div>`;
}

/**
 * The prefetch-safe sign-in code block, rendered under the button on the
 * verify + magic-link emails. A human can TYPE this even when a security
 * appliance (Safe Links, Mimecast, Proofpoint) has prefetched and burned the
 * link. `code` is grouped XXX-XXX; `codeUrl` is where to enter it.
 */
function codeBlock(code: string, codeUrl: string): string {
  return `<div style="margin:0 0 16px;padding:14px 16px;background:#ffffff;border:1px solid rgba(28,38,32,0.1);border-radius:12px;text-align:center;">
    <div style="font-size:12px;color:#4A554D;line-height:1.5;margin-bottom:8px;">Or enter this code at <a href="${codeUrl}" style="color:#1E5C45;font-weight:600;text-decoration:none;">arcaevo.com/signin</a>:</div>
    <div style="font-family:'Geist Mono',monospace;font-size:26px;font-weight:600;letter-spacing:0.14em;color:#1C2620;">${code}</div>
    <div style="font-size:11px;color:#7C887F;line-height:1.5;margin-top:8px;">Useful if your email security blocks the link.</div>
  </div>`;
}

// --- template params (type-safe; E7 deliberately CANNOT carry values) ------------

export interface EmailTemplates {
  /** E1 — account verification. `code`/`codeUrl` = the prefetch-safe fallback. */
  e1_verify: { confirmUrl: string; code: string; codeUrl: string };
  /** E2 — magic sign-in link. `code`/`codeUrl` = the prefetch-safe fallback. */
  e2_magic_link: { signinUrl: string; code: string; codeUrl: string };
  /** E3 — password reset. */
  e3_password_reset: { resetUrl: string };
  /** E4 — receipt / welcome. */
  e4_receipt: {
    firstName: string;
    tierLabel: string; // e.g. "Essential"
    priceEur: number;
    cardSummary: string; // e.g. "Visa ···· 4242"
    dateLabel: string; // e.g. "2 July 2026"
    invoiceNumber: string; // e.g. "2026-0847"
    appUrl: string;
  };
  /** E5 — kit shipped (An Post tracking). */
  e5_kit_shipped: {
    expectedDayLabel: string; // e.g. "Thursday"
    trackingCode: string; // e.g. "CE 4471 8820 3 IE"
    trackingUrl: string;
  };
  /** E6 — sample received at the lab. */
  e6_sample_received: { clinicianName: string; journeyUrl: string };
  /** E7 — results ready. NO VALUES — the params make values unrepresentable. */
  e7_results_ready: {
    firstName: string;
    panelMonthLabel: string; // e.g. "July"
    previousMonthLabel: string; // e.g. "January"
    clinicianName: string; // e.g. "Dr. Nolan"
    resultsUrl: string;
  };
  /** E8 — renewal reminder, 30 days out, equal-weight cancel. */
  e8_renewal: {
    tierLabel: string;
    renewalDateLabel: string; // e.g. "2 August"
    priceEur: number;
    cardSummary: string;
    keepUrl: string;
    cancelUrl: string;
  };
  /** E9 — payment failed ("A small hiccup…"). */
  e9_payment_failed: {
    cardSummary: string;
    pauseDateLabel: string; // e.g. "16 July"
    updateCardUrl: string;
  };
  /** E10 — waitlist joined. */
  e10_waitlist_joined: {
    county: string;
    position: number;
    fusionUrl: string;
  };
  /** E11 — county open, founding-member window. */
  e11_county_open: {
    county: string;
    routingKey: string; // e.g. "T12"
    firstN: number; // e.g. 400
    foundingPriceEur: number; // e.g. 279
    claimUrl: string;
  };
  /** E12 — account closure confirmation. NO health values — only the date. */
  e12_closure_confirmation: {
    firstName: string;
    erasureDateLabel: string; // e.g. "2 August 2026" (+30 days)
    appUrl: string;
  };
}

export type EmailTemplateId = keyof EmailTemplates;

export interface RenderedEmail {
  subject: string;
  html: string;
}

// --- renderers (copy verbatim from §12 / §14 X5) ---------------------------------

type Renderers = {
  [K in EmailTemplateId]: (params: EmailTemplates[K]) => RenderedEmail;
};

const renderers: Renderers = {
  e1_verify: ({ confirmUrl, code, codeUrl }) => ({
    subject: "Confirm it's you",
    html: renderEmailLayout({
      headline: "One tap and your account is real.",
      bodyHtml: p(
        "Confirm this address and you're in — your account, your data controls, and plans whenever you're ready. The link lives for 30 minutes."
      ),
      button: { label: "Confirm my email", url: confirmUrl },
      afterButtonHtml: codeBlock(code, codeUrl),
      footerHtml:
        "Didn't create an Arcaevo account? Ignore this and nothing happens.",
    }),
  }),

  e2_magic_link: ({ signinUrl, code, codeUrl }) => ({
    subject: "Your sign-in link",
    html: renderEmailLayout({
      headline: "Tap once, you're in.",
      bodyHtml: p(
        "This link signs you in on this device and expires in 30 minutes. If you didn't request it, ignore this email — nothing happens without the tap."
      ),
      button: { label: "Sign in to Arcaevo", url: signinUrl },
      afterButtonHtml: codeBlock(code, codeUrl),
      footerHtml:
        "Arcaevo — a product of Codú Limited · Dublin, Ireland<br>You're receiving this because a sign-in was requested for this address.",
    }),
  }),

  e3_password_reset: ({ resetUrl }) => ({
    subject: "Set a new password",
    html: renderEmailLayout({
      headline: "Let's get you a fresh one.",
      bodyHtml: p(
        "Tap below to choose a new password. Once it's set, every other session is signed out and we'll confirm by email — so you always know when it changes."
      ),
      button: { label: "Choose a new password", url: resetUrl },
      footerHtml:
        "Wasn't you? Reset anyway, or reply to this email — a person reads it.",
    }),
  }),

  e4_receipt: (params) => ({
    subject: "You're a member — here's everything",
    html: renderEmailLayout({
      headline: `Welcome, ${params.firstName}. Your kit ships today.`,
      bodyHtml:
        insetCard(
          `<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px;"><span>${params.tierLabel} · 1 year</span><span style="font-family:'Geist Mono',monospace;">€${params.priceEur.toFixed(2)}</span></div>` +
            `<div style="display:flex;justify-content:space-between;font-size:11.5px;color:#7C887F;"><span>${params.cardSummary} · ${params.dateLabel}</span><span>Invoice №&nbsp;${params.invoiceNumber}</span></div>`
        ) +
        p(
          "Next: watch for the shipping email, get the iPhone app so your Watch data is flowing, and test on a fasted weekday morning."
        ),
      button: { label: "Download the app", url: params.appUrl },
      footerHtml: "Full refund until your kit ships. Invoice PDF attached.",
    }),
  }),

  e5_kit_shipped: (params) => ({
    subject: "Your kit is on its way",
    html: renderEmailLayout({
      headline: `In the post — expect it ${params.expectedDayLabel}.`,
      bodyHtml:
        insetCard(
          `<div style="display:flex;justify-content:space-between;align-items:center;"><div><div style="font-size:12.5px;font-weight:700;">An Post tracked</div><div style="font-size:11px;color:#7C887F;font-family:'Geist Mono',monospace;">${params.trackingCode}</div></div><a href="${params.trackingUrl}" style="border:1px solid #1C2620;border-radius:100px;padding:7px 13px;font-size:11.5px;font-weight:600;color:#1C2620;text-decoration:none;">Track</a></div>`
        ) +
        p(
          "While you wait: don't change anything about how you eat or train — we want your real baseline, not your best behaviour."
        ),
      footerHtml: `Delivery details wrong? Fix them in Account before ${params.expectedDayLabel}.`,
    }),
  }),

  e6_sample_received: (params) => ({
    subject: "It's at the lab — results in 24–48h",
    html: renderEmailLayout({
      headline: "Your sample made it, in good condition.",
      bodyHtml: p(
        `The lab received it this morning and processing has begun. ${params.clinicianName} reviews every value before you see it — expect the "results ready" email within two working days.`
      ),
      button: { label: "Follow the journey", url: params.journeyUrl },
      footerHtml:
        "Nothing to do now — we'll come to you the moment it's ready.",
    }),
  }),

  // E7 — the invitation, never the values. Params cannot carry a number.
  e7_results_ready: (params) => ({
    subject: `Your results are ready, ${params.firstName}`,
    html: renderEmailLayout({
      headline: "Reviewed, signed off, and waiting for you.",
      bodyHtml: p(
        `Your ${params.panelMonthLabel} panel has been checked by ${params.clinicianName} and is ready in the app — with what changed since ${params.previousMonthLabel} and the one thing most worth doing about it.`
      ),
      button: { label: "Open my results", url: params.resultsUrl },
      footerHtml:
        "We never include health values in email — your results live behind Face ID, not in an inbox.",
    }),
  }),

  e8_renewal: (params) => ({
    subject: "Your year, and what's next",
    html: renderEmailLayout({
      headline: "Twelve months, two panels, one habit that stuck.",
      bodyHtml: p(
        `Your ${params.tierLabel} membership renews on <strong>${params.renewalDateLabel} at €${params.priceEur}</strong> to ${params.cardSummary} — your next baseline kit ships the same day.`
      ),
      button: { label: "Keep my membership", url: params.keepUrl },
      // EU consumer rules: cancel gets equal visual weight.
      secondaryButton: { label: "Cancel renewal", url: params.cancelUrl },
      footerHtml: `Cancelling keeps full access until ${params.renewalDateLabel}, and your data stays yours either way.`,
    }),
  }),

  e9_payment_failed: (params) => ({
    subject: "A small hiccup with your renewal",
    html: renderEmailLayout({
      headline: "Your card said no. Your data isn't going anywhere.",
      bodyHtml: p(
        `The renewal charge to ${params.cardSummary} didn't go through — usually an expired card. We'll retry twice over the next two weeks; your membership and data stay fully active meanwhile.`
      ),
      button: { label: "Update my card", url: params.updateCardUrl },
      footerHtml: `If nothing changes, your membership pauses on ${params.pauseDateLabel} — read-only, nothing deleted, resume anytime.`,
    }),
  }),

  e10_waitlist_joined: (params) => ({
    subject: `You're on the list for ${params.county}`,
    html: renderEmailLayout({
      headline: `№ ${params.position} in ${params.county}. We open by demand.`,
      bodyHtml: p(
        `You'll hear from us once a month on where the map opens next — and the day ${params.county} goes live, you get 30 days of founding-member pricing before anyone else.`
      ),
      button: {
        label: "Start with Fusion meanwhile — €119/yr",
        url: params.fusionUrl,
      },
      footerHtml:
        "Fusion works anywhere today: your Watch plus any past bloodwork. Leave the list anytime with one click.",
    }),
  }),

  e11_county_open: (params) => ({
    subject: `${params.county}, you're up.`,
    html: renderEmailLayout({
      headline: "We said you'd be next. You're next.",
      bodyHtml: p(
        `Essential and Performance now serve ${params.routingKey} and all ${params.county} routing keys. As one of the first ${params.firstN} on the list, your founding-member price — €${params.foundingPriceEur} for year one — holds for 30 days.`
      ),
      button: { label: "Claim founding-member pricing", url: params.claimUrl },
      footerHtml: "Arcaevo — a product of Codú Limited · Dublin, Ireland",
    }),
  }),

  // E12 — closure confirmed. The +30d erasure date, never a single health value.
  e12_closure_confirmation: (params) => ({
    subject: "Your account is closing",
    html: renderEmailLayout({
      headline: `We've started closing your account, ${params.firstName}.`,
      bodyHtml: p(
        `Your consent to process health data is withdrawn, so processing has stopped now. Your results, baselines, history and profile will be erased permanently — from our systems and our lab partners&rsquo; — by <strong>${params.erasureDateLabel}</strong>. Any remaining membership value is refunded pro-rata for unused tests.`
      ),
      button: { label: "Open Arcaevo", url: params.appUrl },
      footerHtml:
        "Changed your mind before then? Reply to this email — a person reads it. We never include health values in email.",
    }),
  }),
};

/** Render a transactional email to {subject, html} — pure, unit-testable. */
export function renderEmail<K extends EmailTemplateId>(
  template: K,
  params: EmailTemplates[K]
): RenderedEmail {
  return renderers[template](params);
}

/** Render + "send" (MOCK: lands in the Mongo outbox, never leaves the box). */
export async function sendEmail<K extends EmailTemplateId>(
  template: K,
  to: string,
  params: EmailTemplates[K]
): Promise<{ outboxId: string }> {
  const { subject, html } = renderEmail(template, params);
  return emailVendor.send({ to, subject, body: html, template });
}
