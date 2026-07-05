/**
 * en-US — THE SOURCE BASELINE for all Arcaevo marketing copy.
 *
 * This file is the single source of truth. Every other locale is generated
 * FROM this one (see docs/LOCALIZATION.md): copy the file, keep the keys
 * byte-for-byte, translate only the *values*. `typeof enUS` (exported as
 * `Messages`) is the shape every locale must satisfy — add a key here first,
 * then to every locale, or the build fails.
 *
 * SPELLING: American English (optimization, center, prioritized, color…).
 * en-GB re-spells these to European/UK English; only spelling differs.
 *
 * HARD RULE — NO PRICES, NO LEGAL TEXT, NO CONTRACTUAL/VERBATIM COPY HERE.
 * The €119/€329/€399 (+€130, €99/€69/€199) numbers, legal documents, and any
 * design-locked verbatim strings stay hardcoded in their pages. A unit test
 * scans this dictionary and fails if a currency amount ever leaks in.
 */

const enUS = {
  /** Global site navigation (SiteNav). */
  nav: {
    brand: "Arcaevo",
    // Keyed by the route key used in SiteNav's NAV_ITEMS.
    items: {
      how: "How it works",
      pricing: "Pricing",
      science: "Science",
      app: "The app",
      compare: "Compare",
      blog: "Blog",
    },
    cta: "Start membership",
  },

  /** Global site footer (SiteFooter). */
  footer: {
    tagline:
      "The interpretation layer for your health. Bloods fused with wearables, read off your own baseline. Dublin, Ireland.",
    badges: {
      ios: "iOS App",
      watch: "Apple Watch",
    },
    columns: {
      product: "PRODUCT",
      company: "COMPANY",
      legal: "TRUST & LEGAL",
    },
    // Keyed by link key used in SiteFooter's link arrays. Hrefs live in the
    // component (structure); only the human label is localized here.
    links: {
      how: "How it works",
      pricing: "Pricing",
      app: "The app",
      science: "Science",
      compare: "Compare",
      about: "About",
      blog: "Blog",
      careers: "Careers",
      contact: "Contact",
      help: "Help center",
      privacy: "Privacy policy",
      dataDeletion: "Data deletion & export",
      gdpr: "GDPR consent",
      cookies: "Cookie policy",
      terms: "Terms of service",
      subprocessors: "Sub-processors",
      clinicalSafety: "Clinical safety",
    },
    // Disclaimer, spelling only ("optimization"/"optimisation"). Never a price.
    copyright:
      "© 2026 Arcaevo — a product of Codú Limited, registered in Ireland · Wellness & optimization, not medical diagnosis. Always consult your GP for medical concerns.",
    staffLogin: "Staff login →",
  },

  /** Home page (/) marketing prose. */
  home: {
    hero: {
      eyebrow: "THE INTERPRETATION LAYER · DUBLIN",
      title: "The numbers were never the problem. The roadmap was.",
      lead: "Everyone else hands you a panel of biomarkers and walks away. Arcaevo fuses your bloods with your Apple Watch, reads them off your own baseline, and gives you two things to change — then proves whether they worked.",
      ctaPrimary: "Order your first test",
      ctaSecondary: "See how it works →",
      badgeLabs: "ACCREDITED EU LABS",
      badgeClinician: "CLINICIAN-REVIEWED",
      badgeGdpr: "GDPR · EU-HOSTED",
    },
    logoStrip: {
      builtFor: "BUILT FOR",
      appleWatch: "Apple Watch",
      appleHealth: "Apple Health",
      iphone: "iPhone",
      roadmap: "WHOOP, Oura & Garmin — on the roadmap",
      readScience: "READ THE SCIENCE →",
    },
    howItWorks: {
      eyebrow: "HOW IT WORKS",
      title: "Test. Understand. Act.",
      step1Title: "Test",
      step1Body:
        "Finger-prick kit to your door, or a nurse to your home for a full venous draw. You choose the depth.",
      step1PillA: "15–35",
      step1PillB: "45–80 markers",
      step2Title: "Understand",
      step2Body:
        "Results land in a beautiful dashboard — every marker against its optimal range, layered with your sleep, HRV and activity.",
      step3Title: "Act",
      step3Body:
        "Your AI coach gives you one or two prioritized changes — and tracks whether they're working at your next test.",
      walkthrough: "The full walkthrough →",
    },
    differentiators: {
      eyebrow: "WHAT NOBODY ELSE DOES",
      title: "Five things the others can't copy.",
      intro:
        "Your blood, your Apple Watch, your baseline. The EU-native membership that tells you what actually moved your numbers.",
      compareCta: "See how we compare →",
    },
    pricingTeaser: {
      eyebrow: "MEMBERSHIP",
      title: "One annual membership. Tests included.",
    },
    credibility: {
      eyebrow: "WHY YOU CAN BELIEVE THE NUMBER",
      title: "How we earn your trust — before you’ve even tested.",
      intro:
        "We’re a new Irish membership with no reviews to show yet, so we won’t invent any. Here’s the honest case for the number you’ll see instead.",
      methodCta: "Read the method →",
      safetyCta: "Our wellness & safety posture →",
    },
    founder: {
      quote:
        "“I built Arcaevo because health data should belong to you — calm, clear, and yours. Not a PDF you can't read, and never something we'd sell.”",
      attribution: "— FOUNDER, ARCAEVO ·",
      storyLink: "OUR STORY",
    },
    finalCta: {
      title: "Start your baseline.",
      // NOTE: the price-bearing sentence stays hardcoded in the page — a
      // contractual €119 must never live in a translatable dictionary.
      plansBtn: "See membership plans",
      helpBtn: "Questions? Help center",
    },
  },

  /** Cross-surface strings shared by several components. */
  common: {
    skipToContent: "Skip to content",
  },
};

/**
 * The dictionary shape every locale must implement.
 *
 * enUS is a plain (non-`as const`) object literal, so TypeScript infers every
 * value as `string` rather than a string literal. `typeof enUS` is therefore
 * "same keys, string values" — annotating en-GB/en-IE with `: Messages`
 * enforces the identical key tree while allowing different copy.
 */
export type Messages = typeof enUS;

export default enUS;
