/**
 * Blog article content for the Journal.
 *
 * Copy is written for SEO/AEO: plain English, answer-first, no medical-review
 * framing. The Journal is educational wellness writing, not clinical advice.
 * The byline is "The Arcaevo Team", never a doctor or clinician, and the date
 * line says "Updated <Month> <Year>" (a freshness signal, not a clinical
 * sign-off). Keep it that way; the review/sign-off language belongs to the
 * product (results panels), not to these articles.
 *
 * Read times in `read`/`BlogIndexCard.read` are real: they are derived from the
 * article's own word count at ~225 wpm. If you edit an article's body, recount
 * and update its read time so the number stays honest.
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
  /** Reading time, e.g. "6 MIN READ". Derived from real word count. */
  read: string;
  author: string;
  /** Freshness date line, e.g. "Updated July 2026". Never a clinical sign-off. */
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
    read: "4 MIN READ",
    author: "The Arcaevo Team",
    date: "Updated July 2026",
    title: "What is ApoB, and why does it matter more than cholesterol?",
    answer:
      "ApoB is a protein that sits on the fatty particles in your blood that can clog your arteries. Each of those particles carries exactly one ApoB, so counting ApoB tells you how many harmful particles you have. That makes it a more direct measure of heart risk than a standard cholesterol number, which only estimates how much cholesterol the particles are carrying. For most people trying to protect their heart, ApoB is the single most useful number to watch.",
    blocks: [
      H2("Cholesterol tells you the cargo. ApoB counts the trucks."),
      P(
        "A normal cholesterol test measures how much cholesterol is floating around in your blood. But cholesterol on its own does not damage your arteries. It has to be carried into the artery wall inside tiny particles. Those particles are what get stuck, build up over the years, and slowly narrow the artery.",
      ),
      P(
        "ApoB counts those particles directly. Every harmful particle in your blood carries exactly one ApoB protein on its surface. So your ApoB level is a headcount of the trucks that can do the damage, not a guess about how full each truck is.",
      ),
      C(
        "Two people can have the very same cholesterol number and very different ApoB. The one with more particles has more trucks carrying the same cargo, and a higher risk that a plain cholesterol test never shows.",
      ),
      H2("Why a normal cholesterol result can still hide risk"),
      P(
        "The LDL cholesterol figure on most lab reports is usually worked out with a formula, not measured straight. The formula assumes an average amount of cholesterol in each particle. That works fine for a lot of people. But if you have high blood sugar, a lot of belly fat, or high triglycerides, your particles tend to be smaller and more crowded. Your cholesterol number can look calm while the true particle count runs high.",
      ),
      P(
        "When those two numbers point in different directions, doctors call it discordance. It is common, and it is exactly the case where ApoB earns its keep. It sees the extra trucks that the cholesterol number smooths over.",
      ),
      H2("What is a good ApoB number?"),
      P(
        "The right target depends on your own heart risk, and it is a conversation to have with your GP rather than a single figure from a website. As a rough guide, many people aiming to protect their heart want their ApoB well below the middle of the pack. What matters even more than one reading is the direction it moves over time, and whether a change is big enough to be real rather than test noise.",
      ),
      L([
        "For most people, lower ApoB is better, within reason.",
        "Your own trend over time tells you more than any single test.",
        "Check Lp(a) once as well. It is mostly set by your genes and adds useful context to your risk.",
      ]),
      H2("How to lower ApoB if it is high"),
      P(
        "If your number is high, the good news is that it responds well to change. Diet is the biggest lever for most people. That means less saturated fat from processed and fatty foods, more fibre from oats, beans, and vegetables, and more oily fish. Fibre is the quiet hero here, because it helps your body clear the particles rather than just cutting how many you make.",
      ),
      P(
        "Movement matters too. Regular exercise, losing extra weight, and cutting back on alcohol all help bring the number down. For some people, food and movement are not enough on their own, and a doctor may suggest medication. That is a decision for you and your GP, not a blog post. What a blog post can do is explain why the number is worth watching in the first place.",
      ),
      P(
        "The real point of tracking ApoB is to find out whether the change you made actually worked. You try something for a couple of months, you retest, and the number gives you an honest answer instead of a guess.",
      ),
      H2("Common questions about ApoB"),
      P(
        "Can you check ApoB at home? Yes. It is a standard blood marker, so a well-collected finger-prick or a nurse draw can both measure it, and the sample goes to the same kind of accredited lab a clinic uses.",
      ),
      P(
        "Is ApoB the same as your cholesterol ratio? No. A ratio still works from the amount of cholesterol, so it can be fooled in the same way a plain cholesterol number can. ApoB skips the guessing and counts the particles directly, which is why more and more people now ask for it by name.",
      ),
      P(
        "How often should you retest it? Once you have a baseline, there is no need to check it more than once or twice a year unless you are actively trying to change it. If you are, wait about eight to twelve weeks after a change so the new habit has time to show up.",
      ),
      H2("How Arcaevo tracks ApoB"),
      P(
        "We put ApoB front and centre instead of hiding it in a long list of lipids. We plot it against your own past results, and we only flag a change when it is bigger than normal test wobble. So when you see a drop from 0.92 to 0.74, you know it is a real move, not the machine having a bad day. Then we line it up with your activity and body trends and point you at the change most likely to help, so you are not left staring at a number with no idea what to do next.",
      ),
    ],
    takeaways: [
      "ApoB counts the particles that actually cause artery damage, so it is a more direct heart-risk marker than a plain cholesterol number.",
      "A normal cholesterol result can hide a high particle count, especially with high blood sugar or belly fat.",
      "Watch your own trend over time, and make sure a change is bigger than test noise before you trust it.",
    ],
    ctaSub: "Arcaevo leads with ApoB and shows you whether your changes moved it.",
    related: ["reference-change-value", "hba1c-explained"],
  },
  "how-often-blood-test-ireland": {
    slug: "how-often-blood-test-ireland",
    cat: "TESTING",
    read: "3 MIN READ",
    author: "The Arcaevo Team",
    date: "Updated July 2026",
    title: "How often should you get a blood test in Ireland?",
    answer:
      "For most healthy adults, one full blood test a year is enough to spot real trends. Test more often, say every 3 to 6 months, when you are actively changing something like a new training block, a medication, or a supplement, and you want to know if it worked. There is little point testing so often that you are only measuring normal day-to-day wobble.",
    blocks: [
      H2("The honest answer: it depends on what you are doing"),
      P(
        "Blood markers move slowly. Some of them physically cannot change much in a few weeks. HbA1c, for example, reflects roughly three months of blood sugar, so testing it every month tells you almost nothing new. Because of that, the right frequency is not a fixed number. It is tied to what you are actually trying to learn.",
      ),
      H2("A simple framework"),
      L([
        "Baseline: test once to set your personal starting point across the main systems.",
        "Maintenance: if nothing is changing and you feel well, once a year is plenty for most healthy adults.",
        "Intervention: when you start a new habit, supplement, or medication, wait long enough for the marker to respond, often 8 to 12 weeks, then retest to see if it worked.",
      ]),
      C(
        "A test is only worth doing if the result could change what you do next. If you would act the same way no matter what the number says, you probably do not need that test right now.",
      ),
      H2("Different markers move at different speeds"),
      P(
        "One reason there is no single answer is that markers respond on very different clocks. Some change within days, while others take months. Timing your retest to match the marker is the difference between a useful result and a waste of money.",
      ),
      L([
        "Fast movers, like blood sugar and some vitamins, can shift within weeks of a real change.",
        "Slow movers, like HbA1c, take about three months because they reflect an average over that time.",
        "Steady markers, like the ones that are mostly set by your genes, barely move at all, so they only need checking once.",
      ]),
      H2("Screening versus symptoms"),
      P(
        "It helps to separate two different reasons for testing. One is screening, where you feel fine and just want to keep an eye on things over time. The other is checking a symptom, where something feels off and you want answers. If you have a symptom that is worrying you, that is a reason to see your GP, not a reason to buy a wider panel. Regular testing is about the first case: catching a slow drift early, while it is still easy to turn around.",
      ),
      H2("Why your baseline changes the answer"),
      P(
        "The normal ranges printed on a lab report are wide. A marker can sit inside normal for years while slowly drifting toward the edge, and you would only catch that drift by comparing against your own history. This is why an annual test is worth doing even when you feel fine. It builds the baseline that makes every future change easy to read.",
      ),
      H2("What most people in Ireland actually need"),
      P(
        "If you are a healthy adult with no ongoing conditions, once a year is a sensible rhythm. If you are managing something like high cholesterol, low iron, or a thyroid issue, your GP will usually set the timing for you, and that advice comes first. If you are training hard, changing your diet, or trying a new supplement and you want proof it is working, that is when testing every few months earns its place.",
      ),
      H2("Avoiding the noise trap"),
      P(
        "Every test has some built-in variation, both from the lab and from your own body changing hour to hour. Test too often and you will watch numbers bounce around with no real change behind them, which leads to needless worry or false comfort. Arcaevo uses something called Reference Change Value to tell you when a difference is genuinely bigger than that noise, so testing more often only helps you when it can actually show you something new.",
      ),
    ],
    takeaways: [
      "Once a year suits most healthy adults. Move to every 3 to 6 months when you are actively changing something.",
      "Match the timing to how fast a marker can physically respond.",
      "Only retest when the result could change your next decision. Otherwise you are just measuring noise.",
    ],
    ctaSub: "Arcaevo builds your baseline and times your retests around your changes.",
    related: ["blood-test-cost-ireland", "blood-test-at-home-ireland"],
  },
  "reference-change-value": {
    slug: "reference-change-value",
    cat: "SCIENCE",
    read: "3 MIN READ",
    author: "The Arcaevo Team",
    date: "Updated July 2026",
    title: "Did your health markers actually improve, or was it just noise?",
    answer:
      "A marker that ticks from 56 to 58 may not have changed at all. Every result carries some wobble from the lab and some from your own body changing day to day. Reference Change Value, or RCV, is the size a change has to reach before it counts as real. If the difference between two tests is smaller than your RCV, treat it as noise, not progress and not a problem.",
    blocks: [
      H2("Why two different numbers can still mean no change"),
      P(
        "Measure the same thing twice and you almost never get the exact same result. The lab equipment has a known amount of variation, and your own body shifts with hydration, the time of day, your last meal, and stress. Add those together and a small gap between two tests is often just the act of measuring, not a real change in your health.",
      ),
      H2("The idea, in plain English"),
      C("RCV = √2 · Z · √(CVa² + CVi²)"),
      P(
        "You do not need to do this maths yourself, but here is what it means. CVa is how much the lab test varies. CVi is how much your own body varies for that marker. Z is how sure you want to be, and 1.96 gives you 95 percent confidence. The answer is the percentage a marker has to move before you can be confident the change is real. Different markers have very different thresholds. Some are steady, and some naturally swing a lot.",
      ),
      H2("What this looks like in practice"),
      L([
        "ApoB going from 0.92 to 0.74: a big drop that clears the threshold, so it is a real improvement.",
        "Vitamin D going from 56 to 58: inside the noise, so hold your course and do not read too much into it.",
        "A marker creeping up test after test, each step small but always in the same direction: worth a retest to confirm the trend is real.",
      ]),
      H2("Why your lab report does not tell you this"),
      P(
        "A normal lab report gives you a number and a wide normal range, and that is it. It cannot know your last result, so it has no way to tell you whether a change from one test to the next is real or just noise. That job is left to you, and without the threshold it is easy to get wrong. People celebrate a lucky wobble, or worry about a meaningless one, because the report never told them how much movement to expect.",
      ),
      P(
        "This is also why a single out-of-range result is not always a problem, and a single in-range result is not always a clean bill of health. The range is built for a whole population. Your own trend, judged against your own noise, is far more telling.",
      ),
      H2("Why we built the whole app around this"),
      P(
        "It is tempting to celebrate any number that moved the right way, or to panic at any number that moved the wrong way. Both are often just reactions to noise. By checking every change against your own personal threshold, Arcaevo gives you an honest verdict: real improvement, still within noise, or worth a retest. That way your decisions are based on signal, not on randomness.",
      ),
    ],
    takeaways: [
      "Small gaps between tests are often just measurement and normal body variation.",
      "RCV is the size a change has to reach to count as real.",
      "Arcaevo labels every change so you never mistake noise for progress, or for a problem.",
    ],
    ctaSub: "Every Arcaevo result comes with an honest 'did it work?' verdict.",
    related: ["apob-vs-cholesterol", "wearables-and-bloods-fusion"],
  },
  "wearables-and-bloods-fusion": {
    slug: "wearables-and-bloods-fusion",
    cat: "WEARABLES",
    read: "3 MIN READ",
    author: "The Arcaevo Team",
    date: "Updated July 2026",
    title: "Can your Apple Watch and blood tests work together?",
    answer:
      "Yes, and together they are far more useful than either one alone. A blood test is a snapshot from a single morning. Your Apple Watch is a running record of your sleep, heart rate, and activity. Put them on one timeline and each one explains the other. A jump in an inflammation marker lines up with the week your recovery fell apart, and a rising blood sugar sits next to a drop in your daily steps.",
    blocks: [
      H2("A snapshot next to a film"),
      P(
        "Blood tests are precise but rare, just a handful of moments across a year. A wearable is the opposite. It runs all day but it is indirect, guessing a lot from your heart rate, movement, and skin sensors. Neither one is complete on its own. The value shows up where they overlap. The blood test gives you a solid fact, and the watch gives you the story around it.",
      ),
      H2("Three pairings that actually change decisions"),
      L([
        "An inflammation marker next to your recovery trend: tells apart a hard week of training from a real health problem.",
        "Blood sugar next to your steps and sleep: shows whether a change in your routine is really moving the number.",
        "Iron next to your training load: flags when heavy exercise is quietly draining your iron stores.",
      ]),
      C(
        "On its own, a slightly high inflammation marker is hard to read. Placed over the exact week your recovery crashed from a chest infection, it tells a clear, calming story, and saves you an unnecessary worry.",
      ),
      H2("What a wearable can and cannot see"),
      P(
        "It helps to be honest about the limits. Your Apple Watch is very good at things it can watch continuously, like your heart rate, how much you move, and rough patterns in your sleep. It is only guessing at things it cannot measure directly, and it cannot see inside your blood at all. It has no idea what your cholesterol, your iron, or your blood sugar is doing.",
      ),
      P(
        "A blood test is the other way round. It measures what is actually in your blood with real precision, but only for the one morning you took it. It cannot tell you how you slept last Tuesday or how hard you trained last week. Neither device is wrong. They are just answering different questions, and the answers are better side by side.",
      ),
      H2("Why most services do not do this"),
      P(
        "Testing companies are built around the lab, not the wrist. Wearable apps are built around the wrist, not the lab. Very few bring both into one view. That is why a rising resting heart rate and a falling vitamin D usually live in two different apps that never talk to each other, and you are left to join the dots yourself.",
      ),
      H2("A worked example"),
      P(
        "Say your resting heart rate has been creeping up for two weeks and your sleep has been poor. On its own, that could be stress, a cold coming on, or just a busy patch. Now add a blood test that shows a raised inflammation marker over the same fortnight. Suddenly the story is clearer: your body has been fighting something, and the watch was picking up the strain before you felt it. A month later, both settle back down together, which is the reassurance that everything is back to normal. That is the kind of answer neither the watch nor the blood test could give you alone.",
      ),
      H2("How Arcaevo brings them together"),
      P(
        "We plot your blood draws right over the watch signal that best explains them, read both against your own baseline, and let the coach describe the link in plain English. It is the same data you already produce every day, finally telling one clear story instead of two half-stories.",
      ),
    ],
    takeaways: [
      "Blood tests and wearables fill each other's gaps: a solid fact plus everyday context.",
      "Putting them together turns a confusing single result into a clear, useful story.",
      "Arcaevo puts your bloods and watch trends on one timeline, read against your own baseline.",
    ],
    ctaSub: "Connect your Apple Watch and see your bloods in context.",
    related: ["apob-vs-cholesterol", "how-often-blood-test-ireland"],
  },
  "blood-test-cost-ireland": {
    slug: "blood-test-cost-ireland",
    cat: "TESTING",
    read: "4 MIN READ",
    author: "The Arcaevo Team",
    date: "Updated July 2026",
    title: "How much does a blood test cost in Ireland?",
    answer:
      "In Ireland, a private blood test usually means paying for the GP or nurse visit and then paying for the lab work on top, so the total often lands somewhere in the low hundreds of euro. The exact price depends on how many markers you test and whether a doctor draws the blood. Arcaevo keeps it simple: a single full at-home panel is €99, a recheck is €69, and a nurse home visit for a deep venous panel is €199, with everything included in one price.",
    blocks: [
      H2("Why it is hard to get a straight answer"),
      P(
        "Ask what a blood test costs in Ireland and you will get a shrug, because the price is usually split into parts. First you pay to be seen, since a GP visit without a medical card typically costs somewhere around fifty to seventy euro. Then you pay for the blood test itself, and that changes a lot depending on how many things are being checked. A single basic marker is cheap. A wide panel that covers cholesterol, blood sugar, iron, thyroid, and vitamins costs a good deal more.",
      ),
      C(
        "The confusing part is that two people can both say they got a blood test and pay very different amounts, because one checked a couple of things and the other checked forty.",
      ),
      H2("What you are actually paying for"),
      L([
        "The appointment: the GP or nurse who orders the test and takes the sample.",
        "The draw: taking the blood, either a small finger-prick or a full arm draw with a needle.",
        "The lab: the machines and staff that measure each marker you asked for.",
        "The read: someone explaining what your results mean, which is often the part people never really get.",
      ]),
      P(
        "When a price feels high, it is usually because a wide panel touches all four of those steps. When a price feels cheap, it is often because it only covers one or two markers, which may not tell you much on its own.",
      ),
      H2("Free and low-cost options first"),
      P(
        "Before paying privately, it is worth knowing what you can get through the public system. If you have a medical card or a GP visit card, many tests are covered. If your GP orders a blood test because of a specific health concern, that is a normal part of your care. Paying privately makes the most sense when you want a broad check-up on your own schedule, or you want to track your numbers over time rather than wait for a symptom.",
      ),
      H2("How Arcaevo prices it"),
      P(
        "We wanted one clear number instead of a stack of hidden fees. A single full at-home panel is €99. A recheck, for when you want to confirm a change, is €69. If you want a deep venous panel with a nurse coming to your home in the Dublin area, that is €199. Each price already includes the kit or the nurse visit, postage both ways, the lab work, and full access to the app that reads your results against your own baseline.",
      ),
      P(
        "Most people who test regularly join as members instead, which brings the yearly cost down and builds a proper history rather than a one-off snapshot. The point is the same either way: you should always know what you are paying and what you get for it.",
      ),
      H2("One-off test or membership?"),
      P(
        "For a lot of people, a single test is a snapshot that raises as many questions as it answers. You get a number, but with nothing to compare it to, you cannot tell whether it is going up, down, or holding steady. A second test months later is where the value shows up, because now you have a trend. This is why membership often works out better than paying test by test. You get more than one look across the year, the yearly cost per test comes down, and you build a real history instead of a single dot on a chart.",
      ),
      H2("What a good panel actually includes"),
      P(
        "Price aside, it is worth checking what you are getting. A useful general panel covers the main systems rather than one narrow slice. That usually means cholesterol and ApoB for your heart, HbA1c for your blood sugar, markers for your liver and kidneys, iron, and vitamin D. A very cheap test that only checks one or two of these can be a false economy, because it may not answer the question that made you test in the first place.",
      ),
      H2("Is it worth paying for?"),
      P(
        "A blood test is only worth the money if the result could change something you do. If you are healthy, feel well, and would not act on the numbers, once a year is plenty. If you are trying to improve something specific, a test that proves whether your effort worked can be well worth the price. Spend on the tests that answer a real question, and skip the ones that just make numbers bounce around.",
      ),
    ],
    takeaways: [
      "A private blood test in Ireland usually means paying for both the visit and the lab work, so totals often reach the low hundreds of euro.",
      "The price mostly depends on how many markers you test and whether a doctor draws the blood.",
      "Arcaevo uses flat, all-in pricing: €99 for a full at-home panel, €69 for a recheck, €199 for a nurse home visit.",
    ],
    ctaSub: "See exactly what your test covers, with one price and no hidden fees.",
    related: ["blood-test-at-home-ireland", "how-often-blood-test-ireland"],
  },
  "blood-test-at-home-ireland": {
    slug: "blood-test-at-home-ireland",
    cat: "TESTING",
    read: "4 MIN READ",
    author: "The Arcaevo Team",
    date: "Updated July 2026",
    title: "Can you do a blood test at home in Ireland?",
    answer:
      "Yes. In Ireland you can take a blood test at home in two ways. The simple one is a finger-prick kit that arrives in the post: you collect a few drops of blood, send it back in a prepaid envelope, and get your results online. For a wider panel that needs a full arm draw, a nurse can come to your home instead. Both skip the waiting room, and your sample still goes to a proper accredited lab.",
    blocks: [
      H2("The two ways to test at home"),
      P(
        "Home blood testing sounds high-tech, but it comes down to two simple routes. The first is a finger-prick kit. It lands in your letterbox, you follow a short set of steps to collect a few drops of blood, and you post it back the same day. The second is a nurse visit, where a trained nurse comes to your home and takes a normal arm sample. You would choose the nurse route when the panel is large and needs more blood than a fingertip can give.",
      ),
      H2("How a finger-prick kit works"),
      L([
        "The kit arrives by post with everything you need and clear instructions.",
        "You warm your hand, prick the side of a fingertip with the small lancet, and let a few drops fall into the tube.",
        "You seal it, put it in the prepaid envelope, and post it back on a weekday so it reaches the lab fresh.",
        "The lab processes it and your results appear online a few days later.",
      ]),
      C(
        "The trick to a clean finger-prick sample is warm hands and gravity. Run your hand under warm water first, keep it below your heart, and let the drops fall in rather than squeezing hard.",
      ),
      H2("Is a home test as accurate as one at a clinic?"),
      P(
        "For most everyday markers, a well-collected home sample is measured in the same kind of accredited lab a clinic would use, so the result is reliable. The main thing that changes accuracy is collection, not the lab. A rushed or squeezed finger-prick can affect a few sensitive markers. That is why some deep panels are better done as a full arm draw with a nurse, and why good home services tell you which test suits which method.",
      ),
      H2("When to choose a nurse visit instead"),
      P(
        "A finger-prick is perfect for a wide range of common checks like cholesterol, blood sugar, and vitamin D. But some panels test dozens of markers at once, or include ones that need a larger, cleaner sample. For those, a nurse visit is the better call. You still stay at home, you still skip the waiting room, and you get the full panel without the guesswork.",
      ),
      H2("How to get a good sample"),
      P(
        "A little preparation makes a real difference to how clean your result is. Check whether your test needs you to fast, since some markers like cholesterol and blood sugar can be affected by a recent meal. Drink some water beforehand, because being well hydrated makes the blood flow more easily. Post your kit back early in the week so it does not sit in a depot over the weekend, and follow the timing on the instructions so the sample reaches the lab fresh.",
      ),
      L([
        "Warm your hand under warm water and shake it gently to get the blood flowing.",
        "Prick the side of a fingertip, not the very tip, since the side is less sore and bleeds more freely.",
        "Let the drops fall into the tube rather than squeezing hard, which can spoil some markers.",
        "Fill to the line, seal it well, and post it back the same day if you can.",
      ]),
      H2("When a home kit is not the right choice"),
      P(
        "Some things are simply not suited to a home kit. If you feel faint at the sight of blood, if you struggle to get a good drop, or if the panel is very large, a nurse visit takes all of that off your plate. And if you have a health worry rather than a general check in mind, your GP is the right first stop, not a home test.",
      ),
      H2("How Arcaevo does it in Ireland"),
      P(
        "We post finger-prick kits anywhere in Ireland with prepaid return postage both ways. For our deep venous panel, a nurse comes to your home in the Dublin area and takes the sample for you. Either way, your results are read against your own past numbers, not just a wide normal range, and your Apple Watch data sits alongside them so the story is easier to follow.",
      ),
    ],
    takeaways: [
      "You can test at home in Ireland with a posted finger-prick kit, or with a nurse home visit for larger panels.",
      "A well-collected home sample goes to the same kind of accredited lab a clinic uses, so it is reliable.",
      "Warm hands and gentle drops matter. Choose a nurse draw when the panel is deep or needs more blood.",
    ],
    ctaSub: "Order an at-home kit, or book a nurse visit in the Dublin area.",
    related: ["blood-test-cost-ireland", "wearables-and-bloods-fusion"],
  },
  "vitamin-d-ireland": {
    slug: "vitamin-d-ireland",
    cat: "BIOMARKERS",
    read: "3 MIN READ",
    author: "The Arcaevo Team",
    date: "Updated July 2026",
    title: "Why is vitamin D so important in Ireland?",
    answer:
      "Your body makes vitamin D from sunlight on your skin, and Ireland simply does not get enough strong sun for a large part of the year. From about October to March, the sun sits too low for your skin to make much at all, so many people here run low over winter. Low vitamin D is linked to weaker bones, low mood, and a run-down feeling, which is why testing it and topping it up matters more here than in sunnier places.",
    blocks: [
      H2("Why Ireland is a special case"),
      P(
        "Vitamin D is often called the sunshine vitamin because your skin makes it when strong sunlight hits it. The problem is that Ireland sits far enough north that, for roughly half the year, the sun never climbs high enough for that to happen. Even on a bright winter day, the light is too weak. Add in our cloud, our rain, and the very sensible habit of covering up, and it is easy to see why low vitamin D is so common here.",
      ),
      C(
        "From about October to March, most people in Ireland make almost no vitamin D from the sun, no matter how much time they spend outside.",
      ),
      H2("What vitamin D actually does"),
      P(
        "Vitamin D helps your body take in calcium, which keeps your bones and teeth strong. It also plays a role in your muscles, your immune system, and your mood. When levels drop low for a long time, people can feel tired and run down, notice their mood dip in winter, and over years face a higher risk of weaker bones. None of that is a diagnosis, and low energy has many causes, but vitamin D is one of the easiest to check and to fix.",
      ),
      H2("How to keep your level up"),
      L([
        "Food helps a little: oily fish, eggs, and fortified foods all carry some vitamin D.",
        "Summer sun helps, in short sensible amounts, without burning.",
        "A daily supplement is the reliable option through the Irish winter, and public health advice here often points people toward one.",
      ]),
      P(
        "How much you need depends on your age, your skin, and your starting level, so it is worth checking with your GP or pharmacist rather than guessing. More is not always better, because very high doses over a long time can cause problems of their own.",
      ),
      H2("Who is most likely to run low"),
      P(
        "Some people in Ireland are more at risk than others. If you have darker skin, you make less vitamin D from the same amount of sun, so northern winters hit harder. Older adults make less of it too, and often spend more time indoors. People who cover up for cultural or health reasons, anyone who works nights or long indoor shifts, and those carrying extra weight are all more likely to sit low. If any of that is you, it is even more worth checking rather than assuming you are fine.",
      ),
      H2("How long it takes to fix"),
      P(
        "Vitamin D does not bounce back overnight. If you start a daily supplement, it usually takes a couple of months of steady use before your level climbs into a healthier range. That is exactly why a retest makes sense around the eight to twelve week mark rather than a few days later. Test too soon and the number has not caught up yet, which can trick you into thinking the supplement is not working when it just needs more time.",
      ),
      H2("Why testing beats guessing"),
      P(
        "You cannot feel your exact vitamin D level, and the symptoms of a low level are easy to blame on a busy winter. A simple blood test tells you where you actually stand. Then, if you start a supplement, a retest a couple of months later shows whether it did the job. That loop, test, act, retest, is far more useful than taking a pill on faith and hoping.",
      ),
      H2("How Arcaevo handles vitamin D"),
      P(
        "We track your vitamin D against your own past results and against the seasons, so a winter dip is easy to spot and act on early. When you start a supplement, we help you time the retest for long enough after that the change is real and not just noise. And because your sleep and activity sit on the same timeline, that flat, run-down winter feeling is easier to make sense of.",
      ),
    ],
    takeaways: [
      "Ireland gets too little strong sun from about October to March, so many people run low on vitamin D over winter.",
      "Low vitamin D is linked to weaker bones, low mood, and low energy, and it is one of the easiest things to check and fix.",
      "Test rather than guess, and retest after starting a supplement to confirm it worked.",
    ],
    ctaSub: "Track your vitamin D through the Irish winter and prove your supplement works.",
    related: ["hba1c-explained", "how-often-blood-test-ireland"],
  },
  "hba1c-explained": {
    slug: "hba1c-explained",
    cat: "BIOMARKERS",
    read: "3 MIN READ",
    author: "The Arcaevo Team",
    date: "Updated July 2026",
    title: "What does HbA1c tell you about your blood sugar?",
    answer:
      "HbA1c is your average blood sugar over roughly the last three months, rolled into one number. Sugar in your blood sticks to a protein in your red blood cells, and because those cells live about three months, the amount that has stuck acts like a memory of your blood sugar over that time. A single sugar reading tells you this moment. HbA1c tells you the bigger picture, which is why doctors use it to spot early warning signs.",
    blocks: [
      H2("A three-month memory, not a moment"),
      P(
        "A normal blood sugar reading is a snapshot. It changes with what you just ate, how you slept, and whether you are stressed, so one high reading does not mean much on its own. HbA1c is different. Sugar in your blood slowly sticks to the red cells that carry oxygen, and those cells live for about three months. The more sugar has been floating around, the more of it sticks. So HbA1c becomes a running average of your blood sugar over roughly the last twelve weeks.",
      ),
      C(
        "This is why HbA1c cannot change overnight. You cannot fix it with one good week or ruin it with one bad weekend. It moves with your habits over months, which is exactly what makes it useful.",
      ),
      H2("What the number is broadly telling you"),
      P(
        "In simple terms, a lower HbA1c means your blood sugar has been running lower on average, and a higher one means it has been running higher. Doctors use set ranges to sort results into a normal band, an early-warning band that is sometimes called prediabetes, and a band that points toward diabetes. The exact cut-offs and what they mean for you are a conversation for your GP, because your full picture matters, not just one figure.",
      ),
      H2("Why the early-warning zone matters most"),
      P(
        "The most useful thing about HbA1c is that it can flag a problem years before you feel anything. Blood sugar can drift upward slowly and quietly, sitting in that early-warning zone long before it becomes an illness. Catching it there is a gift, because this is the stage where changes to food, movement, and weight can turn the trend around. Later is harder.",
      ),
      H2("What moves it"),
      L([
        "Cutting back on sugary drinks and refined carbs, which spike blood sugar the hardest.",
        "Regular movement, especially a short walk after meals, which helps your body use sugar.",
        "Losing extra weight, particularly around the middle.",
        "Better sleep, since poor sleep nudges blood sugar the wrong way.",
      ]),
      H2("HbA1c is not the same as a finger-prick glucose"),
      P(
        "It is easy to mix these up, because both involve blood sugar. A finger-prick glucose reading, the kind people with diabetes often take at home, tells you your blood sugar right now, in this moment. It jumps around all day. HbA1c is the long average that sits behind those moments. You need the quick reading to manage day to day, but you need HbA1c to see the trend over months. They answer different questions, and Arcaevo cares about the trend.",
      ),
      H2("When HbA1c can mislead"),
      P(
        "HbA1c leans on your red blood cells, so anything that changes those cells can throw it off. If you have anaemia, a condition that affects your red cells, or you are pregnant, the number can read higher or lower than your true blood sugar. That is one more reason to treat any single result as a starting point for a conversation with your GP rather than a final verdict, especially if it does not match how you feel.",
      ),
      H2("How Arcaevo tracks HbA1c"),
      P(
        "Because HbA1c only moves over months, testing it too often just shows you noise. We help you retest at the right spacing, usually about three months apart, so each result reflects a real stretch of your life. We check every change against your own history so a small wobble does not get treated as progress. And we line your HbA1c up with your steps and sleep, so you can see whether the changes you made are the ones moving the number.",
      ),
    ],
    takeaways: [
      "HbA1c is your average blood sugar over about three months, not a single moment.",
      "It changes slowly, so it reflects your habits over time and cannot be fixed in one week.",
      "Its real value is early warning: it can flag rising blood sugar years before you feel anything.",
    ],
    ctaSub: "Track your HbA1c on the right schedule and see what actually moves it.",
    related: ["apob-vs-cholesterol", "reference-change-value"],
  },
};

/** Featured article on the blog index (Blog.dc.html). */
export const blogFeatured: BlogIndexFeatured = {
  slug: "apob-vs-cholesterol",
  cat: "BIOMARKERS",
  title: "What is ApoB, and why does it matter more than cholesterol?",
  excerpt:
    "The single best marker for heart-disease risk is not the one on your standard cholesterol panel. Here is what ApoB measures, why it beats a plain cholesterol number, and what a good result looks like.",
};

/** Blog index grid cards (Blog.dc.html), in design order. */
export const blogIndexCards: BlogIndexCard[] = [
  {
    slug: "blood-test-cost-ireland",
    cat: "TESTING",
    glyph: "€",
    bg: "linear-gradient(135deg,#1E5C45,#2E7D5B)",
    title: "How much does a blood test cost in Ireland?",
    excerpt:
      "Why the price is so hard to pin down, what you are really paying for, and how flat all-in pricing compares.",
    read: "4 MIN READ",
  },
  {
    slug: "blood-test-at-home-ireland",
    cat: "TESTING",
    glyph: "⌂",
    bg: "linear-gradient(135deg,#2A6B52,#34A07C)",
    title: "Can you do a blood test at home in Ireland?",
    excerpt:
      "Finger-prick kit or nurse home visit: the two ways to test at home, and how to get an accurate sample.",
    read: "4 MIN READ",
  },
  {
    slug: "vitamin-d-ireland",
    cat: "BIOMARKERS",
    glyph: "☀",
    bg: "linear-gradient(135deg,#1C2620,#1E5C45)",
    title: "Why is vitamin D so important in Ireland?",
    excerpt:
      "Ireland gets too little strong sun for half the year. Here is why so many of us run low, and what to do about it.",
    read: "3 MIN READ",
  },
  {
    slug: "hba1c-explained",
    cat: "BIOMARKERS",
    glyph: "%",
    bg: "linear-gradient(135deg,#2E7D5B,#5FB592)",
    title: "What does HbA1c tell you about your blood sugar?",
    excerpt:
      "Your three-month blood sugar average in one number, and why it can flag a problem years before you feel it.",
    read: "3 MIN READ",
  },
  {
    slug: "how-often-blood-test-ireland",
    cat: "TESTING",
    glyph: "◷",
    bg: "linear-gradient(135deg,#1E5C45,#2E7D5B)",
    title: "How often should you get a blood test in Ireland?",
    excerpt:
      "Once a year is fine for most healthy adults, but the honest answer depends on your baseline and what you are changing.",
    read: "3 MIN READ",
  },
  {
    slug: "reference-change-value",
    cat: "SCIENCE",
    glyph: "√",
    bg: "linear-gradient(135deg,#2A6B52,#34A07C)",
    title: "Did your health markers actually improve, or was it noise?",
    excerpt:
      "Reference Change Value is the simple idea that stops you celebrating, or fearing, a number that never really moved.",
    read: "3 MIN READ",
  },
  {
    slug: "wearables-and-bloods-fusion",
    cat: "WEARABLES",
    glyph: "∿",
    bg: "linear-gradient(135deg,#1C2620,#1E5C45)",
    title: "Can your Apple Watch and blood tests work together?",
    excerpt:
      "Your watch is a film and a blood test is a snapshot. Put them on one timeline and each one explains the other.",
    read: "3 MIN READ",
  },
];

/** Blog index hero copy (Blog.dc.html). */
export const blogIndexMeta = {
  kicker: "THE JOURNAL",
  title: "Clear answers about your health data.",
  intro:
    "Plain-English writing on biomarkers, wearables, and how to actually improve. The questions people ask us most, answered the way we would want them answered.",
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
 * Map an article's human date line (e.g. "Updated July 2026") to an ISO 8601
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
