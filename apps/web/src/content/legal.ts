/**
 * Legal / trust document content.
 *
 * Originally extracted from design_handoff/designs/Legal.dc.html, then
 * HARDENED for the Irish GDPR Art. 9 (special-category health data) launch:
 * the privacy policy and terms are reconciled to the interim data controller
 * **Codú Limited** (registered in Ireland; Arcaevo is a product of Codú
 * Limited) with the role-based contact privacy@arcaevo.com. This is current
 * best-effort DRAFT copy — comprehensive and grounded in what the app
 * actually does — pending final review and sign-off by a solicitor / data-
 * protection professional. See docs/legal/README.md and
 * docs/PRELAUNCH_CHECKLIST.md. Keep this in sync with docs/legal/* where they
 * overlap; keep every wellness-not-diagnosis disclaimer intact.
 */

/** A section within a legal document. */
export interface LegalSection {
  /** Section heading. */
  h: string;
  /** Body paragraphs, in order. */
  paras: string[];
  /** Optional bullet list rendered after the paragraphs. */
  items: string[];
  /** True when this section renders a bullet list (items.length > 0). */
  hasList: boolean;
}

/** A full legal / trust document. */
export interface LegalDoc {
  slug: string;
  /** Kicker label, e.g. "PRIVACY". */
  kicker: string;
  title: string;
  /** "Last updated" line. */
  updated: string;
  /** Lead paragraph shown above the sections. */
  intro: string;
  sections: LegalSection[];
}

/** Sidebar nav entry (order + label) for the legal section. */
export interface LegalNavEntry {
  slug: string;
  label: string;
}

// Section factory mirroring the prototype's S(h, paras, items) helper.
const S = (h: string, paras: string[], items?: string[]): LegalSection => ({
  h,
  paras,
  items: items || [],
  hasList: !!(items && items.length),
});

export const legalDocs: Record<string, LegalDoc> = {
  privacy: {
    slug: "privacy",
    kicker: "PRIVACY",
    title: "Privacy policy",
    updated: "Last updated 1 July 2026 · Version 2026-07-01",
    intro:
      "This policy explains what personal data Arcaevo collects, why, on what legal basis, who we share it with, how long we keep it, how we protect it, and the rights you have under the EU General Data Protection Regulation (GDPR) and the Irish Data Protection Act 2018. Your health data is special-category data under GDPR Article 9 and we treat it with the highest level of care. This is current best-effort copy pending final review by our solicitor; we will update it before it materially changes.",
    sections: [
      // Controller reconciled to the interim controller, Codú Limited, and the
      // data-protection contact set to the durable role-based address
      // privacy@arcaevo.com (deliverable via the SES-verified arcaevo.com
      // domain — see docs/EMAIL_ADDRESSES.md). Add Codú Limited's CRO number
      // once confirmed ([TODO: CRO number]), and revisit if/when the
      // controller transfers to a dedicated Arcaevo entity. No DPO is named:
      // at trial scale none is appointed yet — see
      // docs/legal/DPO_NOT_REQUIRED_MEMO.md; do NOT label this contact "DPO".
      // Reconciliation tracked in docs/PRELAUNCH_CHECKLIST.md §1.2/1.6.
      S("Who we are (data controller)", [
        "Arcaevo is a product of Codú Limited, a company registered in Ireland (company registration number [TODO: CRO number]), with its registered office in Dublin, Ireland. Codú Limited is the data controller for the personal data described in this policy and decides why and how it is processed.",
        "We process data in the European Union. For any data-protection question, or to exercise the rights set out below, contact our privacy team at privacy@arcaevo.com. This is a monitored, role-based address, not a named Data Protection Officer — at our current scale we are not required to appoint a DPO, and we will do so if and when that changes.",
      ]),
      S(
        "What data we process",
        ["We collect only what we need to provide and improve your health programme. Depending on which features you use, this includes:"],
        [
          "Account and identity data: your name, email address, date of birth (to confirm you are 18+ and to interpret age-relative ranges) and, for physical tests, your delivery address.",
          "Special-category health data (GDPR Art. 9): blood-test results and the biomarkers measured, the vitals and activity metrics you sync from Apple Watch and Apple Health (a small set of daily aggregates such as sleep, heart-rate variability, resting heart rate and activity), your in-app check-ins, clinician review notes, and — only if you explicitly turn it on — cycle-tracking data.",
          "Membership and payment data: your plan, order history and billing details. Card numbers are handled directly by our payment processor and are never stored by us.",
          "Communications and support data: messages you send us and the transactional emails we send you (magic-link sign-in codes, receipts, results-ready and fasting reminders).",
          "Usage and device data: how you use the app and basic technical logs, to keep the service working, secure and improving. Optional, consent-gated product analytics are covered under Cookies & analytics below.",
        ],
      ),
      S("Special-category (health) data", [
        "Your blood biomarkers, wearable vitals, check-ins and optional cycle data reveal information about your health, so they are special-category personal data under GDPR Article 9. We give them extra protection: they are processed only for your programme, kept within the EU, access-controlled, and never used for advertising, sold, or sent to our product-analytics tools.",
      ]),
      S(
        "Why we process it (lawful basis)",
        ["We must have a lawful basis for every use of your data. Ours are:"],
        [
          "Your explicit consent under Art. 9(2)(a) — the specific legal basis for processing your special-category health data (bloods, wearables, check-ins, cycle) to build your baseline, trends, insights and coaching. This is separate to, and additional to, our Art. 6 basis.",
          "Performance of a contract (Art. 6(1)(b)) — to create and run your account, fulfil tests and deliver your membership.",
          "Legitimate interests (Art. 6(1)(f)) — to keep the service secure, prevent abuse, and understand product usage in an aggregated way, balanced against your rights.",
          "Legal obligation (Art. 6(1)(c)) — where law requires us to keep certain records.",
        ],
      ),
      S("How consent works, and how to withdraw it", [
        "We ask for health-data consent as a clear, affirmative action during onboarding — a deliberate toggle, never a pre-ticked box or a buried clause — and we ask separately for processing bloods and for reading wearables so you can grant each independently. Every consent is recorded with a timestamp, the exact wording version you agreed to, and where you gave it, so we can prove what you agreed to and when. If we materially change the wording, we ask you to re-consent to the new version.",
        "You can withdraw any consent at any time by turning the relevant toggle off in the app; we stop that processing immediately. Withdrawing consent does not affect the lawfulness of processing carried out while the consent was active, and you can still export or delete your data afterwards.",
      ]),
      S(
        "What we use your data for (purposes)",
        ["We use your data to:"],
        [
          "Interpret your bloods against your own baseline and optimal ranges, and fuse them with your wearable context.",
          "Generate your trends, insights and prioritised coaching, and track whether changes are working.",
          "Have a registered clinician review results and flag any value that crosses a defined threshold.",
          "Run your membership, take payment, and send you essential service messages.",
          "Keep the service secure, reliable and — with your optional consent — measurable so we can improve it.",
        ],
      ),
      S(
        "Who we share it with (recipients & sub-processors)",
        [
          "We never sell your data or use it for advertising. We share personal data only with a small number of carefully chosen service providers (sub-processors) that process it strictly on our instructions under a data-processing agreement, and with the clinicians and accredited laboratories needed to deliver your results. Our current and planned infrastructure sub-processors include:",
        ],
        [
          "MongoDB Atlas — encrypted database hosting (EU region).",
          "Vercel — web and application hosting (EU region).",
          "Our email provider (e.g. AWS SES) — transactional email delivery. It never receives your health values or result numbers.",
          "Stripe — payment processing (EU entity). We never store your card number.",
          "PostHog (EU) — optional, consent-gated product analytics. Health data is never sent to analytics.",
          "Registered clinicians and ISO-accredited EU laboratories — to review and process your tests, receiving only the data needed for that purpose.",
        ],
      ),
      S("International data transfers", [
        "We host and process your data in the European Union by design. Some of our providers are EU-hosted but have a US parent company; where a transfer of personal data outside the EEA could occur, we rely on the European Commission's Standard Contractual Clauses (SCCs) and supplementary safeguards. Our up-to-date sub-processor list is on the Sub-processors page.",
      ]),
      S("How long we keep it (retention)", [
        "We keep your health data while your account is active and for a limited period afterwards to meet clinical-record obligations, unless you ask us to delete it sooner. When you ask us to delete your account, we schedule a permanent erasure that runs after a short grace window; backups are purged on their normal rotation cycle within 30 days. We retain only a minimal record of your consent decisions and of the erasure itself — the evidence that a lawful deletion happened — plus anything a specific law requires us to keep, isolated from any other use.",
      ]),
      S(
        "Your rights",
        [
          "Under the GDPR and the Data Protection Act 2018 you have the right to access, rectify (correct), erase, restrict, and object to the processing of your personal data, the right to data portability, and the right to withdraw consent at any time. Many of these are self-service in the app (Profile → Export my data / Delete all my data, and the consent toggles).",
        ],
        [
          "Access — get a copy of the data we hold about you.",
          "Rectification — correct data that is wrong or incomplete.",
          "Erasure — have your data deleted (see Retention above).",
          "Restriction — ask us to pause certain processing.",
          "Portability — receive your data in a machine-readable format, or have it sent onward.",
          "Objection — object to processing based on our legitimate interests.",
          "Withdraw consent — turn off health-data processing at any time.",
        ],
      ),
      S("How to exercise your rights", [
        "Use the in-app controls, or email our privacy team at privacy@arcaevo.com from your registered address. We respond within one month, and usually within a few days. We may ask you to confirm your identity before actioning a request. Exercising these rights is free unless a request is manifestly unfounded or excessive.",
      ]),
      S("Your right to complain (Data Protection Commission)", [
        "If you are unhappy with how we handle your data, we would like the chance to put it right — email privacy@arcaevo.com. You also have the right to lodge a complaint with the Irish supervisory authority, the Data Protection Commission (DPC), at 21 Fitzwilliam Square South, Dublin 2, D02 RD28, or online at www.dataprotection.ie, without going through us first.",
      ]),
      S("Automated processing & profiling", [
        "Your Arcaevo scores, trends and insights are generated with rules and are informational — they help you understand your own numbers. They are not decisions that produce legal or similarly significant effects about you within the meaning of GDPR Article 22, and they are not diagnoses. Any result that crosses a defined clinical threshold is reviewed by a registered human clinician rather than acted on automatically. We do not use your data to make solely-automated decisions with a significant effect on you.",
      ]),
      S("Cookies & analytics", [
        "We keep cookies to a minimum and use no advertising or cross-site tracking cookies — see our Cookie policy. Any product analytics (e.g. PostHog, hosted in the EU) are optional, off until you accept, and used only to understand aggregated app usage. Your special-category health data is never sent to analytics tools.",
      ]),
      S("How we protect it (security)", [
        "Your data is encrypted in transit and stored within the EU. Access is restricted to the minimum staff and clinicians who need it, administrative access supports two-factor authentication (TOTP), and sensitive secrets are encrypted at rest. We minimise what we collect by design — for example only a small set of daily wearable aggregates syncs to our servers, cycle data stays on your device unless you enable it, and no health values are ever placed in emails or push notifications. No system is perfectly secure, but we work to protect your data proportionately to its sensitivity and to detect and respond to incidents.",
      ]),
      S("Children", [
        "Arcaevo is for adults aged 18 and over. It is not intended for children, and we do not knowingly collect data from anyone under 18. If you believe a minor has given us data, contact privacy@arcaevo.com and we will delete it.",
      ]),
      S("Changes to this policy", [
        "We may update this policy as the product and our providers evolve. We show the effective date and version at the top, and for material changes — especially to how we use your health data — we will tell you and, where required, ask for fresh consent. Continued use after an update means you have seen the current version.",
      ]),
      S("Wellness, not diagnosis", [
        "Arcaevo is a wellness and optimisation service for healthy adults, not a medical device, diagnosis or treatment, and not a substitute for professional medical care. Always consult your GP about symptoms or concerns, and call 112 in an emergency. See our Clinical safety page for details.",
      ]),
    ],
  },
  "data-deletion": {
    slug: "data-deletion",
    kicker: "YOUR DATA",
    title: "Data deletion & export",
    updated: "Last updated 1 July 2026",
    intro:
      "You own your data. This page explains exactly how to get a full copy of everything we hold, and how to permanently delete it — both in one tap, with no retention games.",
    sections: [
      S("Export everything", [
        "In the app, go to Profile → Export my data. We generate a complete, machine-readable copy of your results, trends, wearable data and account details, plus a clinician-friendly PDF you can share with your GP. Exports are ready within minutes and delivered securely.",
      ]),
      S(
        "Delete everything",
        [
          "Go to Profile → Delete all my data. After a confirmation step, we permanently erase your health data, wearable data and account. No shadow copies are kept.",
        ],
        [],
      ),
      S(
        "What deletion removes",
        ["Deletion is comprehensive:"],
        [
          "All blood results, biomarkers and trends.",
          "All connected wearable data.",
          "Your account, profile and coaching history.",
          "Backups are purged on their normal rotation cycle within 30 days.",
        ],
      ),
      S("The one exception", [
        "Where Irish or EU law requires us to keep a minimal record (for example, a proof that a regulated test was performed), we retain only that legally-required minimum, isolated and inaccessible for any other purpose, and delete it as soon as the obligation ends.",
      ]),
      S("Prefer to email?", [
        "You can also email privacy@arcaevo.com from your registered address and we will action any export or deletion request within one month, and usually within a few days.",
      ]),
    ],
  },
  "gdpr-consent": {
    slug: "gdpr-consent",
    kicker: "GDPR",
    title: "GDPR consent explainer",
    updated: "Last updated 1 July 2026",
    intro:
      "Health data is ‘special category’ data under GDPR Article 9, which needs a higher bar than ordinary consent. This page explains, in plain English, exactly what you're agreeing to when you switch on each consent — and how to turn it off.",
    sections: [
      S(
        "Two separate, explicit consents",
        ["We ask for two clear consents during onboarding, and you can grant or revoke each independently:"],
        [
          "Process my bloods — lets us analyse your results and build your trends and coaching.",
          "Read my wearables — lets us fuse Apple Watch and Apple Health data for daily context. (More devices to come.)",
        ],
      ),
      S("What ‘explicit consent’ means", [
        "Explicit consent must be a clear, affirmative action — a deliberate toggle, not a pre-ticked box or a buried clause. We tell you the specific purpose before you consent, and we don't bundle unrelated purposes together.",
      ]),
      S("You can withdraw anytime", [
        "Withdrawing consent is as easy as giving it. Turn either toggle off in the app and we stop that processing immediately. Withdrawing doesn't affect the lawfulness of what we did while consent was active, and you can still export or delete everything.",
      ]),
      S("What we never do with your consent", [
        "Consent to process your health data is strictly for your programme. We never use it to sell data, target ads, or share with third parties beyond the labs, clinicians and sub-processors needed to deliver the service.",
      ]),
      S("Children", [
        "Arcaevo is for adults (18+). We do not knowingly process the data of children.",
      ]),
    ],
  },
  cookies: {
    slug: "cookies",
    kicker: "COOKIES",
    title: "Cookie policy",
    updated: "Last updated 1 July 2026",
    intro:
      "We keep cookies to a minimum. This page lists what we use, why, and how to control them. We do not use advertising or cross-site tracking cookies.",
    sections: [
      S(
        "Categories we use",
        ["Our cookie use falls into three simple buckets:"],
        [
          "Strictly necessary — sign-in, security and load balancing. These can't be switched off.",
          "Preferences — remembering settings like your region. Optional.",
          "Analytics — privacy-friendly, aggregated usage stats to improve the product. Optional and off until you accept.",
        ],
      ),
      S("What we don't use", [
        "No advertising cookies. No cross-site trackers. No selling of browsing data. Ever.",
      ]),
      S("Managing cookies", [
        "You choose your preferences in our cookie banner on first visit, and can change them anytime from the footer. You can also block or delete cookies in your browser settings, though strictly-necessary cookies are required for the site to function.",
      ]),
      S("Third parties", [
        "The few analytics and infrastructure providers we use are listed on our sub-processors page, each under a data-processing agreement and configured for privacy.",
      ]),
    ],
  },
  terms: {
    slug: "terms",
    kicker: "TERMS",
    title: "Terms of service",
    updated: "Last updated 1 July 2026",
    intro:
      "These terms govern your use of Arcaevo's app, website and testing service. By creating an account or ordering a test, you agree to them. Please read the wellness disclaimer carefully.",
    sections: [
      S("Who provides Arcaevo", [
        "Arcaevo is a product of Codú Limited, a company registered in Ireland (company registration number [TODO: CRO number]), with its registered office in Dublin, Ireland. In these terms, \"Arcaevo\", \"we\", \"us\" and \"our\" mean Codú Limited. You can contact us at privacy@arcaevo.com.",
      ]),
      S("The service", [
        "Arcaevo provides at-home blood testing, interpretation, wearable fusion and coaching for wellness and optimisation. We are not a medical practice and do not provide diagnosis or treatment.",
      ]),
      S("Wellness, not medical advice", [
        "Arcaevo is designed for healthy adults optimising their health. Our insights are not a diagnosis and are not a substitute for professional medical care. When a result crosses a clinical threshold we flag it and advise you to consult your GP. Always seek medical advice for symptoms or concerns, and call 112 in an emergency.",
      ]),
      S("Your responsibilities", [
        "You agree to provide accurate information, follow test instructions (including fasting), use the service lawfully, and keep your login secure. Results depend on correct sample collection.",
      ]),
      S("Membership & payment", [
        "Membership is billed annually and renews unless cancelled. You can cancel anytime and keep access until the end of your paid term. Included tests ship or are booked when you join; extra tests and cadence bundles are charged per order. A test is fully refundable until the kit ships or the draw is booked; once a sample is processed it is non-refundable. Prices include kit or nurse visit, processing, clinician review and app access.",
      ]),
      S("Liability", [
        "To the fullest extent permitted by Irish law, Arcaevo is not liable for decisions you make based on wellness insights, or for outcomes that fall outside the scope of a wellness service. Nothing in these terms limits liability that cannot be limited by law.",
      ]),
      S("Governing law", [
        "These terms are governed by the laws of Ireland, and the courts of Ireland have exclusive jurisdiction.",
      ]),
    ],
  },
  dpa: {
    slug: "dpa",
    kicker: "SUB-PROCESSORS",
    title: "Data processing & sub-processors",
    updated: "Last updated 1 July 2026",
    intro:
      "To run Arcaevo we rely on a small number of carefully-chosen sub-processors, each under a data-processing agreement (DPA) and, where relevant, EU Standard Contractual Clauses. This page lists them and what they do.",
    sections: [
      S("Our commitments", [
        "Every sub-processor is contractually bound to process data only on our instructions, apply strong security, and support your GDPR rights. We keep data in the EU wherever possible and assess any transfer carefully.",
      ]),
      S(
        "Infrastructure",
        [
          "Cloud hosting and encrypted storage within the EU (eu-west-1), providing the compute and databases that run the app and store your records.",
        ],
        [],
      ),
      S(
        "Laboratories",
        [
          "ISO-accredited EU laboratories that process your blood samples and return results. They receive only the data needed to run and report your test.",
        ],
        [],
      ),
      S(
        "Clinical review",
        [
          "Registered clinicians who review and sign off results. Access is logged and limited to the records they are reviewing.",
        ],
        [],
      ),
      S(
        "AI narration",
        [
          "A large-language-model provider used solely to turn deterministic rule outputs into plain-English explanations. It is contractually prohibited from training on your data, and it cannot set clinical thresholds.",
        ],
        [],
      ),
      S("Payments & messaging", [
        "A PCI-compliant payment processor (we never store card numbers) and a transactional messaging provider for essential notifications like results-ready and fasting reminders.",
      ]),
      S("Changes", [
        "We update this list before adding a new sub-processor that handles personal data, and members can subscribe to change notifications.",
      ]),
    ],
  },
  "clinical-safety": {
    slug: "clinical-safety",
    kicker: "CLINICAL SAFETY",
    title: "Clinical safety & medical disclaimer",
    updated: "Last updated 1 July 2026",
    intro:
      "Arcaevo is a wellness and optimisation service for healthy adults — not a diagnostic or emergency service. This page sets out our safety posture, how we escalate concerning results, and where our responsibility ends and your GP's begins.",
    sections: [
      S("What Arcaevo is — and isn't", [
        "We help healthy people understand and improve their biomarkers. We do not diagnose disease, prescribe treatment, or replace your doctor. Our insights are for wellness optimisation only.",
      ]),
      S("Deterministic rules, human oversight", [
        "Every clinical call is made by deterministic rules written from the literature by our clinical team, and a registered clinician reviews every panel before release. The AI only explains results in plain English; it cannot invent a threshold or overrule a clinician.",
      ]),
      S(
        "How we escalate concerning results",
        ["When a result crosses a defined clinical threshold, our process is clear:"],
        [
          "The result is flagged to our reviewing clinician rather than coached by the app.",
          "We notify you promptly and advise you, in plain terms, to contact your GP.",
          "Critical values trigger priority review and direct guidance to seek care.",
        ],
      ),
      S("When to seek medical care", [
        "Never rely on Arcaevo for urgent or symptomatic concerns. If you have symptoms, feel unwell, or are worried, contact your GP. In an emergency, call 112 (or your local emergency number) immediately.",
      ]),
      S("Limits of at-home testing", [
        "Home sample collection can occasionally affect certain results. If a result looks inconsistent with how you feel or with your history, we recommend a retest before drawing conclusions, and we flag likely sampling issues where we can detect them.",
      ]),
      S("Your GP remains your medical home", [
        "We're designed to complement, not replace, your relationship with your doctor. One tap generates a clinician-friendly summary you can share with your GP, keeping them at the centre of any medical decisions.",
      ]),
    ],
  },
};

/** Sidebar nav order for the legal section (Legal.dc.html `order`). */
export const legalNav: LegalNavEntry[] = [
  { slug: "privacy", label: "Privacy policy" },
  { slug: "data-deletion", label: "Data deletion & export" },
  { slug: "gdpr-consent", label: "GDPR consent" },
  { slug: "cookies", label: "Cookie policy" },
  { slug: "terms", label: "Terms of service" },
  { slug: "dpa", label: "Sub-processors" },
  { slug: "clinical-safety", label: "Clinical safety" },
];

/** All legal doc slugs in design (sidebar) order. */
export const legalSlugs: string[] = legalNav.map((n) => n.slug);

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return legalDocs[slug];
}
