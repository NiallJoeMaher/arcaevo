/**
 * Legal / trust document content, extracted verbatim from
 * design_handoff/designs/Legal.dc.html.
 *
 * All copy is verbatim from the design prototype — do not edit wording or
 * dates here without a matching design change.
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
    updated: "Last updated 1 July 2026",
    intro:
      "This policy explains what personal data Arcaevo collects, why, how we protect it, and the rights you have under the EU General Data Protection Regulation (GDPR). Your health data is special-category data and we treat it with the highest level of care.",
    sections: [
      // TODO(legal): Codú Limited is the interim data controller for the early
      // trials. Add the registered company number (CRO) once confirmed, and
      // revisit if/when the controller transfers to the Arcaevo entity.
      S("Who we are", [
        "Codú Limited is the data controller for the personal data described here. We are based in Dublin, Ireland, and process data in the European Union.",
      ]),
      S(
        "What we collect",
        ["We collect only what we need to provide and improve your health programme:"],
        [
          "Account details: name, email, date of birth and delivery address.",
          "Health data: your blood test results, the biomarkers measured, and clinician review notes.",
          "Wearable data: sleep, heart-rate variability, activity and related metrics you choose to connect.",
          "Usage data: how you use the app, to keep it working and improve it.",
        ],
      ),
      S("Why we process it (lawful basis)", [
        "We rely on your explicit consent (GDPR Article 9) to process your health and wearable data for interpretation and coaching. We rely on contract to fulfil your tests and membership, and on legitimate interests to keep the service secure. You can withdraw consent at any time.",
      ]),
      S("How we protect it", [
        "Your data is encrypted in transit and at rest, stored within the EU (eu-west-1), and access is restricted to the minimum staff and clinicians who need it. We maintain audit logs of access to health records.",
      ]),
      S("Who we share it with", [
        "We never sell your data or use it for advertising. We share it only with the accredited laboratories that process your samples, the clinicians who review your results, and the infrastructure sub-processors listed on our sub-processors page — all under strict data-processing agreements.",
      ]),
      S("Your rights", [
        "Under GDPR you can access, correct, export (portability) and erase your data, restrict or object to processing, and withdraw consent. Most of these are self-service in the app; the rest we action within one month.",
      ]),
      S("Retention", [
        "We keep your health data while your account is active and for a limited period afterwards to meet clinical-record obligations, unless you ask us to delete it sooner. When you delete your account, we permanently erase your data with no copies kept, except where law requires a minimal record.",
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
        "You can also email privacy@arcaevo.health from your registered address and we will action any export or deletion request within one month, and usually within a few days.",
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
