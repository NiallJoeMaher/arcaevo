# Prompt for Claude Code

Copy-paste the brief below (adjust repo paths as needed).

---

You are implementing the **motion, haptics and logo-usage layer** for Arcaevo, a
personalised health platform for Ireland (iOS + Apple Watch app in SwiftUI; marketing
site in Next.js). The design package sits in `design_handoff_2026-07-06_motion_haptics/`.

Read in this order:
1. `README.md` — scope and non-negotiables.
2. `MOTION_HAPTICS.md` — the app: every animated moment with its SwiftUI equivalent
   (durations, easings, delays), and the complete haptic map (prototype label →
   `UIFeedbackGenerator` / `WKHaptic` call). Logo rules at the bottom.
3. `MOTION.md` — the site: scroll-reveal system, hero load animations, hover states,
   restraint list. Logo rules at the bottom.
4. Open `designs/Prototype.dc.html` in a browser (keep `support.js` beside it) and click
   through — every animation you see is the spec, and a green **◉ HAPTIC** chip flashes
   under the device at each moment a real device must buzz. The chip is an annotation,
   not UI to build.
5. Open `designs/Home.dc.html` and `designs/App.dc.html` for the site's reference
   implementation (`site-motion.js` drives `data-reveal` / `data-draw`).

Rules that must survive implementation:
- All motion behind Reduce Motion checks. Nothing loops; nothing exceeds 1.3s.
- Exact values: read durations/easings inline off the prototype elements — do not invent.
- Haptics: one per user action, on state change only; success types only for completed
  intents (saved / booked / started); never on scroll or navigation; the critical-value
  flow is silent and static.
- Readiness blood-layer toggle: ring trim + colour animate 0.7s and the score **counts**
  71⇄62 (`contentTransition(.numericText())` or equivalent).
- Site: reveal below-the-fold only (no first-paint flash), stagger ≤180ms, pricing-card
  hover lift −4px, Legal body static, no motion in Admin.
- Logo: single-colour mark (`#1E5C45` light / `#7FD3AE` dark); mark-only inside app
  screens and in the site nav under 640px; never stretched, never animated.

Definition of done: side-by-side with the prototypes, an experienced designer cannot tell
which is which — including how things move, and the device buzzing exactly where the
◉ HAPTIC chips flash.
