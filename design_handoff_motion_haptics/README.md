# Handoff: Motion, Haptics & Logo Usage — July 2026 update

**What this is:** the premium-motion layer for Arcaevo, applied across the iOS/watchOS
prototype and every public marketing page, plus the haptic map and logo-usage rules.
This package is a **delta on top of** `design_handoff_ios_watch/` (SwiftUI apps) and
`design_handoff_arcaevo_site/` (Next.js site) — read those first for scope, business rules
and fidelity; read this one for how things *move* and *buzz*.

## About the design files

Everything in `designs/` is an HTML **design reference** (open any `.dc.html` in a browser;
`support.js` and `site-motion.js` must sit beside them). Not production code — recreate in
SwiftUI (app) / Next.js (site). The animations in the prototypes ARE the spec: durations,
easings and delays are written inline on the animated elements, so every value can be read
off the source.

## What changed

**iOS + watchOS (`designs/Prototype.dc.html`, all 42 screens)**
- Screen-entry rise (450ms), rings that draw in, charts that trace, bars that grow,
  spring toggles, cross-fading chips, "✓ confirmed" pops, chat-bubble entrances.
- The Readiness blood-layer toggle now animates ring, colour and a live 71⇄62 count.
- **◉ HAPTIC chips** flash under the device at every moment a real device would buzz —
  each label maps to an exact `UIFeedbackGenerator` / `WKHaptic` call (table in
  `MOTION_HAPTICS.md`). The chip itself is a prototyping affordance: do not build it.

**Marketing site (all public pages)**
- Shared `site-motion.js`: scroll-reveal (`data-reveal`, optional `data-reveal-delay`),
  SVG line draw (`data-draw`), above-the-fold left static so nothing flashes.
- Home/App heroes: settle-in + score-ring draw + chart trace on load; pricing-card hover lift.
- Legal keeps a static body deliberately; Admin/Handover (internal) have no motion.
- Full system + restraint list in `MOTION.md`.

**Logo usage** (both `MOTION_HAPTICS.md` and `MOTION.md`, bottom sections)
- Mark = the two-stroke "A" arc; single colour: `#1E5C45` on light, `#7FD3AE` on dark.
- iOS/watch surfaces: **mark only**, never the wordmark inside app screens.
- Site nav **< 640px: drop the wordmark, keep the mark only** (≥44px hit area).
- Minimum mark width 16px, clear space one mark-width, never stretched, **never animated**.

## Non-negotiables

- Every animation ships behind Reduce Motion (`prefers-reduced-motion` in the prototypes;
  `UIAccessibility.isReduceMotionEnabled` / SwiftUI equivalents in production).
- One haptic per user action; success haptics only for completed intents; nothing buzzes
  on scroll, navigation, or the critical-value flow.
- Nothing loops, nothing exceeds 1.3s, stagger max ~180ms.

## Files

| File | Purpose |
|---|---|
| `MOTION_HAPTICS.md` | App motion spec (SwiftUI equivalents), full haptic map, logo rules |
| `MOTION.md` | Site motion system, rollout recipe, restraint list, logo rules |
| `RESPONSIVE.md` | Mobile layout system (`site-mobile.css` + `data-m` markers, mark-only nav) |
| `EMPTY_STATES.md` | Day-one / no-data states (app + site) and the early-access launch gate on Pricing |
| `designs/Prototype.dc.html` | 42-screen iOS + Watch prototype with the motion layer live |
| `designs/Home.dc.html` … `Legal.dc.html` | All public site pages with motion applied |
| `designs/site-motion.js` | The site's shared reveal/draw script (reference implementation) |
| `designs/SiteNav / SiteFooter` | Shared chrome the pages import |
| `designs/support.js` | Prototype runtime — browser preview only, not part of any app |
| `PROMPT.md` | Paste-ready brief for Claude Code |
