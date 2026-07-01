/**
 * Help centre / FAQ content, extracted verbatim from
 * design_handoff/designs/Help.dc.html.
 *
 * All copy is verbatim from the design prototype — do not edit wording,
 * prices or dates here without a matching design change.
 */

/** A single question/answer pair in a FAQ group. */
export interface HelpItem {
  q: string;
  a: string;
}

/** A titled group of FAQ items. */
export interface HelpGroup {
  title: string;
  items: HelpItem[];
}

/**
 * Category chips shown above the accordion (Help.dc.html `cats`),
 * in design order.
 */
export const helpCategories: string[] = [
  "Testing",
  "Results",
  "The app",
  "Billing",
  "Privacy",
  "Wearables",
];

/** The four FAQ accordion groups, in design order. */
export const helpGroups: HelpGroup[] = [
  {
    title: "Testing & samples",
    items: [
      {
        q: "What's the difference between finger-prick and venous?",
        a: "A finger-prick kit is posted to your door and covers 15–35 markers — great for regular tracking. An in-home venous draw is done by a nurse who visits you and unlocks the full 45–80 marker panel, including hormones and advanced lipids. You can mix both across a year.",
      },
      {
        q: "Do I need to fast before a test?",
        a: "For most panels, yes — a 10-hour fast gives the cleanest glucose and lipid readings. We send a fasting reminder to your Watch the night before, and the app tells you exactly which tests need it.",
      },
      {
        q: "How is my sample collected and shipped?",
        a: "Finger-prick kits include a prepaid return envelope; drop it in any post box. Venous samples are handled by the visiting phlebotomist. Both are processed in ISO-accredited EU laboratories.",
      },
    ],
  },
  {
    title: "Results & the app",
    items: [
      {
        q: "How long until I get results?",
        a: "Typically 5–7 days from when the lab receives your sample. A registered clinician reviews every panel before it's released to your app, and you're notified the moment it lands.",
      },
      {
        q: "What does ‘read against your baseline’ mean?",
        a: "Instead of only comparing you to a wide population range, we track each marker against your own history. Using Reference Change Value, we only flag a change as real when it exceeds the combined analytical and biological noise — so you're not chasing meaningless wobble.",
      },
      {
        q: "Can the AI coach give me medical advice?",
        a: "No. The coach explains your results and the deterministic rules in plain English and answers questions grounded in your data. It cannot diagnose, prescribe, or set thresholds. Anything clinical is flagged to our reviewing doctor and, where needed, back to your GP.",
      },
    ],
  },
  {
    title: "Billing & membership",
    items: [
      {
        q: "Why is membership annual?",
        a: "Your tests are real-world cost — kits, labs, nurses — so annual billing covers them upfront, and your first test ships or gets booked the day you join. The product also works over time: baselines and retest verdicts take most of a year to prove themselves. Monthly billing is on the roadmap.",
      },
      {
        q: "Can I test more than twice a year?",
        a: "Yes. Essential includes two tests (a full baseline and a lighter recheck). Add the quarterly upgrade — €130/yr for two extra rechecks — or buy single add-ons anytime: €99 full panel, €69 recheck, €199 venous draw with nurse visit.",
      },
      {
        q: "Can I cancel my membership?",
        a: "Anytime, from your profile. You keep full access until the end of your paid year, and there are no cancellation fees. You can also export or delete all your data whenever you leave.",
      },
      {
        q: "Is everything included in the price?",
        a: "Yes — the kit or nurse visit, postage both ways, lab processing, clinician sign-off and app access are all included. No surprise phlebotomy or handling fees.",
      },
    ],
  },
  {
    title: "Privacy & data",
    items: [
      {
        q: "Where is my data stored, and is it ever sold?",
        a: "Your data is encrypted and stored in the EU (eu-west-1). It is used only to build your trends and coaching. We never sell it or share it for advertising. See our privacy policy for the full detail.",
      },
      {
        q: "How do I export or delete everything?",
        a: "In the app: Profile → Export my data for a full copy, or Delete all my data to permanently erase everything with no copies kept. You can also email privacy@arcaevo.health. See our data deletion & export page.",
      },
    ],
  },
];
