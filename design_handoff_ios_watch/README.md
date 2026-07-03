# Handoff: Arcaevo iOS + Apple Watch apps

Personalised health platform for Ireland (blood testing + Apple Watch fusion, Dublin-first launch).
This package is the **iOS + watchOS handoff**: a 42-screen high-fidelity clickable prototype covering the entire journey — first open → onboarding → purchase → testing → member app core → data management → account → the 6-screen Apple Watch companion app.

## About the design files

`designs/Prototype.dc.html` is a **design reference built in HTML** — open it in a browser (keep `support.js` beside it). It is a prototype showing intended look and behaviour, **not production code**. The task is to recreate these screens **in SwiftUI (iOS) and SwiftUI-for-watchOS**, using native platform patterns (navigation stacks, sheets, HealthKit permission sheets, SF-native haptics) while matching the visual design pixel-faithfully.

Every style is inline in the markup — every hex value, radius, font size and spacing is readable directly on each element. The left rail in the prototype jumps to any screen; the rail is a prototyping affordance only, not part of the app.

## Fidelity

**High-fidelity.** Colors, typography, spacing, copy, and interaction states are final. Recreate pixel-perfectly; all copy in the prototype is the intended production copy.

## Screen map (42 screens, 8 groups)

The prototype rail lists these in order; each is a `data-screen-label` section in the file.

```
ONBOARDING   welcome · signup · verify (magic link) · consent (GDPR Art. 9) ·
             healthkit (primer-before-sheet) · about-you · notifications
FREE TIER    home (free-tier dashboard) · plans
PURCHASE     gate (Eircode check) · waitlist (early access) · checkout (links out to web) · success
TESTING      activate kit · nurse booking · sample journey · critical value
MEMBER APP   dashboard · fusion timeline · results · marker detail (ApoB) ·
             insights · experiments · start experiment · "did it work?" verdict · ask Arcaevo (chat)
YOUR DATA    add bloodwork (upload) · confirm reading (AI extraction) · type values by hand ·
             timeline · share with GP
ACCOUNT      account hub · sign-in & security · data & privacy · delete account ·
             invite someone · connected sources
APPLE WATCH  watch face (complication) · today — baseline · biomarker glance ·
             quick-log · active experiment · result ready
```

## Design tokens

Typography (Google Fonts):
- Display: **Instrument Serif** — screen titles 24–40px, line-height 1.05–1.15, letter-spacing −0.015em
- Body/UI: **Hanken Grotesk** — 12.5–14px body, 600–700 weights for buttons
- Labels/data: **Geist Mono** — 9.5–11px, letter-spacing 0.05–0.14em, uppercase eyebrows

Colors:
- `#1C2620` dark surface (member app, watch, timeline screens)
- `#F4F1EA` cream (light screens background / dark-screen text)
- `#34A07C` primary green (accents, toggles-on, positive)
- `#1E5C45` deep green (eyebrow labels, primary buttons on light)
- `#7FD3AE` bright green (active states on dark)
- `#8FA89A` muted green-grey (secondary text on dark)
- `#7C887F` / `#4A554D` secondary text on light
- `#CFD6CF` / `#5E6E64` rail text tones
- Self-reported data points: **hollow gold dots** (visually distinct from lab values)

Shape: pill chips `border-radius:100px`; cards 16px radius; toggles 40×22 with 18px knob.

## Interactions & state (prototype logic ≈ app state)

The prototype's logic class models the intended app state — read it as a state spec:
- `plan`: fusion (€119/yr) / essential (€329/yr) / performance (€399/yr) — plan drives the post-purchase "step 1" card and CTA routing (upload vs activate vs nurse booking)
- Eircode gate: `code` null / dublin (pass) / cork (fail → waitlist + Fusion cross-sell)
- Notification prefs (4 toggles incl. Face ID lock, on by default)
- Fusion timeline: marker × wearable-signal pickers + scrubbable points
- Experiments: pick what/duration/watched-marker → start → adherence → verdict
- Upload: AI-extracted values must each be confirmed; low-confidence blocks until resolved
- Watch quick-log (`wlogged` per item) and experiment log with haptic-style confirm

## Non-negotiable business rules encoded in the designs

- **Auth**: email + magic link only; universal links open the app. No social sign-in / Sign in with Apple at launch. HealthKit is a device permission, independent of auth.
- **Payments**: always link out to web checkout (Stripe + Apple Pay on web). **No IAP.**
- **Consent**: GDPR Art. 9 — separate screen, 3 purposes, research off by default, versioned, revocable in Account.
- **Results never in email or push.** Critical values: clinician phones first — the app shows "Dr. Nolan would like a word first", never a red number.
- HealthKit is **read-only**; primer screen shown before the system sheet.
- Delete account is honest and completable in-app; export offered first, nothing dark-patterned.
- Wellness positioning, never diagnosis. AI is called "AI"; it narrates, deterministic rules decide.

## Watch app notes

- Complication/watch-face entry → Today (readiness vs baseline) → glanceable biomarker → quick-log → active experiment check-in → "result ready" notification screen.
- Watch shows status and deltas, never raw alarming values; result-ready pushes the user to the phone.
- All hit targets ≥ 44px equivalent; Geist Mono data + Hanken Grotesk labels carry over.

## Assets

No raster assets. The identity mark is a radial-gradient circle (`radial-gradient(circle at 32% 30%, #5FB592, #1E5C45 70%)`). Fonts load from Google Fonts.

## Files

| File | Purpose |
|---|---|
| `designs/Prototype.dc.html` | The 42-screen clickable prototype (all iOS + Watch screens) |
| `designs/support.js` | Runtime the prototype needs to open in a browser — not part of the app |
| `PROMPT.md` | Paste-ready brief for Claude Code |

Related: the broader `arcaevo_design_handoff/` package (marketing site + web account flows + full business-rule spec in AccountFlows) if server/web context is needed.
