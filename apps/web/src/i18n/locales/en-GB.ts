/**
 * en-GB — European / UK English. GENERATED FROM en-US.ts.
 *
 * This is what EU / Ireland / UK visitors see (the Ireland-first default).
 * Keys are byte-identical to en-US; only spelling changes. The transformation
 * applied to the baseline (see docs/LOCALIZATION.md for the full rule list):
 *
 *   optimization → optimisation   center → centre       prioritized → prioritised
 *   color → colour                personalize → personalise
 *   favor → favour                organize → organise    "while" → "whilst" (where natural)
 *
 * Only four strings in the current surface actually differ (help, copyright,
 * step3Body, finalCta.helpBtn) — the rest of the copy is spelling-neutral and
 * is copied verbatim. Prices, brand names and numbers are NEVER changed.
 */

import type { Messages } from "./en-US";

const enGB: Messages = {
  nav: {
    brand: "Arcaevo",
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
      help: "Help centre",
      privacy: "Privacy policy",
      dataDeletion: "Data deletion & export",
      gdpr: "GDPR consent",
      cookies: "Cookie policy",
      terms: "Terms of service",
      subprocessors: "Sub-processors",
      clinicalSafety: "Clinical safety",
    },
    copyright:
      "© 2026 Arcaevo — a product of Codú Limited, registered in Ireland · Wellness & optimisation, not medical diagnosis. Always consult your GP for medical concerns.",
    staffLogin: "Staff login →",
  },

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
        "Your AI coach gives you one or two prioritised changes — and tracks whether they're working at your next test.",
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
      plansBtn: "See membership plans",
      helpBtn: "Questions? Help centre",
    },
  },

  common: {
    skipToContent: "Skip to content",
  },
};

export default enGB;
