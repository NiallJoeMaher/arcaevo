/**
 * Versus / compare content, extracted verbatim from
 * design_handoff/designs/Versus.dc.html and Compare.dc.html.
 *
 * All copy is verbatim from the design prototypes — do not edit wording,
 * prices or dates here without a matching design change.
 */

/** One row of the "At a glance" table on a versus page. */
export interface VersusRow {
  /** Dimension label (left column). */
  dim: string;
  /** Arcaevo's value. */
  us: string;
  /** Competitor's value. */
  them: string;
}

/** One "People also ask" entry on a versus page. */
export interface VersusFaq {
  q: string;
  a: string;
}

/** Full content for a single "Arcaevo vs X" page. */
export interface VersusPage {
  /** URL slug, e.g. "letsgetchecked". */
  slug: string;
  /** Competitor display name, e.g. "LetsGetChecked". */
  name: string;
  /** Market label, e.g. "Ireland / Global". */
  market: string;
  /** "THE SHORT ANSWER" direct-answer block (AEO). */
  answer: string;
  /** "At a glance" comparison table rows, in design order. */
  rows: VersusRow[];
  /** "WHERE ARCAEVO WINS" bullet list. */
  usWins: string[];
  /** "WHERE {COMPETITOR} WINS" bullet list. */
  themWins: string[];
  /** "The honest take" narrative paragraphs. */
  paras: string[];
  /** "People also ask" FAQ entries. */
  faqs: VersusFaq[];
}

/** Card on the /compare index grid (Compare.dc.html). */
export interface CompareIndexEntry {
  slug: string;
  name: string;
  tagline: string;
  /** Uppercase market chip, e.g. "IRELAND / GLOBAL". */
  market: string;
  /** Uppercase edge chip, e.g. "INTERPRETATION". */
  edge: string;
}

export const versusPages: Record<string, VersusPage> = {
  letsgetchecked: {
    slug: "letsgetchecked",
    name: "LetsGetChecked",
    market: "Ireland / Global",
    answer:
      "Choose LetsGetChecked if you want a quick, well-known at-home kit and are happy interpreting the results yourself. Choose Arcaevo if you want those same bloods fused with your wearable data, read against your own baseline, and turned into a short, prioritised plan — with proof, at your next test, of whether it worked.",
    rows: [
      { dim: "Sample type", us: "Finger-prick or in-home venous", them: "Finger-prick, some venous" },
      { dim: "Interpretation", us: "Ranked plan + AI coach", them: "Results PDF + reference ranges" },
      { dim: "Wearable fusion", us: "Yes — Apple Watch & Health", them: "No" },
      { dim: "Change detection", us: "Your baseline + RCV", them: "Population range only" },
      { dim: "‘Did it work?’ loop", us: "Yes", them: "No" },
      { dim: "Clinician review", us: "Every panel", them: "Nurse/doctor on request" },
      { dim: "Data residency", us: "EU, never sold", them: "Varies by region" },
      { dim: "Best for", us: "Understanding + acting", them: "Fast, familiar testing" },
    ],
    usWins: [
      "Fuses bloods with your Apple Watch, on one timeline",
      "Tells you the one or two things to change, not forty numbers",
      "Proves whether a change was real or just test noise (RCV)",
    ],
    themWins: [
      "Very established brand with broad global availability",
      "Wide catalogue of single-condition and sexual-health kits",
      "Simple one-off purchases without any app commitment",
    ],
    paras: [
      "LetsGetChecked pioneered convenient home testing and does it reliably. If you already know what your ferritin should be and just want the number, it's a solid, familiar choice.",
      "Arcaevo is built for the step after the number. We take the same drop of blood, plot it over your sleep, HRV and activity, flag what actually moved against your own history, and hand you a plan you can act on this week — then check it at the next test.",
    ],
    faqs: [
      {
        q: "Is Arcaevo available in Ireland like LetsGetChecked?",
        a: "Yes. Arcaevo is Dublin-based and fulfils tests Ireland-wide, including in-home venous draws by a visiting nurse.",
      },
      {
        q: "Does LetsGetChecked connect to my Apple Watch?",
        a: "No — LetsGetChecked reports bloods only. Arcaevo fuses your bloods with Apple Watch and Apple Health so trends explain each other. WHOOP, Oura and Garmin support is on the roadmap.",
      },
      {
        q: "Can I switch from LetsGetChecked to Arcaevo?",
        a: "Yes. You can upload prior results as context, and start a fresh Arcaevo baseline with your first test.",
      },
    ],
  },
  "randox-health": {
    slug: "randox-health",
    name: "Randox Health",
    market: "Ireland / UK",
    answer:
      "Randox Health offers very large clinic-based panels backed by its own laboratories. Arcaevo brings testing into your home, reads results against your personal baseline, and fuses them with wearables — so choose Randox for a one-off deep clinic panel, and Arcaevo for an ongoing, interpreted, at-home programme.",
    rows: [
      { dim: "Where you test", us: "At home (kit or nurse visit)", them: "Randox clinics" },
      { dim: "Markers", us: "35–80", them: "Up to 350 (clinic)" },
      { dim: "Interpretation", us: "Ranked plan + coach", them: "Report + consultation" },
      { dim: "Wearable fusion", us: "Yes", them: "No" },
      { dim: "Change detection", us: "Your baseline + RCV", them: "Population range" },
      { dim: "‘Did it work?’ loop", us: "Yes", them: "Repeat panel" },
      { dim: "Data residency", us: "EU, never sold", them: "UK/EU labs" },
      { dim: "Best for", us: "Ongoing optimisation", them: "One-off deep clinic panel" },
    ],
    usWins: [
      "No clinic visit — test from home, results read off your own baseline",
      "Fuses wearable signals so a marker's story is explained, not just listed",
      "Ongoing loop that proves interventions worked, rather than a static report",
    ],
    themWins: [
      "Enormous marker breadth in a single clinic draw",
      "Owns its laboratories with deep diagnostic heritage",
      "In-person consultation to walk through results",
    ],
    paras: [
      "Randox Health is a diagnostics heavyweight — if you want the single widest possible clinic panel in one sitting, it's hard to beat on sheer marker count.",
      "Arcaevo trades raw breadth for interpretation and continuity. We focus on the markers with the strongest outcome evidence, bring the test to your kitchen table, and keep working between tests by fusing your wearable data and proving what changed.",
    ],
    faqs: [
      {
        q: "Does Arcaevo have as many markers as Randox?",
        a: "No — Randox's clinic panels can run into the hundreds. Arcaevo deliberately prioritises the 35–80 markers with the strongest evidence and focuses on interpreting them well over listing everything.",
      },
      {
        q: "Can I test at home with Randox?",
        a: "Randox is primarily clinic-based. Arcaevo is built for home testing, with finger-prick kits and in-home venous draws.",
      },
      {
        q: "Is Arcaevo cheaper than a Randox panel?",
        a: "Arcaevo Essential is €329/yr including two blood tests, app, coaching and clinician review — and membership starts at €119/yr. Large Randox clinic panels run around €480 per visit.",
      },
    ],
  },
  thriva: {
    slug: "thriva",
    name: "Thriva",
    market: "United Kingdom",
    answer:
      "Thriva is a well-designed UK finger-prick tracking service. Arcaevo does the same regular tracking but adds wearable fusion, your-baseline change detection and a proof loop — so if you want tidy blood trends, Thriva is great; if you want those trends explained by your sleep and activity and turned into a verified plan, choose Arcaevo.",
    rows: [
      { dim: "Sample type", us: "Finger-prick or venous", them: "Finger-prick" },
      { dim: "Interpretation", us: "Ranked plan + coach", them: "Marker cards + advice" },
      { dim: "Wearable fusion", us: "Yes", them: "Limited" },
      { dim: "Change detection", us: "Your baseline + RCV", them: "Trend over time" },
      { dim: "‘Did it work?’ loop", us: "Yes (RCV verdicts)", them: "Visual trend only" },
      { dim: "Clinician review", us: "Every panel", them: "Doctor-written notes" },
      { dim: "Data residency", us: "EU (Ireland)", them: "UK" },
      { dim: "Best for", us: "Explained, verified action", them: "Clean blood tracking" },
    ],
    usWins: [
      "Overlays wearable data so trends have a cause, not just a shape",
      "RCV verdicts separate a real improvement from measurement noise",
      "Ranked two-lever plan rather than per-marker advice to weigh yourself",
    ],
    themWins: [
      "Beautiful, mature product with a loyal UK following",
      "Strong finger-prick logistics and marker education",
      "Doctor-written commentary on each result",
    ],
    paras: [
      "Thriva helped define modern finger-prick tracking and still does it elegantly. For someone in the UK who wants clean blood trends and readable marker cards, it's an excellent pick.",
      "Arcaevo's difference is fusion and honesty about change. We don't just draw the line going down — we tell you whether it truly moved beyond noise, and we explain it with the wearable signals sitting underneath.",
    ],
    faqs: [
      {
        q: "Is Arcaevo available in the UK like Thriva?",
        a: "Arcaevo is Ireland-first today, with EU expansion planned. Thriva is UK-focused. Check the app for current availability in your region.",
      },
      {
        q: "Does Thriva use my wearable data?",
        a: "Only in a limited way. Arcaevo makes wearable fusion central — your bloods and your HRV, sleep and activity live on one timeline.",
      },
      {
        q: "Which is better for tracking over years?",
        a: "Both track well; Arcaevo adds Reference Change Value so long-term trends distinguish real shifts from test-to-test variation.",
      },
    ],
  },
  "function-health": {
    slug: "function-health",
    name: "Function Health",
    market: "United States",
    answer:
      "Function Health offers 100+ markers a year at a strong price in the US. Arcaevo prioritises fewer, higher-evidence markers, fuses them with wearables, and proves your changes worked — so pick Function for maximum US marker breadth, and Arcaevo for interpreted, wearable-fused, EU-hosted testing.",
    rows: [
      { dim: "Markers", us: "35–80 (prioritised)", them: "100+ per year" },
      { dim: "Interpretation", us: "Ranked plan + coach", them: "Clinician notes + flags" },
      { dim: "Wearable fusion", us: "Yes", them: "No" },
      { dim: "Change detection", us: "Your baseline + RCV", them: "Range + flags" },
      { dim: "‘Did it work?’ loop", us: "Yes", them: "Retest markers" },
      { dim: "Region", us: "Ireland / EU", them: "USA" },
      { dim: "Data residency", us: "EU, never sold", them: "USA" },
      { dim: "Best for", us: "Interpreted EU testing", them: "Max US marker breadth" },
    ],
    usWins: [
      "Fusion with wearables that Function doesn't offer",
      "EU data residency and GDPR-first posture for European users",
      "A prioritised plan instead of a very long list of flagged markers",
    ],
    themWins: [
      "Exceptional marker breadth (100+) for the price",
      "Strong US clinician network and follow-up",
      "Great fit if you're US-based and want everything measured",
    ],
    paras: [
      "Function Health has made comprehensive testing genuinely affordable in the US, and the sheer number of markers is impressive. If you're American and want breadth, it's a leading option.",
      "Arcaevo is the European, interpretation-first alternative. We test fewer things on purpose, fuse them with the wearable you already wear, keep your data in the EU, and prove what actually changed — rather than handing you a hundred numbers to parse.",
    ],
    faqs: [
      {
        q: "Is Function Health available in Ireland or the EU?",
        a: "Function Health is US-focused. Arcaevo is built for Ireland and the EU, with EU data residency and local fulfilment.",
      },
      {
        q: "Why does Arcaevo test fewer markers?",
        a: "We prioritise markers with the strongest outcome evidence and interpret them deeply, rather than maximising count. Fusion and change detection add more signal than extra markers alone.",
      },
      {
        q: "Does Function fuse wearable data?",
        a: "No. Wearable fusion is a core Arcaevo differentiator.",
      },
    ],
  },
  medichecks: {
    slug: "medichecks",
    name: "Medichecks",
    market: "United Kingdom",
    answer:
      "Medichecks offers affordable, flexible UK blood tests with a huge menu. Arcaevo turns the same bloods into a ranked, personal roadmap with wearable fusion and proof of change — so choose Medichecks for cheap, pick-and-mix testing, and Arcaevo when you want the results to actually tell you what to do.",
    rows: [
      { dim: "Sample type", us: "Finger-prick or venous", them: "Finger-prick or venous" },
      { dim: "Menu", us: "Curated panels", them: "Very large a-la-carte menu" },
      { dim: "Interpretation", us: "Ranked plan + coach", them: "Doctor comments" },
      { dim: "Wearable fusion", us: "Yes", them: "No" },
      { dim: "Change detection", us: "Your baseline + RCV", them: "Trends" },
      { dim: "‘Did it work?’ loop", us: "Yes", them: "No" },
      { dim: "Data residency", us: "EU (Ireland)", them: "UK" },
      { dim: "Best for", us: "A plan you act on", them: "Cheap, flexible testing" },
    ],
    usWins: [
      "Fuses wearables and flags change against your own baseline",
      "Gives a prioritised plan, not just doctor comments per marker",
      "Closes the loop with RCV-based ‘did it work?’ verdicts",
    ],
    themWins: [
      "Very competitive per-test pricing",
      "Enormous menu to build your own panel",
      "Established UK lab logistics and fast turnaround",
    ],
    paras: [
      "Medichecks is the value champion of UK testing — if you know exactly what you want and want it cheaply, its a-la-carte menu is unmatched.",
      "Arcaevo is for people who don't want to be their own clinician. We curate the panel, interpret against your baseline, fuse the wearable data, and give you a short plan with proof — the work that happens after Medichecks hands you the numbers.",
    ],
    faqs: [
      {
        q: "Is Arcaevo more expensive than Medichecks?",
        a: "Per single test, Medichecks can be cheaper. Arcaevo's price includes interpretation, coaching, fusion and clinician review as a programme, not just a result.",
      },
      {
        q: "Can I build my own panel like Medichecks?",
        a: "Arcaevo offers curated panels chosen for evidence rather than a fully a-la-carte menu, to keep interpretation coherent.",
      },
      {
        q: "Does Medichecks use wearable data?",
        a: "No. Wearable fusion is unique to Arcaevo among these options.",
      },
    ],
  },
  zoe: {
    slug: "zoe",
    name: "Zoe",
    market: "UK / USA",
    answer:
      "Zoe is a food-first programme centred on gut health and blood-sugar responses. Arcaevo is bloods-first across five body systems with clinician review — so choose Zoe if your priority is personalised nutrition and glucose, and Arcaevo if you want a whole-body biomarker programme that fuses wearables and proves change.",
    rows: [
      { dim: "Focus", us: "5 systems, bloods-first", them: "Gut, glucose, nutrition" },
      { dim: "Core method", us: "Bloods + wearable fusion", them: "CGM + gut test + food logs" },
      { dim: "Interpretation", us: "Ranked plan + coach", them: "Food scores & guidance" },
      { dim: "Clinician review", us: "Every panel", them: "Nutrition science team" },
      { dim: "Change detection", us: "Your baseline + RCV", them: "Personal food responses" },
      { dim: "Data residency", us: "EU, never sold", them: "UK / USA" },
      { dim: "Best for", us: "Whole-body optimisation", them: "Diet personalisation" },
    ],
    usWins: [
      "Covers cardiovascular, metabolic, nutrient, inflammation & hormonal systems",
      "Clinician-reviewed bloods, not primarily food-response scores",
      "Wearable fusion and RCV proof of what worked",
    ],
    themWins: [
      "Best-in-class personalised nutrition and gut insights",
      "Continuous glucose monitoring built into the programme",
      "Large research base behind food-response science",
    ],
    paras: [
      "Zoe is excellent at one important thing: understanding how your body responds to food, using CGM and gut testing. If diet personalisation is your goal, it's a standout.",
      "Arcaevo is broader and bloods-first. We look across five systems, fuse wearable signals, keep a registered clinician in the loop, and prove changes with RCV — a different job than optimising your plate, and often a complementary one.",
    ],
    faqs: [
      {
        q: "Can I use Zoe and Arcaevo together?",
        a: "Yes — they're complementary. Zoe optimises your nutrition; Arcaevo tracks the whole-body biomarker picture and whether changes (including dietary ones) actually moved your markers.",
      },
      {
        q: "Does Arcaevo include a CGM?",
        a: "Not as standard. Arcaevo focuses on blood biomarkers fused with wearable data; CGM integration is on the roadmap.",
      },
      {
        q: "Which is more clinical?",
        a: "Arcaevo has clinician review of every panel and RCV-based change detection; Zoe is led by nutrition science.",
      },
    ],
  },
  everlab: {
    slug: "everlab",
    name: "Everlab",
    market: "Australia",
    answer:
      "Everlab offers comprehensive longevity diagnostics with a strong clinical model in Australia. Arcaevo matches the preventive ambition but is EU-hosted, home-based and fuses wearables — so choose Everlab for an Australian clinic-grade longevity work-up, and Arcaevo for an at-home, wearable-fused, EU programme.",
    rows: [
      { dim: "Model", us: "At-home + app", them: "Clinic + concierge" },
      { dim: "Markers", us: "35–80", them: "Very comprehensive" },
      { dim: "Interpretation", us: "Ranked plan + coach", them: "Doctor-led plan" },
      { dim: "Wearable fusion", us: "Yes", them: "Partial" },
      { dim: "Change detection", us: "Your baseline + RCV", them: "Doctor follow-up" },
      { dim: "Region", us: "Ireland / EU", them: "Australia" },
      { dim: "Data residency", us: "EU, never sold", them: "Australia" },
      { dim: "Best for", us: "At-home EU programme", them: "Clinic longevity work-up" },
    ],
    usWins: [
      "Fully at-home — no clinic membership required",
      "EU data residency for European users",
      "Wearable fusion and automated RCV change detection",
    ],
    themWins: [
      "Very comprehensive, clinic-grade diagnostic breadth",
      "Doctor-led, concierge follow-up model",
      "Strong fit for Australian users wanting in-person care",
    ],
    paras: [
      "Everlab has built an impressive clinical longevity model — for someone in Australia who wants a thorough, doctor-led preventive work-up, it's a strong choice.",
      "Arcaevo delivers a similar preventive philosophy without the clinic. We bring testing home, keep data in the EU, fuse the wearable you already own, and automate the honesty about whether changes worked.",
    ],
    faqs: [
      {
        q: "Is Everlab available in Europe?",
        a: "Everlab is Australia-focused. Arcaevo is built for Ireland and the EU with local fulfilment and EU data residency.",
      },
      {
        q: "Does Arcaevo require a clinic visit?",
        a: "No. Arcaevo is at-home — finger-prick kits or an in-home nurse draw — with clinician review happening behind the scenes.",
      },
      {
        q: "Which has more markers?",
        a: "Everlab's clinic panels are typically broader; Arcaevo prioritises high-evidence markers and adds fusion and change detection.",
      },
    ],
  },
  superpower: {
    slug: "superpower",
    name: "Superpower",
    market: "United States",
    answer:
      "Superpower offers 100+ markers at a sharp annual price in the US. Arcaevo adds the layer Superpower doesn't — wearable fusion, your-baseline change detection and a proof loop — so choose Superpower for cheap US breadth, and Arcaevo for interpreted, wearable-fused, EU-hosted testing.",
    rows: [
      { dim: "Markers", us: "35–80 (prioritised)", them: "100+ per year" },
      { dim: "Interpretation", us: "Ranked plan + coach", them: "Concierge + flags" },
      { dim: "Wearable fusion", us: "Yes", them: "No" },
      { dim: "Change detection", us: "Your baseline + RCV", them: "Range + flags" },
      { dim: "‘Did it work?’ loop", us: "Yes", them: "Retest" },
      { dim: "Region", us: "Ireland / EU", them: "USA" },
      { dim: "Data residency", us: "EU, never sold", them: "USA" },
      { dim: "Best for", us: "Interpreted EU testing", them: "Cheap US breadth" },
    ],
    usWins: [
      "Wearable fusion that Superpower doesn't offer",
      "EU data residency and GDPR-first handling",
      "A ranked plan and RCV proof, not just a big marker dump",
    ],
    themWins: [
      "Aggressive price for 100+ markers a year",
      "Slick US onboarding and concierge feel",
      "Great for US users chasing maximum breadth cheaply",
    ],
    paras: [
      "Superpower has made broad annual testing remarkably cheap in the US, and the onboarding is slick. For an American who wants the widest panel for the lowest price, it's compelling.",
      "Arcaevo competes on meaning, not marker count. We fuse your wearables, read change against your own baseline, keep your data in the EU, and prove what worked — the interpretation layer that a raw 100-marker list still leaves to you.",
    ],
    faqs: [
      {
        q: "Is Superpower available in the EU?",
        a: "Superpower is US-focused. Arcaevo is built for Ireland and the EU, with EU data residency.",
      },
      {
        q: "Does Arcaevo test as many markers as Superpower?",
        a: "No — Arcaevo prioritises 35–80 high-evidence markers and adds fusion and change detection rather than maximising count.",
      },
      {
        q: "Does Superpower connect to wearables?",
        a: "No. Wearable fusion is a core Arcaevo differentiator.",
      },
    ],
  },
};

/**
 * /compare index cards (Compare.dc.html), in design order.
 * This order also drives the "MORE COMPARISONS" chips on versus pages
 * (the prototype lists every competitor except the current one).
 */
export const compareIndex: CompareIndexEntry[] = [
  {
    slug: "letsgetchecked",
    name: "LetsGetChecked",
    tagline:
      "Convenient at-home kits — but a results PDF, not a plan. We add interpretation, fusion and the loop.",
    market: "IRELAND / GLOBAL",
    edge: "INTERPRETATION",
  },
  {
    slug: "randox-health",
    name: "Randox Health",
    tagline:
      "Huge clinic panels and a lab pedigree. We bring it home, read it off your baseline, and fuse wearables.",
    market: "IRELAND / UK",
    edge: "AT-HOME + FUSION",
  },
  {
    slug: "thriva",
    name: "Thriva",
    tagline:
      "Finger-prick tracking done well. We go further with wearable fusion and honest change detection.",
    market: "UK",
    edge: "WEARABLE FUSION",
  },
  {
    slug: "function-health",
    name: "Function Health",
    tagline:
      "100+ markers, US-first. We prioritise the markers that matter and prove your changes worked.",
    market: "USA",
    edge: "PRIORITISED + EU",
  },
  {
    slug: "medichecks",
    name: "Medichecks",
    tagline:
      "Affordable, flexible UK testing. We turn the same bloods into a ranked, personal roadmap.",
    market: "UK",
    edge: "ROADMAP",
  },
  {
    slug: "zoe",
    name: "Zoe",
    tagline:
      "Gut and glucose, food-first. We're bloods-first across five systems, with clinician review.",
    market: "UK / USA",
    edge: "WHOLE-BODY",
  },
  {
    slug: "everlab",
    name: "Everlab",
    tagline:
      "Comprehensive longevity diagnostics. We match the ambition with EU data residency and fusion.",
    market: "AUSTRALIA",
    edge: "EU-HOSTED",
  },
  {
    slug: "superpower",
    name: "Superpower",
    tagline:
      "100+ markers at a sharp price, US-first. We add wearable fusion, baseline flagging and the loop.",
    market: "USA",
    edge: "FUSION + LOOP",
  },
];

/** One card in the Arcaevo summary row on the /compare index. */
export interface CompareSummaryCard {
  /** Kicker label, e.g. "WHAT'S DIFFERENT". */
  kicker: string;
  /** Headline. May contain typographic quotes. */
  title: string;
  /** Supporting line. */
  sub: string;
}

/**
 * Static hero + summary-row copy on the /compare index (Compare.dc.html).
 * Held outside the versus data because the prototype renders it inline.
 */
export const compareIndexMeta = {
  kicker: "COMPARE",
  title: "Arcaevo vs the rest of at-home health testing.",
  intro:
    "Honest, side-by-side comparisons. Most services are brilliant at collecting biomarkers and stop there. Here's how Arcaevo's interpretation layer — fusion, your-baseline flagging, and the “did it work?” loop — stacks up against each one.",
  summary: [
    {
      kicker: "WHAT'S DIFFERENT",
      title: "Fusion of bloods + wearables",
      sub: "On one timeline, off your baseline.",
    },
    {
      kicker: "THE PROOF",
      title: "“Did it work?” verdicts",
      sub: "Change judged against test noise.",
    },
    {
      kicker: "THE POSTURE",
      title: "EU-hosted, never sold",
      sub: "Clinician-reviewed, GDPR-first.",
    },
  ] as CompareSummaryCard[],
};

/** All versus slugs in design (index) order. */
export const versusSlugs: string[] = compareIndex.map((c) => c.slug);

export function getVersusPage(slug: string): VersusPage | undefined {
  return versusPages[slug];
}
