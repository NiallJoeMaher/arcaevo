# Motion/Logo/Empty-States Handoff (Web) + Prod Launch Gate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the 2026-07-06 `design_handoff_2026-07-06_motion_haptics` package for the **marketing site** (motion layer, logo lockup + mark-only mobile nav, responsive deltas, Careers empty state, Pricing early-access gate), keep the two blood-test plans disabled in prod via the existing `BLOOD_TIERS_ENABLED` flag, and produce the Vercel production env values.

**Architecture:** The motion layer is a tiny dep-free client component (`SiteMotion`) mounted by `SiteNav` — a faithful port of the handoff's `site-motion.js` (IntersectionObserver reveal + SVG line draw, no-op under `prefers-reduced-motion`). Hero load animations are CSS keyframes in `globals.css` applied inline on Home/App. The logo becomes a shared `BrandMark` inline-SVG component (currentColor). The early-access gate reuses the existing `bloodTiersEnabled()` flag: flag OFF (prod) now renders the new handoff design (Get early access → anchored form posting to the existing `/api/v1/waitlist`, extended additively with `name` + `planInterest`). Nothing changes for flag ON, so the whole e2e suite (which pins the flag ON) stays green.

**Tech Stack:** Next.js 16 App Router (⚠️ modified — read `apps/web/node_modules/next/dist/docs/` before assuming conventions, per `apps/web/AGENTS.md`), Tailwind v4 `@theme` tokens, zod, vitest, Playwright. **No new dependencies** (dep ban — see BUILD_STATE "Wanted deps").

**Scope note:** iOS/watchOS motion + haptics from this handoff are deliberately OUT of scope here (separate SwiftUI effort; prod = web). The handoff is a delta on `design_handoff_ios_watch/` + the site designs — web-only rules extracted below.

**Non-negotiables from the handoff (verify against these at every step):**
- Every animation behind `prefers-reduced-motion` (script no-ops, CSS keyframes disabled).
- Nothing loops, nothing exceeds 1.3s, stagger ≤180ms, reveal below-the-fold only — the page never flashes on first paint.
- Restraint list — never: parallax, marquee, animated numbers outside product mocks, background gradient motion, **animating the logo** (the mark is the one permanently still element; never wrap the mark itself in a reveal/draw).
- Logo: single colour via currentColor — Forest `#1E5C45` on light, `#7FD3AE` on dark (`--color-forest` / `--color-vitality-light` tokens already exist). Mark ≥16px wide, never stretched (viewBox 643×495). Nav <760px: wordmark drops, mark only, ≥44px hit area.
- Copy is verbatim from the design files. Prices contractual and unchanged.
- Legal body static (script loads, zero markers). Admin/account surfaces: no motion at all (they don't render SiteNav, so they never load the script).

**Reference materials:**
- Handoff: `/Users/niallmaher/Downloads/design_handoff_2026-07-06_motion_haptics/` (Task 1 copies it into the repo at `design_handoff_motion_haptics/` — reference the repo copy thereafter).
- `MOTION.md` (site motion system + logo rules), `RESPONSIVE.md`, `EMPTY_STATES.md` (Careers + Pricing gate), `designs/site-motion.js` (reference implementation), `designs/site-mobile.css`, `designs/{Home,App,Pricing,Careers,SiteNav,…}.dc.html` — open these in a browser (keep `support.js`/`site-motion.js` beside them); **the animations you see ARE the spec** and every duration/easing is inline on the element.

---

## Task 1: Branch + vendor the handoff into the repo

**Files:**
- Create: `design_handoff_motion_haptics/` (copy of the Downloads package)

**Step 1: Create the working branch**

```bash
cd /Users/niallmaher/Projects/arcaevo
git checkout -b feat-motion-handoff
```

**Step 2: Copy the handoff (repo convention: every handoff is vendored, versioned)**

```bash
cp -R "/Users/niallmaher/Downloads/design_handoff_2026-07-06_motion_haptics" design_handoff_motion_haptics
```

**Step 3: Commit**

```bash
git add design_handoff_motion_haptics
git commit -m "chore: vendor 2026-07-06 motion/haptics/empty-states design handoff"
```

---

## Task 2: `BrandMark` component + logo lockup in SiteNav and SiteFooter

The two-stroke "A" arc mark (the exact two paths already in `apps/web/public/brand-mark.svg`, minus the circle background) becomes an inline-SVG component so it inherits `currentColor`.

**Files:**
- Create: `apps/web/src/components/BrandMark.tsx`
- Modify: `apps/web/src/components/SiteNav.tsx` (logo lockup, lines 28–35)
- Modify: `apps/web/src/components/SiteFooter.tsx` (footer lockup, lines ~71–79)

**Step 1: Create `BrandMark.tsx`**

```tsx
/**
 * The Arcaevo mark — the two-stroke "A" arc (design_handoff_motion_haptics,
 * logo rules in MOTION.md). Single colour via currentColor: Forest #1E5C45 on
 * light surfaces, #7FD3AE on dark. viewBox is 643×495 (~1.3:1) — never
 * stretch, never redraw, never animate (the mark is the one permanently
 * still element on every page). Minimum rendered width 16px.
 */
export default function BrandMark({
  width = 22,
  className = "",
}: {
  width?: number;
  className?: string;
}) {
  const height = Math.round((width * 495) / 643);
  return (
    <svg
      viewBox="0 0 643 495"
      width={width}
      height={height}
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        fill="currentColor"
        d="M239.5 40.5L135.5 238C169.985 215.919 206.5 210.5 245.5 210.5C284.5 210.5 307.5 220.5 330.5 244.5C353.5 268.5 466 494.5 466 494.5H643L403.5 40.5C382.222 16.3216 365.74 2.81888 323.5 0C280.811 0.0641026 264.041 11.5171 239.5 40.5Z"
      />
      <path
        fill="currentColor"
        d="M121.5 306C75 335 34.893 414.244 0 494.5C87.4362 492.587 130.672 479.973 194 430C215.163 416.437 232.783 396.308 294.5 274.5C200.79 267.004 168 277 121.5 306Z"
      />
    </svg>
  );
}
```

**Step 2: SiteNav lockup** — replace the text-only logo (SiteNav.tsx lines 28–35) with mark + wordmark. Mark 22px wide (renders 22×17), forest, 11px gap (already the gap class). The `<Link>` must keep a ≥44px hit area on mobile (add `min-h-11` + `items-center`):

```tsx
<Link
  href="/"
  className="flex min-h-11 shrink-0 items-center gap-[11px] text-ink no-underline"
>
  <BrandMark width={22} className="shrink-0 text-forest" />
  <span
    data-nav-wordmark
    className="text-[19px] font-semibold tracking-[-0.01em] max-md:hidden"
  >
    {m.brand}
  </span>
</Link>
```

(`max-md:hidden` = the <760px mark-only rule; Tailwind's `md` 768px breakpoint stands in for the design's 760px — same rule used throughout this plan. Mobile nav-links row is Task 5.)

**Step 3: SiteFooter lockup** — footer is dark (`bg-ink-deep`), so the mark is the bright green. Full lockup allowed in the footer. Replace the text-only span block:

```tsx
<Link
  href="/"
  className="mb-4 flex items-center gap-[11px] no-underline"
>
  <BrandMark width={22} className="shrink-0 text-vitality-light" />
  <span className="text-[17px] font-semibold text-bone-white">Arcaevo</span>
</Link>
```

**Step 4: Verify**

```bash
cd apps/web && npx tsc --noEmit && npm run dev
```

Open http://localhost:3000 — mark renders forest beside "Arcaevo" in the nav, bright green in the footer; shrink the window below 768px — wordmark disappears, mark remains tappable. Compare against `design_handoff_motion_haptics/designs/SiteNav.dc.html` opened in a browser.

**Step 5: Commit**

```bash
git add src/components/BrandMark.tsx src/components/SiteNav.tsx src/components/SiteFooter.tsx
git commit -m "feat: brand mark component + logo lockup in nav/footer per logo rules"
```

---

## Task 3: Motion foundation — `SiteMotion` client component + CSS keyframes

Faithful port of `designs/site-motion.js`. Mounted by `SiteNav`, so exactly the pages that have site chrome get motion (Legal included — it has no markers so stays static; admin/account never render SiteNav).

**Files:**
- Create: `apps/web/src/components/SiteMotion.tsx`
- Modify: `apps/web/src/components/SiteNav.tsx` (render `<SiteMotion />`)
- Modify: `apps/web/src/app/globals.css` (keyframes + reduced-motion guard, ~68 lines currently)

**Step 1: Create `SiteMotion.tsx`** — port the reference exactly (same observer options, same above-the-fold guard, same inline-style transitions):

```tsx
"use client";

import { useEffect } from "react";

/**
 * The site motion layer — a 1:1 port of the handoff's site-motion.js
 * (design_handoff_motion_haptics/designs/site-motion.js). Scroll-reveal for
 * [data-reveal] (optional [data-reveal-delay] ms stagger, ≤180ms) and SVG
 * line draw for [data-draw]. Elements already visible on first paint are left
 * completely static so the page never flashes; under prefers-reduced-motion
 * the whole layer no-ops. Hero load animations are NOT here — they're CSS
 * keyframes (globals.css) applied inline on the hero elements.
 */
const EASE = "cubic-bezier(0.22,1,0.36,1)";

export default function SiteMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          io.unobserve(el);
          const delay = parseFloat(el.dataset.revealDelay ?? "0") || 0;
          window.setTimeout(() => {
            if (el.dataset.motionDraw === "true") {
              el.style.strokeDashoffset = "0";
            } else {
              el.style.opacity = "1";
              el.style.transform = "none";
            }
          }, delay);
        }
      },
      { rootMargin: "0px 0px -7% 0px", threshold: 0.06 }
    );

    // Above-the-fold guard: anything in the first view on initial paint stays
    // static (never hidden) — reveal is below-fold only.
    const inFirstView = (el: Element) =>
      el.getBoundingClientRect().top < window.innerHeight * 0.95 &&
      window.scrollY < 40;

    const prepReveal = (el: HTMLElement) => {
      if (el.dataset.motionPrepped) return;
      el.dataset.motionPrepped = "true";
      if (inFirstView(el)) return;
      el.style.opacity = "0";
      el.style.transform = "translateY(16px)";
      el.style.transition = `opacity 0.75s ${EASE}, transform 0.75s ${EASE}`;
      io.observe(el);
    };

    const prepDraw = (el: SVGElement) => {
      if (el.dataset.motionPrepped) return;
      el.dataset.motionPrepped = "true";
      el.dataset.motionDraw = "true";
      if (inFirstView(el)) return;
      el.setAttribute("pathLength", "100");
      el.style.strokeDasharray = "100";
      el.style.strokeDashoffset = "100";
      el.style.transition = `stroke-dashoffset 1.2s ${EASE}`;
      io.observe(el);
    };

    const scan = (root: ParentNode) => {
      root.querySelectorAll<HTMLElement>("[data-reveal]").forEach(prepReveal);
      root.querySelectorAll<SVGElement>("[data-draw]").forEach(prepDraw);
    };

    scan(document);

    // Re-scan DOM added after mount (accordions, client-rendered sections) —
    // mirrors the reference's MutationObserver.
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node instanceof Element) scan(node);
        });
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return null;
}
```

**Step 2: Mount in SiteNav** — add `<SiteMotion />` as the first child inside the `<header>` in `SiteNav.tsx` (import it; SiteNav itself stays a server component — SiteMotion is the client island).

**Step 3: globals.css** — append the hero keyframes + reduced-motion kill switch (exact values off the design heads of `Home.dc.html` / `App.dc.html`):

```css
/* ——— Motion layer (design_handoff_motion_haptics) ———
   Hero load animations. Scroll reveal/draw live in SiteMotion.tsx.
   Nothing loops; longest duration 1.3s (ring draw). */
@keyframes rise {
  from { opacity: 0; transform: translateY(14px); }
}
@keyframes ring314 {
  from { stroke-dashoffset: 314; }
}
@keyframes draw100 {
  from { stroke-dashoffset: 100; }
  to { stroke-dashoffset: 0; }
}
.motion-rise { animation: rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) backwards; }
.motion-rise-delayed { animation: rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.12s backwards; }
.motion-ring { animation: ring314 1.3s cubic-bezier(0.33, 1, 0.68, 1) 0.45s backwards; }
.motion-trace { animation: draw100 1.2s cubic-bezier(0.4, 0, 0.2, 1) 0.5s backwards; }

@media (prefers-reduced-motion: reduce) {
  .motion-rise, .motion-rise-delayed, .motion-ring, .motion-trace {
    animation: none !important;
  }
}
```

**Step 4: Verify**

```bash
npx tsc --noEmit && npm run build
```

Expected: clean build. No visual change yet (no markers exist).

**Step 5: Commit**

```bash
git add src/components/SiteMotion.tsx src/components/SiteNav.tsx src/app/globals.css
git commit -m "feat: site motion foundation — reveal/draw client island + hero keyframes"
```

---

## Task 4: Hero load animations + per-page reveal markers

Apply the markers page by page. **Open each `.dc.html` in a browser first and scroll through it — match what you see.** Marker placement below is the authoritative summary extracted from the design files; when in doubt, grep the design file for `data-reveal`.

**Files (all under `apps/web/src/app/`):**
- Modify: `page.tsx` (Home), `app/page.tsx`, `pricing/page.tsx`, `how-it-works/page.tsx`, `science/page.tsx`, `compare/page.tsx`, `compare/[slug]/page.tsx`, `blog/page.tsx`, `blog/[slug]/page.tsx`, `about/page.tsx`, `careers/page.tsx`, `help/page.tsx`, `contact/page.tsx`
- Do NOT touch: `legal/[doc]/page.tsx` (static body by design), anything under `admin/`, `account/`, auth routes.

**Step 1: Home hero load animation** (`page.tsx` hero section, ~line 300):
- Text column wrapper: `className` + ` motion-rise`.
- Product-card column: ` motion-rise-delayed`.
- The health-score ring's progress `<circle>` (the one with `strokeDasharray="314"` / offset 60 — verify against `Home.dc.html`): add `motion-ring` class.

**Step 2: App page hero** (`app/page.tsx`): text column `motion-rise`, phone-mock column `motion-rise-delayed`, ring (if present per design: delay is 0.4s on App — add a `motion-ring-app { animation-delay: 0.4s }` variant in globals.css if the App design uses 0.4s; check `App.dc.html` head) and the phone-mock trend `<polyline>` gets `motion-trace` + `pathLength="100"` + `strokeDasharray="100"` + `strokeDashoffset="100"` inline attributes (animates 100→0; the dashed amber comparison line stays static).

**Step 3: Below-fold `data-reveal` sweep** — add the attribute (plus delays where listed) to these elements. In JSX: `data-reveal=""` and `data-reveal-delay="90"`.

| Page | Markers (from the design files) |
|---|---|
| Home | Each section heading block (how-it-works header, pricing-teaser header, differentiators intro, founder quote, final CTA panel); 3 how-it-works step cards with delays 0/90/180; all 6 differentiator cards; the two FUSION sparkline `<polyline>`s get `data-draw`; pricing-teaser cards with middle card `data-reveal-delay="80"` |
| App | Each of the 6 feature-grid cards; final CTA panel |
| Pricing | All 3 plan cards; cadence panel + its H2; compare-plans H2 + table wrapper; market-context H2 + 4 market cards; FAQ H2 |
| HowItWorks | Step-detail grid; FUSION explainer H2; "what lands in your app" H2 + cards |
| Science | Pillar cards; RCV explainer H2; "why these markers" H2 + marker grid; safety-bar H2 |
| Compare | Arcaevo summary row; each competitor card |
| Versus (`compare/[slug]`) | "At a glance" H2 + table wrapper; "where each wins" block; "honest take" H2; "people also ask" H2 |
| Blog | Featured post card; each grid post card |
| Article (`blog/[slug]`) | Body H2 subheadings; key-takeaways block |
| About | Values/stats cards; "the team" H2 |
| Careers | Perk cards; "Open roles" H2 (the empty-state card gets its marker in Task 6) |
| Help | Category group H2s; FAQ accordion block |
| Contact | The form/detail block |

**Never** put `data-reveal`/`data-draw` on the BrandMark or its wrapper link.

**Step 4: Home pricing-teaser hover lift** (Home only — the actual /pricing plan cards have reveal but NO hover lift). On the three teaser cards (`page.tsx` ~lines 530–597), add:
- light cards: `transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:opacity-100 hover:shadow-[0_18px_40px_-26px_rgba(28,38,32,0.4)]`
- dark (Essential) card: same but `hover:shadow-[0_30px_60px_-28px_rgba(28,38,32,0.7)]`
(`hover:opacity-100` beats the global `a:hover { opacity: 0.72 }` so the lift reads clean. `-translate-y-1` = −4px.)

**Step 5: Verify visually against the prototypes**

```bash
npm run dev
```

Side-by-side with `designs/Home.dc.html` etc. in a browser: hero settles in (text then card 120ms later, ring draws over 1.3s from 0.45s), sections rise 16px/0.75s as you scroll, nothing flashes above the fold, staggers read ≤180ms. Then set macOS Reduce Motion (System Settings → Accessibility → Display) or emulate `prefers-reduced-motion` in DevTools → everything static, content all visible. Check /legal/privacy scrolls with zero motion.

**Step 6: Run the existing e2e to catch regressions**

```bash
npm run e2e
```

Expected: all green (markers are attribute-only; hidden-until-reveal only applies below fold with JS enabled — Playwright scrolls and elements reveal; if any `toBeVisible` assertion races a reveal, prefer scrolling into view in the test… but expect no changes needed).

**Step 7: Commit**

```bash
git add src/app src/app/globals.css
git commit -m "feat: hero load animations + scroll-reveal markers across marketing pages"
```

---

## Task 5: Responsive deltas — mobile nav row + scrolling comparison tables + mobile gutters

Reproduce `site-mobile.css` as Tailwind utilities (production note in RESPONSIVE.md says exactly this). `md:` (768px) stands in for ≤760px.

**Files:**
- Modify: `apps/web/src/components/SiteNav.tsx`
- Modify: `apps/web/src/app/pricing/page.tsx` (compare table), `apps/web/src/app/compare/[slug]/page.tsx` (at-a-glance table)
- Modify: marketing pages' 4-up strips (About stats, Careers perks, Pricing market scan) — verify they already collapse (`sm:grid-cols-2 md:grid-cols-4` = the stack2 2×2 behaviour; adjust any that don't)

**Step 1: Mobile nav** — the links row becomes a horizontally scrollable second row under the logo (no hamburger, no JS). Rework `SiteNav.tsx`:
- `<nav>`: add `flex-wrap gap-y-2 max-md:px-5 max-md:pb-[10px] max-md:pt-3`
- links wrapper: replace `hidden … md:flex` with `order-3 flex w-full items-center gap-[22px] overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:order-none md:w-auto md:gap-7 md:overflow-visible md:pb-0`
- each link: add `whitespace-nowrap`
- CTA pill: add `max-md:px-4 max-md:py-[9px] max-md:text-[12.5px]`

**Step 2: Comparison tables scroll** — wrap the Pricing plan-compare `<table>` and the Versus at-a-glance `<table>` in `<div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">` and give the table `min-w-[600px]` (rows keep width instead of crushing columns). The `data-reveal` from Task 4 goes on this wrapper div.

**Step 3: Mobile gutters + h1 clamp** — marketing sections use `px-10` (40px); the design wants 22px under 760px. Mechanical sweep across the 13 marketing pages + SiteFooter:

```bash
# from apps/web — marketing surfaces only (NOT admin/account/auth):
grep -rln "px-10" src/app/{page.tsx,app,pricing,how-it-works,science,compare,blog,about,careers,help,contact,legal} src/components/SiteFooter.tsx
```

Replace `px-10` with `px-[22px] md:px-10` in those files (leave `admin/`, `account/`, auth flows untouched). For each page's `<h1>`, prepend `max-md:text-[clamp(34px,9.5vw,42px)]` so mobile clamps to 34–42px.

**Step 4: Verify**

```bash
npx tsc --noEmit && npm run dev
```

DevTools responsive mode at 390×844: nav shows mark-only + compact pill + scrollable link row; /pricing table pans horizontally; gutters 22px; h1s ≤42px. At 1280px: identical to before.

**Step 5: e2e + commit**

```bash
npm run e2e   # nav links are now always in the DOM (better than the old hidden-below-md) — expect green
git add src/components/SiteNav.tsx src/app src/components/SiteFooter.tsx
git commit -m "feat: mobile nav row, scrolling compare tables, 22px mobile gutters"
```

---

## Task 6: Careers empty state

`EMPTY_STATES.md`: no roles are open. Empty the array; render the designed empty state; roles list + "Don't see your role?" line stay in the code and return automatically when entries are added.

**Files:**
- Modify: `apps/web/src/app/careers/page.tsx` (ROLES array lines 33–59, roles section lines 103–136)

**Step 1: Empty the array (keep the shape + a re-open comment)**

```tsx
/**
 * No roles are open right now (EMPTY_STATES.md, 2026-07-06). Add entries like
 *   { title: "Senior iOS Engineer", meta: "SwiftUI · HealthKit · Dublin/Remote-EU", team: "ENGINEERING" }
 * to re-open the board — the empty state below hides automatically.
 */
const ROLES: { title: string; meta: string; team: string }[] = [];
```

**Step 2: Conditional render.** Keep the existing `<h2>Open roles</h2>` (now with `data-reveal` from Task 4). Wrap the current list + "Don't see your role?" paragraph in `{ROLES.length > 0 && (…)}`. Add the empty state for `ROLES.length === 0` — copy verbatim, exact styling from `Careers.dc.html` lines 65–76:

```tsx
{ROLES.length === 0 && (
  <div
    data-reveal=""
    className="rounded-[22px] border-[1.5px] border-dashed border-[rgba(28,38,32,0.18)] bg-surface px-10 py-14 text-center"
  >
    <BrandMark width={30} className="mx-auto mb-5 text-forest opacity-80" />
    <h3 className="mb-3 mt-0 font-serif text-[30px] font-normal leading-[1.1]">
      Nothing open right now.
    </h3>
    <p className="mx-auto mb-[26px] mt-0 max-w-[48ch] text-[15px] leading-[1.6] text-muted">
      We hire slowly and deliberately — a small senior team stays small until
      the product demands otherwise. New roles appear here first, usually
      engineering and clinical.
    </p>
    <div className="flex flex-wrap items-center justify-center gap-[14px]">
      <Link
        href="/contact"
        className="rounded-pill bg-forest px-[26px] py-[13px] text-[15px] font-semibold text-white no-underline"
      >
        Introduce yourself anyway →
      </Link>
      <Link
        href="/blog"
        className="text-sm font-semibold text-forest no-underline"
      >
        We announce roles on the journal first →
      </Link>
    </div>
    <div className="mt-6 font-mono text-[10px] tracking-[0.1em] text-caption">
      EXCEPTIONAL PEOPLE ALWAYS READ · NO CV FORMAT REQUIRED
    </div>
  </div>
)}
```

(Import `BrandMark`. `text-caption` is the WCAG-adjusted gray — deliberate deviation from the design's `#7C887F`, per BUILD_STATE; do not use the raw hex.)

**Step 3: Write the e2e (new spec `apps/web/e2e/careers.spec.ts`)**

```ts
import { test, expect } from "@playwright/test";

test.describe("careers — empty board", () => {
  test("designed empty state renders; no role cards", async ({ page }) => {
    await page.goto("/careers");
    await expect(
      page.getByRole("heading", { name: "Nothing open right now." })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Introduce yourself anyway →" })
    ).toHaveAttribute("href", "/contact");
    await expect(
      page.getByRole("link", { name: "We announce roles on the journal first →" })
    ).toHaveAttribute("href", "/blog");
    await expect(page.getByText("Apply →")).toHaveCount(0);
  });
});
```

**Step 4: Run it**

```bash
npx playwright test e2e/careers.spec.ts
```

Expected: PASS (2 assertions of link hrefs, heading visible after reveal).

**Step 5: Commit**

```bash
git add src/app/careers/page.tsx e2e/careers.spec.ts
git commit -m "feat: careers empty state — no open roles (EMPTY_STATES.md)"
```

---

## Task 7: Waitlist API — additive `name` + `planInterest`, eligible areas joinable while sales are off

The pricing early-access form (Task 8) posts name/email/routing-key + plan interest to the existing waitlist. Two backend deltas, both additive:

**Files:**
- Modify: `apps/web/src/lib/models.ts` (`WaitlistEntrySchema` line 474, `WaitlistJoinInput`)
- Modify: `apps/web/src/app/api/v1/waitlist/route.ts`
- Test: `apps/web/src/lib/__tests__/models.test.ts` (or the existing waitlist/model test file — follow its pattern)

**Step 1: Write failing tests** — in the models test file:

```ts
it("waitlist entry + join input accept optional name and planInterest", () => {
  expect(
    WaitlistEntrySchema.safeParse({
      _id: "wait_0099", email: "a@b.ie", routingKey: "T12", county: "Cork",
      position: 3, createdAt: new Date(),
      name: "Aoife Byrne", planInterest: "either",
    }).success
  ).toBe(true);
  expect(
    WaitlistJoinInput.safeParse({ email: "a@b.ie", eircode: "T12 AB34" }).success
  ).toBe(true); // old shape still valid
  expect(
    WaitlistJoinInput.safeParse({
      email: "a@b.ie", eircode: "D08", name: "A", planInterest: "essential",
    }).success
  ).toBe(true);
  expect(
    WaitlistJoinInput.safeParse({
      email: "a@b.ie", eircode: "D08", planInterest: "premium",
    }).success
  ).toBe(false);
});
```

**Step 2: Run to verify failure** — `npm test` → FAIL (unknown keys are stripped by default zod objects, so assert via `.parse` output containing the fields, or make the enum test the failing anchor: `planInterest: "premium"` currently *passes* because the key is stripped — write the test asserting parsed output: `expect(WaitlistJoinInput.parse({...}).planInterest).toBe("essential")` → fails now).

**Step 3: Implement** — in `models.ts`:
- `WaitlistEntrySchema`: add `name: z.string().optional(),` and `planInterest: z.enum(["essential", "performance", "either"]).optional(),`
- `WaitlistJoinInput`: same two optional fields.

In `waitlist/route.ts`:
- import `bloodTiersEnabled` from `@/lib/env`.
- the `already_eligible` 409 branch becomes: `if (result.status === "eligible" && bloodTiersEnabled()) { …409 unchanged… }` — while the tested plans aren't on sale, an eligible Dublin routing key joins the list like anyone else (they get the first booking window; EMPTY_STATES.md production note). When eligible-but-joining, use `result.county ?? "Dublin"`.
- persist `name`/`planInterest` on the inserted doc (pass-through from `parsed.data`, lowercase email unchanged).
- doc-comment the route header: same promise as the in-app waitlist — one email on area opening, founding-member pricing honoured.

**Step 4: Run tests**

```bash
npm test
```

Expected: all green (447+). The e2e `checkout.spec.ts` T12-waitlist path is unaffected (flag ON keeps the 409-on-eligible behaviour; T12 is ineligible anyway).

**Step 5: Update `docs/MOCKED_APIS.md`** waitlist section (§ where waitlist/E10 is documented): note the additive fields + flag-off eligible-join rule.

**Step 6: Commit**

```bash
git add src/lib/models.ts src/app/api/v1/waitlist/route.ts src/lib/__tests__ ../../docs/MOCKED_APIS.md
git commit -m "feat: waitlist accepts name + plan interest; eligible areas joinable while blood tiers off"
```

---

## Task 8: Pricing early-access gate (flag-OFF redesign)

When `bloodTiersEnabled()` is false (prod), `/pricing` swaps to the handoff's early-access design. Flag ON renders **byte-identical current output** (e2e pins ON). All copy verbatim from `Pricing.dc.html` (`earlyAccessMode` branches).

**Files:**
- Modify: `apps/web/src/app/pricing/page.tsx`
- Create: `apps/web/src/app/pricing/EarlyAccessSection.tsx` (client component — the form)

**Step 1: Hero subhead swap** (page.tsx lines 144–148). When `!bloodEnabled` replace the paragraph with (verbatim, `early access below` links `#early-access`):

> Billed once a year, so your tests are covered upfront. Fusion is live today; the tested plans open area by area — <a href="#early-access">early access below</a>. Cancel anytime and keep access until your year ends.

(Keep the current paragraph for `bloodEnabled`. Match the design file's exact sentence — read it from `Pricing.dc.html` line 33 before writing.)

**Step 2: Card mono-note swaps.** Essential price note (line 201–203): flag ON keeps `≈ €27/MO · FIRST KIT SHIPS TODAY`; OFF → `≈ €27/MO · FROM LAUNCH: KIT SHIPS DAY ONE`. Performance (line 254–256): ON `≈ €33/MO · BOOK YOUR NURSE TODAY`; OFF → `≈ €33/MO · FROM LAUNCH: NURSE COMES TO YOU`.

**Step 3: Card CTA swaps (the flag-OFF branches, lines 227–242 and 281–296).** Replace the "Coming soon" div + "Join the waitlist →" link with:

Essential (dark card — CTA keeps the filled bone style):
```tsx
<>
  <a
    href="#early-access"
    className="mt-[22px] block rounded-pill bg-bone-white p-[13px] text-center font-semibold text-ink no-underline"
  >
    Get early access →
  </a>
  <div className="mt-[10px] text-center font-mono text-[10px] tracking-[0.08em] text-[#E9BC85]">
    NOT ON SALE YET · DUBLIN LAUNCH SOON · NO CARD
  </div>
</>
```

Performance (light card — outline style):
```tsx
<>
  <a
    href="#early-access"
    className="mt-[22px] block rounded-pill border border-ink p-[13px] text-center font-semibold text-ink no-underline"
  >
    Get early access →
  </a>
  <div className="mt-[10px] text-center font-mono text-[10px] tracking-[0.08em] text-[#B3543A]">
    NOT ON SALE YET · DUBLIN LAUNCH SOON · NO CARD
  </div>
</>
```

(Fusion untouched — always `Start Fusion` → `/join`.)

**Step 4: Early-access section.** Directly below the plans section, above CADENCE UPGRADE, insert `{!bloodEnabled && <EarlyAccessSection />}`. Create `EarlyAccessSection.tsx` — dark two-column panel + client form. Layout/copy verbatim from `Pricing.dc.html` lines 92–146:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";

type Plan = "Essential" | "Performance" | "Either";
const PLAN_CHIPS: Plan[] = ["Essential", "Performance", "Either"];

/**
 * Early-access gate for the tested plans (EMPTY_STATES.md + Pricing.dc.html
 * earlyAccessMode). Rendered only while BLOOD_TIERS_ENABLED is off. Posts to
 * the real waitlist — same promise as the in-app waitlist: one email on area
 * opening, founding-member pricing honoured.
 */
export default function EarlyAccessSection() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [eircode, setEircode] = useState("");
  const [plan, setPlan] = useState<Plan>("Essential");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          eircode,
          name: name || undefined,
          planInterest: plan.toLowerCase() as
            | "essential"
            | "performance"
            | "either",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof body.message === "string"
            ? body.message
            : "Something went wrong — try again."
        );
        return;
      }
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  const confirm =
    plan === "Either" ? "Noted for both tested plans." : `Noted for ${plan}.`;

  return (
    <section id="early-access" className="mx-auto max-w-[1100px] scroll-mt-24 px-[22px] py-6 md:px-10">
      <div className="grid gap-10 rounded-[22px] bg-ink px-[26px] py-9 text-bone-white md:grid-cols-2 md:px-10 md:py-11">
        <div>
          <div className="mb-4 font-mono text-xs tracking-[0.14em] text-[#E9BC85]">
            EARLY ACCESS · TESTED PLANS
          </div>
          <h2 className="mb-4 mt-0 font-serif text-[clamp(28px,3.4vw,36px)] font-normal leading-[1.08] tracking-[-0.01em]">
            Kits and nurses are almost ready.
          </h2>
          <p className="mb-5 mt-0 text-[15px] leading-[1.6] text-[#CFD6CF]">
            Essential and Performance go on sale when every courier route, lab
            slot and nurse rota runs flawlessly — we&apos;d rather you wait a
            few weeks than have a kit sit in a depot. Leave your details and
            you get the first booking window when your area opens.
          </p>
          <div className="mb-5 flex flex-wrap gap-2">
            {["FIRST BOOKING WINDOW", "FOUNDING-MEMBER PRICING", "NO CARD · NO COMMITMENT"].map(
              (pill) => (
                <span
                  key={pill}
                  className="rounded-pill border border-[rgba(127,211,174,0.3)] px-3 py-[6px] font-mono text-[10px] tracking-[0.06em] text-vitality-light"
                >
                  {pill}
                </span>
              )
            )}
          </div>
          <p className="m-0 text-sm">
            Want to start today?{" "}
            <Link href="/join" className="font-semibold text-vitality-light no-underline">
              Fusion is live everywhere →
            </Link>
          </p>
        </div>

        {sent ? (
          <div className="motion-confirm self-center rounded-[18px] border border-[rgba(52,160,124,0.35)] bg-[rgba(52,160,124,0.1)] px-[30px] py-9 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-vitality text-2xl text-[#04130D]">
              ✓
            </div>
            <h3 className="mb-2 mt-0 font-serif text-[26px] font-normal">
              You&apos;re on the list.
            </h3>
            <p className="mb-4 mt-0 text-sm leading-[1.6] text-[#CFD6CF]">
              {confirm} We&apos;ll email once — with your booking window and
              founding-member pricing — the moment your area opens.
            </p>
            <div className="font-mono text-[10px] tracking-[0.08em] text-vitality-light">
              CONFIRMATION SENT · MONTHLY PROGRESS NOTES OPTIONAL
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="text-[13px] font-medium">
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Aoife Byrne"
                autoComplete="name"
                className="mt-1 w-full rounded-xl border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.06)] px-4 py-[13px] text-sm text-bone-white outline-none placeholder:text-[rgba(244,241,234,0.4)] focus:border-vitality"
              />
            </label>
            <label className="text-[13px] font-medium">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="aoife@example.ie"
                autoComplete="email"
                className="mt-1 w-full rounded-xl border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.06)] px-4 py-[13px] text-sm text-bone-white outline-none placeholder:text-[rgba(244,241,234,0.4)] focus:border-vitality"
              />
            </label>
            <label className="text-[13px] font-medium">
              Eircode{" "}
              <span className="font-normal text-[#8FA89A]">
                · routing key only — so we open your area in order of demand
              </span>
              <input
                required
                value={eircode}
                onChange={(e) => setEircode(e.target.value)}
                placeholder="D08"
                className="mt-1 w-full rounded-xl border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.06)] px-4 py-[13px] font-mono text-sm text-bone-white outline-none placeholder:text-[rgba(244,241,234,0.4)] focus:border-vitality"
              />
            </label>
            <div className="text-[13px] font-medium">
              Which plan?
              <div className="mt-2 flex flex-wrap gap-2">
                {PLAN_CHIPS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlan(p)}
                    aria-pressed={plan === p}
                    className={`rounded-pill border px-4 py-2 text-[13px] font-medium transition-colors duration-[220ms] ${
                      plan === p
                        ? "border-[rgba(52,160,124,0.7)] bg-[rgba(52,160,124,0.16)] text-vitality-light"
                        : "border-[rgba(255,255,255,0.16)] bg-transparent text-[#CFD6CF]"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            {error && (
              <p className="m-0 text-[13px] text-[#E9BC85]" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="mt-1 rounded-pill bg-vitality px-6 py-[13px] text-[15px] font-bold text-[#04130D] transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              Join the early-access list
            </button>
            <p className="m-0 text-center text-xs text-[#8FA89A]">
              One email when your area opens. Nothing else, ever.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
```

And in globals.css add the confirmation pop (from `Pricing.dc.html` head, `confirmIn`):

```css
@keyframes confirm-in {
  0% { opacity: 0; transform: scale(0.94); }
  60% { transform: scale(1.015); }
  100% { opacity: 1; transform: scale(1); }
}
.motion-confirm { animation: confirm-in 0.45s cubic-bezier(0.22, 1, 0.36, 1); }
/* add .motion-confirm to the reduced-motion animation:none list */
```

**Step 5: Verify both flag states with a prod build.** e2e first (flag ON — must be untouched):

```bash
npm run e2e
```

Expected: all green, incl. `pricing-cta.spec.ts` verbatim (Start Essential/Performance hrefs + hint lines ×2).

Then the OFF state live (isolated port, seeded :27019 DB):

```bash
npm run build
MONGODB_URI=mongodb://localhost:27019/arcaevo PORT=3210 node .next/standalone/server.js &
curl -s localhost:3210/pricing | grep -o "Get early access →" | wc -l   # → 2
curl -s localhost:3210/pricing | grep -c "NOT ON SALE YET · DUBLIN LAUNCH SOON · NO CARD"  # → 2
curl -s localhost:3210/pricing | grep -c 'id="early-access"'            # → 1
curl -s localhost:3210/pricing | grep -c "Start Fusion"                 # → 1 (never gated)
# form posts for real — eligible key joins while sales off:
curl -s -X POST localhost:3210/api/v1/waitlist -H 'content-type: application/json' \
  -d '{"email":"ea-check@test.ie","eircode":"D08","name":"EA Check","planInterest":"either"}'
# → 201 {ok:true, position:…, county:"Dublin"} — then kill the server
```

Also open http://localhost:3210/pricing in a browser side-by-side with `Pricing.dc.html` (its `earlyAccessMode` defaults ON): cards, mono notes, panel, chips, confirm state.

**Step 6: Commit**

```bash
git add src/app/pricing src/app/globals.css
git commit -m "feat: pricing early-access gate — tested plans show designed launch gate while blood tiers off"
```

---

## Task 9: Home final-CTA early-access variant

`Home.dc.html` final CTA panel (lines 190–197): when sales are off, the supporting copy changes and a secondary "Get early access" button deep-links to `/pricing#early-access`.

**Files:**
- Modify: `apps/web/src/app/page.tsx` (final CTA panel, lines ~673–697)

**Step 1: Gate.** Import `bloodTiersEnabled` from `@/lib/env`; `const bloodEnabled = bloodTiersEnabled();` in the component.

**Step 2: Swap body copy** (currently the hardcoded "Join Essential and your first kit ships today…" line — price-bearing copy stays hardcoded per the existing comment): when `!bloodEnabled` render verbatim:

> Fusion is live today from €119 a year. Tested plans open soon — join the early-access list for the first booking window.

**Step 3: Swap the second button**: flag ON keeps `{h.finalCta.helpBtn}` → `/help` as today. Flag OFF replaces it with:

```tsx
<Link
  href="/pricing#early-access"
  className="inline-block rounded-pill border border-[rgba(255,255,255,0.4)] px-8 py-[15px] text-base font-semibold text-white no-underline"
>
  Get early access
</Link>
```

(First button `{h.finalCta.plansBtn}` → `/pricing` unchanged in both states.)

**Step 4: Verify** — rebuild + curl the standalone server from Task 8 Step 5 without the flag: `curl -s localhost:3210/ | grep -c "Get early access"` → 1 and the €119 line present. With `NEXT_PUBLIC_BLOOD_TIERS_ENABLED`/`BLOOD_TIERS_ENABLED` exported true, dev server shows the current help-button variant.

**Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: home final CTA gains early-access variant while blood tiers off"
```

---

## Task 10: Production env values for Vercel

`BLOOD_TIERS_ENABLED` stays **unset** in prod — that IS the "disable the two plans that require tests" requirement (fail-safe off; flips later with no rebuild). Produce (a) a git-ignored filled env file the founder copies from, (b) a committed checklist doc.

**Files:**
- Modify: `apps/web/.env.prod` (exists, currently just a MONGODB_URI pointing at the **dev** Atlas DB — keep but flag)
- Create: `docs/VERCEL_PROD_ENV.md`

**Step 1: Confirm `.env.prod` is git-ignored** (it contains a real Atlas credential):

```bash
git check-ignore apps/web/.env.prod && echo IGNORED
```

If not ignored: add it to `apps/web/.gitignore` FIRST and verify `git status` shows nothing staged from it.

**Step 2: Generate secrets and write `apps/web/.env.prod`** (each value on the Vercel **Production** scope; preview/dev get their own). Generate with `openssl rand -hex 32` (and `openssl rand -base64 24` for the admin password); comment every line:

```bash
# Production (Vercel env → Production scope). Copy values into Vercel one by one.
# Region dub1, Root Directory = apps/web (Vercel project settings).

# ⚠️ REPLACE: this is the DEV Atlas DB — create a separate prod cluster/user+db
# (arcaevo, not arcaevo_dev) before launch:
MONGODB_URI=<existing value, kept>

SESSION_SECRET=<openssl rand -hex 32>
MFA_ENC_KEY=<openssl rand -hex 32>
CRON_SECRET=<openssl rand -hex 32>
ADMIN_EMAIL=accounts@arcaevo.com
ADMIN_PASSWORD=<openssl rand -base64 24>          # bootstrap owner; rotate after first login + MFA enrolment
ADMIN_PATH_SLUG=<openssl rand -hex 6>             # dashboard lives at /<slug>
NEXT_PUBLIC_SITE_URL=https://arcaevo.com

# Launch gate — the two tested plans (Essential/Performance) are OFF on
# purpose. Do NOT set these in prod until the lab partner + clinician are
# live; flipping them on is env-only (no rebuild; iOS reads /api/v1/config):
# BLOOD_TIERS_ENABLED=true
# NEXT_PUBLIC_BLOOD_TIERS_ENABLED=true

# Pending founder setup — leave unset until real accounts exist:
# STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY / STRIPE_WEBHOOK_SECRET  (live keys; docs/STRIPE_SETUP.md)
# EMAIL_PROVIDER=smtp + SMTP_*                                        (docs/DNS_EMAIL_AND_PREPROD.md)
# NEXT_PUBLIC_POSTHOG_KEY                                             (EU project)
# ADMIN_BOOTSTRAP_DISABLED=true                                       (set AFTER first MFA owner exists)
# Never in prod: ALLOW_DEMO_TOKEN, ALLOW_OPEN_WEBHOOKS, ALLOW_MOCK_EXTRACTION, RATE_LIMIT_DISABLED, STRIPE_FORCE_MOCK
```

**Step 3: Write `docs/VERCEL_PROD_ENV.md`** — committed, **no secret values**: a table of every var (name / Production value source / scope / status ready-vs-pending-founder), cross-referencing `docs/ENVIRONMENTS_AND_SETUP.md` env table and `docs/FOUNDER_SETUP.md`. Include the copy-in order and the two explicit decisions: blood tiers unset in prod (this task) and the Mongo prod-cluster TODO. Note `vercel.json` already declares the erasure cron (needs `CRON_SECRET`).

**Step 4: Verify no secret leaks into git**

```bash
git status --short   # .env.prod must NOT appear
npx vitest run src/lib/__tests__/env.test.ts
```

**Step 5: Commit (doc only)**

```bash
git add docs/VERCEL_PROD_ENV.md apps/web/.gitignore
git commit -m "docs: Vercel production env checklist; prod secrets generated locally (git-ignored)"
```

---

## Task 11: Full verification + docs + PR

**Step 1: Full suite (prod parity)**

```bash
cd apps/web
npx tsc --noEmit          # clean
npm test                  # all vitest green (≥450)
npm run build             # green
npm run e2e               # full Playwright suite green (54+ tests + careers spec)
```

**Step 2: Reduce Motion + Lighthouse spot-check.** With the prod server from Task 8: DevTools → emulate `prefers-reduced-motion: reduce` → Home/Pricing/Careers fully static, all content visible. Run Lighthouse (mobile) on Home + Pricing — perf/SEO/a11y must stay ≥95 (BUILD_STATE bar).

**Step 3: Update `docs/BUILD_STATE.md`** — new dated section: motion/logo/responsive/empty-state/early-access shipped for web from `design_handoff_motion_haptics/`; iOS motion+haptics from the same handoff explicitly DEFERRED (needs its own phase); env: prod values generated, blood tiers off in prod. Update `docs/MOCKED_APIS.md` if not done in Task 7.

**Step 4: Commit + PR to main** (repo convention: PR from feature branch):

```bash
git add ../../docs
git commit -m "docs: build state — motion handoff (web) + prod launch gate"
git push -u origin feat-motion-handoff
gh pr create --title "Motion/logo handoff (web), careers empty state, pricing early-access gate, prod env" --body "…summary + verification evidence…

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

**Step 5: After merge** — Vercel auto-deploys `main`. The founder then pastes `apps/web/.env.prod` values into Vercel (Production scope) per `docs/VERCEL_PROD_ENV.md` and redeploys. Prod check: `/pricing` shows Get early access on Essential/Performance, `/careers` shows the empty board, motion live, `/api/v1/config` → `{bloodTiersEnabled:false}`.
