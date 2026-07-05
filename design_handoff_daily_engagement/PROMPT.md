# Prompt for Claude Code — Arcaevo iOS + Apple Watch apps

Paste this alongside the `design_handoff_ios_watch/` folder.

---

You are implementing the **Arcaevo iOS app and its Apple Watch companion** in **SwiftUI** (iOS 17+, watchOS 10+).

`designs/Prototype.dc.html` is a 42-screen high-fidelity clickable prototype — open it in a browser with `support.js` beside it and click through; the left rail jumps to any screen (the rail itself is not part of the app). **It is a design reference, not production code**: recreate every screen pixel-faithfully in SwiftUI, using native navigation, sheets, and the real HealthKit permission flow. All styling is inline in the markup — read exact hex values, sizes and spacing from the elements.

Read `README.md` first: screen map (8 groups), design tokens, state spec, and the non-negotiable business rules. Then read **`ALGORITHM.md`** for the daily-engagement engine — the blood-recalibrated Readiness score, the all-day Energy gauge, the morning felt check-in, the widgets/complications/Live-Activity surface, and the notification triggers. That engine (blood recalibrates the *score itself*, not just an AI comment beside it) is Arcaevo's defensible differentiator — build it exactly.

## Scope
1. **iOS app** — 36 screens: onboarding (magic-link auth, GDPR consent, HealthKit primer), free tier, purchase (Eircode gate → web checkout link-out), testing (kit activation, nurse booking, sample journey, critical-value flow), member core (dashboard, fusion timeline, results, marker detail, insights, experiments, chat), data (upload + AI-extraction confirm + manual entry, timeline, GP share), account (security, privacy, delete, invite, connections).
2. **watchOS app** — complication/face entry (readiness), today-vs-baseline readiness, all-day energy gauge, felt check-in, biomarker glance, quick-log, active experiment check-in, result-ready. Plus Lock Screen widgets, Smart Stack Live Activity (morning readiness at the learned wake time via the Relevance API), and complications across every face family. Shares data with iOS via the same backend + HealthKit; keep every surface a sub-10-second glance; never shows raw alarming values.

## Hard rules (encoded in the designs — do not deviate)
- Email + magic-link auth only (universal links). No Sign in with Apple at launch. HealthKit permission is independent of auth.
- **No IAP** — every payment CTA opens web checkout in Safari.
- HealthKit read-only; always show the primer screen before the system sheet.
- Results never in push/email payloads; critical values route through "clinician phones first."
- Consent: separate screen, 3 purposes, research off by default, versioned grants, revocable.
- Self-reported bloodwork stays visually distinct (hollow gold dots); every AI-extracted value requires user confirmation.
- Wellness positioning, never diagnosis; AI narrates, deterministic rules decide.

## Typography & color
Instrument Serif (display), Hanken Grotesk (body/UI), Geist Mono (labels/data) — bundle the font files. Core palette: `#1C2620`, `#F4F1EA`, `#34A07C`, `#1E5C45`, `#7FD3AE`, `#8FA89A`. Dark surfaces for the member app + watch; cream for onboarding/commerce.

## Entities (shared with the web platform)
User, Consent, Membership, TestOrder (status timeline), BiomarkerReading (source: lab | self_reported), BiomarkerRule, WearableSignal, Experiment (adherence from HealthKit), WaitlistEntry, GiftCode, ReferralCode, ShareLink. Plus the daily-engagement entities in `ALGORITHM.md` §10: ReadinessScore, EnergySample, FeltCheckin, BehaviourImpact, BiomarkerPenalty, NotificationPref, WakeTimeModel, VitalityScore, CyclePhaseBaseline, ClinicianNote, RecheckOrder.
