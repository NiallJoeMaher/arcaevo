# Responsive layout — Arcaevo marketing site

Desktop styling stays inline on the elements; **`site-mobile.css`** holds the only media
query (≤760px) and every page links it. The system is deliberately tiny:

- `data-m="stack"` — any multi-column grid collapses to one column (child `span`s reset;
  sticky sidebars go static). Applied to heroes, bentos, card grids, 2-col explainers.
- `data-m="stack2"` — 4-up strips (About stats, Careers perks, Pricing market scan)
  become 2×2.
- `data-m="scroll"` — comparison tables (Pricing plan compare, Versus at-a-glance) scroll
  horizontally with rows keeping a 600px min-width, instead of crushing columns.
- `data-mpad` — non-`<section>` page wrappers that need the 22px mobile gutter
  (all `<section>`s get it automatically).
- `h1` clamps to 34–42px on mobile.

**Nav (`SiteNav.dc.html`):** under 760px the wordmark disappears (mark only — per logo
rules), the "Start membership" pill compacts, and the page links become a horizontally
scrollable second row under the logo. No hamburger, no JS.

Production note: in Next.js, reproduce these as ordinary media queries / Tailwind
breakpoints — the `data-m` markers show exactly which grids collapse and how. Keep
hit targets ≥44px and the mark-only nav rule.
