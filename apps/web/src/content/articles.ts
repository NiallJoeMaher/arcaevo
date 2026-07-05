/**
 * Blog article content, extracted verbatim from
 * design_handoff/designs/Article.dc.html and Blog.dc.html.
 *
 * All copy is verbatim from the design prototypes — do not edit wording,
 * numbers or dates here without a matching design change.
 */

/** An <h2> heading within an article body. */
export interface ArticleHeadingBlock {
  type: "heading";
  text: string;
}

/** A body paragraph. */
export interface ArticleParagraphBlock {
  type: "paragraph";
  text: string;
}

/** A dark callout / pull-quote block. */
export interface ArticleCalloutBlock {
  type: "callout";
  text: string;
}

/** An unordered list of items. */
export interface ArticleListBlock {
  type: "list";
  items: string[];
}

/**
 * Discriminated union of article body blocks.
 * In the prototype these come from the H2/P/C/L helper factories.
 */
export type ArticleBlock =
  | ArticleHeadingBlock
  | ArticleParagraphBlock
  | ArticleCalloutBlock
  | ArticleListBlock;

/** Full content for a single blog article. */
export interface Article {
  slug: string;
  /** Category kicker, e.g. "BIOMARKERS". */
  cat: string;
  /** Reading time, e.g. "8 MIN READ". */
  read: string;
  author: string;
  /** Review/publish date line, e.g. "Reviewed June 2026". */
  date: string;
  title: string;
  /** "THE SHORT ANSWER" direct-answer block (AEO). */
  answer: string;
  /** Ordered body blocks. */
  blocks: ArticleBlock[];
  /** "KEY TAKEAWAYS" bullet list. */
  takeaways: string[];
  /** CTA sub-heading copy. */
  ctaSub: string;
  /** Slugs of related articles, in design order (from relatedMap). */
  related: string[];
}

/** Featured card on the blog index (Blog.dc.html). */
export interface BlogIndexFeatured {
  slug: string;
  cat: string;
  title: string;
  excerpt: string;
}

/** A grid card on the blog index (Blog.dc.html). */
export interface BlogIndexCard {
  slug: string;
  cat: string;
  /** Serif glyph shown on the card thumbnail, e.g. "◷". */
  glyph: string;
  /** CSS background for the thumbnail (a gradient). */
  bg: string;
  title: string;
  excerpt: string;
  read: string;
}

// Article body block factories mirroring the prototype's H2/P/C/L helpers.
const H2 = (text: string): ArticleHeadingBlock => ({ type: "heading", text });
const P = (text: string): ArticleParagraphBlock => ({ type: "paragraph", text });
const C = (text: string): ArticleCalloutBlock => ({ type: "callout", text });
const L = (items: string[]): ArticleListBlock => ({ type: "list", items });

export const articles: Record<string, Article> = {
  "apob-vs-cholesterol": {
    slug: "apob-vs-cholesterol",
    cat: "BIOMARKERS",
    read: "8 MIN READ",
    author: "Arcaevo Clinical Team",
    date: "Reviewed June 2026",
    title: "What is ApoB, and why does it matter more than cholesterol?",
    answer:
      "ApoB (apolipoprotein B) counts the total number of artery-clogging particles in your blood. Because every one of those particles carries exactly one ApoB molecule, it's a more direct measure of heart-disease risk than standard LDL cholesterol — which only estimates how much cholesterol those particles carry. For most people optimising heart health, ApoB is the single most useful number to track.",
    blocks: [
      H2("Cholesterol tells you the cargo. ApoB counts the trucks."),
      P(
        "A standard lipid panel measures how much cholesterol is floating in your blood. But cholesterol doesn't damage your arteries on its own — it has to be carried there inside particles. The particles are what burrow into the artery wall and start the process that leads to heart disease.",
      ),
      P(
        "ApoB counts those particles directly. Every atherogenic particle — LDL, VLDL, Lp(a) and others — carries exactly one ApoB molecule. So your ApoB level is, quite literally, a headcount of the vehicles that can cause harm.",
      ),
      C(
        "Two people can have identical LDL cholesterol but very different ApoB. The one with more, smaller particles has more ‘trucks’ for the same cargo — and a higher risk that the standard panel completely misses.",
      ),
      H2("Why LDL-C can mislead you"),
      P(
        "LDL-C is usually calculated, not measured, and it assumes an average amount of cholesterol per particle. In people with insulin resistance, high triglycerides or metabolic syndrome, particles tend to be smaller and more numerous — so LDL-C looks reassuring while ApoB reveals the real, elevated risk. This is called discordance, and it's common enough to matter.",
      ),
      H2("What does a good ApoB look like?"),
      P(
        "General optimisation targets vary by risk profile and should be interpreted with your clinician, but as a rough guide many longevity-focused clinicians aim well below population averages. What matters more than a single reading is the trend — and whether a change you made moved it beyond test noise.",
      ),
      L([
        "For primary prevention, lower is generally better within reason.",
        "Your own trend matters more than one snapshot — track it over time.",
        "Pair ApoB with Lp(a) once, since Lp(a) is largely genetic and adds risk context.",
      ]),
      H2("How Arcaevo handles ApoB"),
      P(
        "We lead with ApoB rather than burying it in a lipid sub-panel, plot it against your own baseline, and flag a change only when it crosses your Reference Change Value — so you know a drop from 0.92 to 0.74 g/L is real, not measurement wobble. Then we fuse it with your activity and body-composition trends to suggest the lever most likely to move it for you.",
      ),
    ],
    takeaways: [
      "ApoB counts the particles that actually cause arterial damage — a more direct risk marker than LDL-C.",
      "LDL-C can look normal while ApoB is high, especially with metabolic issues (discordance).",
      "Track the trend against your own baseline, and confirm changes exceed test noise before believing them.",
    ],
    ctaSub: "Arcaevo leads with ApoB and proves whether your changes moved it.",
    related: ["how-often-blood-test-ireland", "reference-change-value"],
  },
  "how-often-blood-test-ireland": {
    slug: "how-often-blood-test-ireland",
    cat: "TESTING",
    read: "6 MIN READ",
    author: "Arcaevo Clinical Team",
    date: "Reviewed May 2026",
    title: "How often should you get a blood test in Ireland?",
    answer:
      "For most healthy adults, a comprehensive blood test once a year is enough to spot meaningful trends. Test more often — every 3 to 6 months — when you're actively changing something (a new training block, medication, or supplement) and want to know whether it worked. There's little value in testing so frequently that you're just measuring day-to-day noise.",
    blocks: [
      H2("The honest answer: it depends on what you're doing"),
      P(
        "Blood markers move slowly. Many — like HbA1c, which reflects roughly three months of blood sugar — physically can't change meaningfully in a few weeks. Testing them monthly tells you almost nothing new. So the right frequency isn't a fixed number; it's tied to what you're trying to learn.",
      ),
      H2("A simple framework"),
      L([
        "Baseline: test once to establish your personal starting point across the key systems.",
        "Maintenance: if nothing is changing and you feel well, once a year is plenty for most healthy adults.",
        "Intervention: when you start a new habit, supplement or medication, retest after enough time for the marker to respond — often 8–12 weeks — to see if it worked.",
      ]),
      C(
        "Testing is only useful if a result could change what you do next. If you'd act the same way regardless of the number, you probably don't need that test right now.",
      ),
      H2("Why your baseline changes the answer"),
      P(
        "Population reference ranges are wide. A marker can sit ‘normal’ for years while drifting steadily within that range — a trend you'd only catch by comparing against your own history. This is exactly why an annual test is valuable even when you feel fine: it builds the baseline that makes future changes readable.",
      ),
      H2("Avoiding the noise trap"),
      P(
        "Every test has variation — from the lab and from your own biology day to day. Test too often and you'll see numbers bounce around without any real change, which leads to needless worry or false confidence. Arcaevo uses Reference Change Value to tell you when a difference is genuinely bigger than that noise, so more frequent testing only helps when it can actually reveal something.",
      ),
    ],
    takeaways: [
      "Once a year suits most healthy adults; every 3–6 months when you're actively changing something.",
      "Match test timing to how fast the marker can physically respond.",
      "Only retest when the result could change your next decision — otherwise you're measuring noise.",
    ],
    ctaSub: "Arcaevo's membership builds your baseline and times retests around your changes.",
    related: ["reference-change-value", "wearables-and-bloods-fusion"],
  },
  "reference-change-value": {
    slug: "reference-change-value",
    cat: "SCIENCE",
    read: "7 MIN READ",
    author: "Arcaevo Clinical Team",
    date: "Reviewed June 2026",
    title: "Did your health markers actually improve, or was it just noise?",
    answer:
      "A blood marker that ticks from 56 to 58 hasn't necessarily changed at all. Every result carries analytical variation (the lab) and biological variation (you, day to day). Reference Change Value (RCV) is the threshold a marker must cross before a difference is statistically real. If the change is smaller than your RCV, treat it as noise — not progress, and not a problem.",
    blocks: [
      H2("Why two different numbers can mean no change"),
      P(
        "Measure the same thing twice and you rarely get an identical result. Assays have a known analytical variation, and your own body fluctuates with hydration, time of day, recent meals and stress. Add those together and small differences between two tests are often just the machinery of measurement — not a real shift in your health.",
      ),
      H2("The formula, in plain English"),
      C("RCV = √2 · Z · √(CVa² + CVi²)"),
      P(
        "CVa is the assay's analytical variation. CVi is your within-person biological variation for that marker. Z is your confidence level (1.96 for 95%). The result is the percentage a marker must move before you can be 95% confident the change is real. Different markers have very different RCVs — some are stable, others naturally swing a lot.",
      ),
      H2("What this looks like in practice"),
      L([
        "ApoB 0.92 → 0.74 g/L: a large drop that clears RCV — a real improvement.",
        "Vitamin D 56 → 58 nmol/L: within noise — hold the course, don't over-read it.",
        "A marker drifting up test after test, each step small but consistent: worth a retest to confirm the trend.",
      ]),
      H2("Why we built the whole app around this"),
      P(
        "It's tempting to celebrate any number that moved the right way, or panic at any that moved the wrong way. Both are often reactions to noise. By judging every change against your personal RCV, Arcaevo gives you an honest verdict — real improvement, within noise, or needs a retest — so your decisions are based on signal, not randomness.",
      ),
    ],
    takeaways: [
      "Small differences between tests are frequently just measurement and biological noise.",
      "RCV is the threshold a marker must cross to count as a real change.",
      "Arcaevo labels every change so you never mistake noise for progress — or for a problem.",
    ],
    ctaSub: "Every Arcaevo result comes with an honest ‘did it work?’ verdict.",
    related: ["apob-vs-cholesterol", "wearables-and-bloods-fusion"],
  },
  "wearables-and-bloods-fusion": {
    slug: "wearables-and-bloods-fusion",
    cat: "WEARABLES",
    read: "6 MIN READ",
    author: "Arcaevo Clinical Team",
    date: "Reviewed May 2026",
    title: "Can your Apple Watch and blood tests work together?",
    answer:
      "Yes — and together they're far more useful than either alone. A blood test is a snapshot from one morning; your wearable is a continuous film of your sleep, heart-rate variability and activity. Overlay them on one timeline and each explains the other: a spike in inflammation lines up with the week your recovery collapsed, and a rising blood sugar sits next to a falling step count.",
    blocks: [
      H2("A snapshot versus a film"),
      P(
        "Blood tests are precise but sparse — a handful of moments a year. Wearables are continuous but indirect — they infer a lot from heart rate, movement and skin sensors. Neither is complete on its own. The magic is in the overlap: the blood marker gives you ground truth, and the wearable gives you the context around it.",
      ),
      H2("Three fusions that actually change decisions"),
      L([
        "hs-CRP (inflammation) against HRV (recovery): distinguishes a hard training block from a genuine inflammatory problem.",
        "HbA1c (blood sugar) against daily steps and sleep: shows whether metabolic drift tracks a lifestyle change.",
        "Ferritin (iron) against training load: flags when heavy endurance volume is quietly depleting your iron.",
      ]),
      C(
        "On their own, a slightly raised hs-CRP is ambiguous. Placed over the exact week your HRV cratered from a chest infection, it tells a clear, reassuring story — and saves an unnecessary worry.",
      ),
      H2("Why most services don't do this"),
      P(
        "Testing companies are built around the lab, not the wrist. Wearable apps are built around the wrist, not the lab. Very few bring both into one view, which is why a rising resting heart rate and a falling vitamin D usually live in two apps that never talk to each other.",
      ),
      H2("How Arcaevo fuses them"),
      P(
        "We plot your blood draws directly over the wearable signal that best explains them, read both against your own baseline, and let the coach narrate the connection in plain English. It's the same data you already generate — finally telling a single story instead of two half-stories.",
      ),
    ],
    takeaways: [
      "Blood tests and wearables are complementary: ground truth plus continuous context.",
      "Fusing them turns ambiguous single markers into clear, decision-ready stories.",
      "Arcaevo puts bloods and wearable trends on one timeline, read off your baseline.",
    ],
    ctaSub: "Connect your Apple Watch and see your bloods in context.",
    related: ["apob-vs-cholesterol", "how-often-blood-test-ireland"],
  },
};

/** Featured article on the blog index (Blog.dc.html). */
export const blogFeatured: BlogIndexFeatured = {
  slug: "apob-vs-cholesterol",
  cat: "BIOMARKERS",
  title: "What is ApoB, and why does it matter more than cholesterol?",
  excerpt:
    "The single best marker for heart-disease risk isn't the one on your standard cholesterol panel. Here's what ApoB measures, why it beats LDL-C, and what a good number looks like.",
};

/** Blog index grid cards (Blog.dc.html), in design order. */
export const blogIndexCards: BlogIndexCard[] = [
  {
    slug: "how-often-blood-test-ireland",
    cat: "TESTING",
    glyph: "◷",
    bg: "linear-gradient(135deg,#1E5C45,#2E7D5B)",
    title: "How often should you get a blood test in Ireland?",
    excerpt:
      "Annual is fine for most healthy adults — but the honest answer depends on your baseline and what you're changing.",
    read: "6 MIN READ",
  },
  {
    slug: "reference-change-value",
    cat: "SCIENCE",
    glyph: "√",
    bg: "linear-gradient(135deg,#2A6B52,#34A07C)",
    title: "Did your health markers actually improve, or was it noise?",
    excerpt:
      "Reference Change Value is the simple idea that stops you celebrating — or fearing — a number that never really moved.",
    read: "7 MIN READ",
  },
  {
    slug: "wearables-and-bloods-fusion",
    cat: "WEARABLES",
    glyph: "∿",
    bg: "linear-gradient(135deg,#1C2620,#1E5C45)",
    title: "Can your Apple Watch and blood tests work together?",
    excerpt:
      "Your wearable is a film; a blood test is a snapshot. Put them on one timeline and each explains the other.",
    read: "6 MIN READ",
  },
];

/** Blog index hero copy (Blog.dc.html). */
export const blogIndexMeta = {
  kicker: "THE JOURNAL",
  title: "Clear answers about your health data.",
  intro:
    "Plain-English writing on biomarkers, wearables and how to actually improve — the questions people ask us most, answered the way we'd want them answered.",
};

/** All article slugs (featured first, then grid order). */
export const articleSlugs: string[] = [
  blogFeatured.slug,
  ...blogIndexCards.map((c) => c.slug),
];

export function getArticle(slug: string): Article | undefined {
  return articles[slug];
}

const MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

/**
 * Map an article's human "Reviewed <Month> <Year>" date line to an ISO 8601
 * date (first of the month) for Article JSON-LD / OpenGraph timestamps.
 * Returns undefined if the line doesn't match, so schema simply omits the date.
 */
export function articleIsoDate(date: string): string | undefined {
  const m = date.match(/([A-Za-z]+)\s+(\d{4})/);
  if (!m) return undefined;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return undefined;
  return `${m[2]}-${month}-01`;
}
