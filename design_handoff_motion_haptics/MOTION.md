# Motion — Arcaevo marketing site

The site now ships a shared motion layer: `site-motion.js` (loaded from each page's head) plus
a few inline load animations. Tone: quiet editorial confidence — things settle into place;
nothing slides across the screen, nothing loops, nothing exceeds 1.3s. Apple-Health calm.
All motion respects `prefers-reduced-motion` (the script no-ops, the CSS keyframes are disabled).

## The system

1. **Hero (above the fold, on load):** text column rises 14px + fades over 0.7s
   `cubic-bezier(0.22,1,0.36,1)`; the product card follows 120ms later. The health-score ring
   draws from 0 over 1.3s (`stroke-dashoffset`), starting at ~0.45s. Charts inside hero mocks
   draw left→right (1.2s, delayed until the card has landed).
2. **Scroll reveal (below the fold):** any element marked `data-reveal` starts at
   `opacity:0; translateY(16px)` and settles over 0.75s when it enters the viewport
   (IntersectionObserver, −7% bottom margin). Optional `data-reveal-delay="90"` staggers
   siblings (90ms steps, max 2 steps — more feels theatrical). Elements already visible on
   first paint stay static: the page never flashes.
3. **Chart draw on reveal:** `data-draw` on an SVG polyline/path draws the line in (1.2s)
   when scrolled into view.
4. **Hover:** links keep the existing 0.15s opacity fade. Pricing cards lift −4px with a
   deepened shadow over 0.3s. Nothing else moves on hover.

Applied to all public pages: Home, App, Pricing, HowItWorks, Science, Compare, Versus,
Blog, Article, About, Careers, Help, Contact (Legal loads the script but keeps its document
body static — legal reads as trust, not theatre). Admin and Handover are internal tools and
stay motion-free on purpose.

## Rolling it out further

Per page: add `<script src="./site-motion.js"></script>` to the head, then mark section
headings, card grids and CTA blocks with `data-reveal` (stagger only within one row). Keep
hero load animations to two elements max.

Restraint list — never: parallax, marquee/auto-scroll, animated numbers outside product mocks,
background gradient motion, animating the logo.

## Logo usage

The mark is the two-stroke "A" arc (`uploads/arc-svg.svg`, viewBox 643×495 — never stretch,
never redraw). Single colour via `currentColor`:

- **On light backgrounds:** Forest `#1E5C45`. **On dark (Ink `#1C2620`):** bright green `#7FD3AE`. Never gradients, never other colours.
- **Nav lockup (desktop):** mark 22×17px + wordmark "Arcaevo" Hanken Grotesk 600 / 19px / −0.01em, 11px gap (as in `SiteNav.dc.html`).
- **Mobile nav (< 640px):** drop the wordmark, keep the **mark only** — do not shrink the lockup. The mark alone is the tap target back to Home (≥44px hit area).
- **Footer:** full lockup allowed; mono caption lines (e.g. `PROTOTYPE`, `HEALTH, ILLUMINATED`) are labels, not part of the lockup.
- **Minimum mark width:** 16px. **Clear space:** one mark-width on all sides; never over photography or busy fills.
- The logo itself is never animated — it's the one permanently still element on every page.
