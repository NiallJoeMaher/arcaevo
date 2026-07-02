/**
 * Unit tests for src/lib/emails.ts — the E1–E11 transactional suite.
 * renderEmail is pure (no Mongo, no vendor), so the whole suite runs dry.
 *
 * The rules that matter most (design_handoff_v2 §12):
 *  - E7 contains NO health values — only the invitation to open the app.
 *  - E8 shows the price and gives the cancel link EQUAL weight.
 *  - E9 is calm ("A small hiccup with your renewal").
 *  - One layout for all eleven: orb, serif headline, one button, footer.
 */
import { describe, expect, it } from "vitest";
import { renderEmail, type EmailTemplateId, type EmailTemplates } from "@/lib/emails";

/** One valid params object per template — reused across layout tests. */
const SAMPLES: { [K in EmailTemplateId]: EmailTemplates[K] } = {
  e1_verify: { confirmUrl: "https://arcaevo.com/verify?token=t1" },
  e2_magic_link: { signinUrl: "https://arcaevo.com/verify?token=t2" },
  e3_password_reset: { resetUrl: "https://arcaevo.com/verify?token=t3&reset=1" },
  e4_receipt: {
    firstName: "Aoife",
    tierLabel: "Essential",
    priceEur: 329,
    cardSummary: "Visa ···· 4242",
    dateLabel: "2 July 2026",
    invoiceNumber: "2026-0847",
    appUrl: "https://arcaevo.com/app",
  },
  e5_kit_shipped: {
    expectedDayLabel: "Thursday",
    trackingCode: "CE 4471 8820 3 IE",
    trackingUrl: "https://track.anpost.ie/CE447188203IE",
  },
  e6_sample_received: {
    clinicianName: "Dr. Nolan",
    journeyUrl: "https://arcaevo.com/account",
  },
  e7_results_ready: {
    firstName: "Aoife",
    panelMonthLabel: "July",
    previousMonthLabel: "January",
    clinicianName: "Dr. Nolan",
    resultsUrl: "https://arcaevo.com/account",
  },
  e8_renewal: {
    tierLabel: "Essential",
    renewalDateLabel: "2 August",
    priceEur: 329,
    cardSummary: "Visa ···· 4242",
    keepUrl: "https://arcaevo.com/account",
    cancelUrl: "https://arcaevo.com/account?cancel=1",
  },
  e9_payment_failed: {
    cardSummary: "Visa ···· 4242",
    pauseDateLabel: "16 July",
    updateCardUrl: "https://arcaevo.com/account",
  },
  e10_waitlist_joined: {
    county: "Cork",
    position: 214,
    fusionUrl: "https://arcaevo.com/pricing",
  },
  e11_county_open: {
    county: "Cork",
    routingKey: "T12",
    firstN: 400,
    foundingPriceEur: 279,
    claimUrl: "https://arcaevo.com/checkout",
  },
};

const ALL_TEMPLATES = Object.keys(SAMPLES) as EmailTemplateId[];

describe("one shared layout for all eleven", () => {
  it("every email renders the orb, a headline and the footer hairline", () => {
    for (const template of ALL_TEMPLATES) {
      const { subject, html } = renderEmail(template, SAMPLES[template] as never);
      expect(subject.length).toBeGreaterThan(0);
      expect(html).toContain("radial-gradient(circle at 32% 30%, #5FB592, #1E5C45 70%)"); // brand orb
      expect(html).toContain("Instrument Serif"); // serif headline
      expect(html).toContain("border-top:1px solid rgba(28,38,32,0.08)"); // footer rule
    }
  });
});

describe("subject lines set the voice (verbatim from §12)", () => {
  it.each([
    ["e1_verify", "Confirm it's you"],
    ["e2_magic_link", "Your sign-in link"],
    ["e3_password_reset", "Set a new password"],
    ["e4_receipt", "You're a member — here's everything"],
    ["e5_kit_shipped", "Your kit is on its way"],
    ["e6_sample_received", "It's at the lab — results in 24–48h"],
    ["e8_renewal", "Your year, and what's next"],
    ["e9_payment_failed", "A small hiccup with your renewal"],
  ] as [EmailTemplateId, string][])("%s → %j", (template, subject) => {
    expect(renderEmail(template, SAMPLES[template] as never).subject).toBe(subject);
  });
});

describe("E7 results ready — NEVER contains values", () => {
  it("renders the invitation, not the results", () => {
    const { subject, html } = renderEmail("e7_results_ready", SAMPLES.e7_results_ready);
    expect(subject).toBe("Your results are ready, Aoife");
    expect(html).toContain("Reviewed, signed off, and waiting for you.");
    expect(html).toContain("We never include health values in email");

    // No biomarker names, units or numeric values anywhere in the body.
    for (const forbidden of ["ApoB", "mmol", "mg/L", "µg/L", "g/L", "hs-CRP", "ferritin", "cholesterol"]) {
      expect(html).not.toContain(forbidden);
    }
    // The only text content is copy + month/name labels — assert no digits at
    // all outside HTML attributes (strip tags first).
    const textOnly = html.replace(/<[^>]*>/g, " ");
    expect(textOnly).not.toMatch(/\d/);
  });

  it("the params type carries no field that could hold a value", () => {
    // Compile-time guarantee, spot-checked at runtime: every param is a label/URL.
    for (const value of Object.values(SAMPLES.e7_results_ready)) {
      expect(typeof value).toBe("string");
    }
  });
});

describe("E8 renewal — equal-weight cancel (EU consumer rules)", () => {
  it("contains BOTH the keep and cancel links as equal buttons", () => {
    const { html } = renderEmail("e8_renewal", SAMPLES.e8_renewal);
    expect(html).toContain('href="https://arcaevo.com/account"');
    expect(html).toContain('href="https://arcaevo.com/account?cancel=1"');
    expect(html).toContain(">Keep my membership</a>");
    expect(html).toContain(">Cancel renewal</a>");
    // Equal weight: both live in the same flex row, both flex:1.
    const buttonsRow = html.slice(html.indexOf('display:flex;gap:10px'));
    expect((buttonsRow.match(/flex:1/g) ?? []).length).toBeGreaterThanOrEqual(2);
    // Price + renewal date shown, cancellation honesty in the footer.
    expect(html).toContain("2 August at €329");
    expect(html).toContain("Cancelling keeps full access until 2 August");
  });
});

describe("E9 payment failed — calm, not alarming", () => {
  it("keeps the designed tone and the read-only promise", () => {
    const { html } = renderEmail("e9_payment_failed", SAMPLES.e9_payment_failed);
    expect(html).toContain("Your card said no. Your data isn't going anywhere.");
    expect(html).toContain("your membership pauses on 16 July — read-only, nothing deleted, resume anytime");
    expect(html).toContain(">Update my card</a>");
  });
});

describe("waitlist pair — E10 joined, E11 county open", () => {
  it("E10 states the position, the county and the Fusion alternative", () => {
    const { subject, html } = renderEmail("e10_waitlist_joined", SAMPLES.e10_waitlist_joined);
    expect(subject).toBe("You're on the list for Cork");
    expect(html).toContain("№ 214 in Cork. We open by demand.");
    expect(html).toContain("Start with Fusion meanwhile — €119/yr");
  });

  it("E11 keeps the promise with the founding-member window", () => {
    const { subject, html } = renderEmail("e11_county_open", SAMPLES.e11_county_open);
    expect(subject).toBe("Cork, you're up.");
    expect(html).toContain("We said you'd be next. You're next.");
    expect(html).toContain("first 400");
    expect(html).toContain("€279 for year one");
    expect(html).toContain(">Claim founding-member pricing</a>");
  });
});
