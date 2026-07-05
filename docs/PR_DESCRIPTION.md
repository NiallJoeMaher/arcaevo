# PR: Phase 22 daily-engagement + production-readiness (branch `phase-22-daily-engagement`)

_Ready-to-paste PR description for the branch. 21 commits. Verified end-to-end 2026-07-05: web tsc clean + 287 vitest; iOS app scheme BUILD SUCCEEDED (app + watch + 2 widget extensions); 48 engine XCTests pass. Three security reviews passed (branch / admin auth / MFA), findings fixed._

## What this delivers

The **daily-engagement layer** (the design handoff) — blood biomarkers feed the Readiness/Energy/Vitality **scores themselves**, not just an AI comment beside them — plus the production-readiness work to take the basic (Fusion) tier toward a real internal beta.

## Areas (mapped to commits)

**Feature — Phase 22 daily-engagement (`27a2f86`)**
- Engines (ArcaevoKit, pure/deterministic): Readiness (blood penalties + decay + band + decision + degraded states, floor 55), Energy (blood-modulated ceiling + dip forecast), Vitality (RCV-gated), BiomarkerPenalty, BehaviourImpact, WakeTime, CycleBaselines.
- HealthKit expanded (workouts, active energy, steps, sleep stages, respiratory rate, SpO₂, wrist temp; cycle data opt-in/off by default, Art. 9).
- iOS screens: Readiness (71→62 blood-layer toggle), Energy, Check-in + behaviour impacts + sick mode, Vitality + €69 recheck, widgets gallery; changed HealthKit primer, 8-toggle notifications, cycle privacy toggle, clinician note on Results, 12-push notification layer.
- Watch: readiness/energy/check-in/vitality/live-workout + the real WidgetKit complications + iOS Lock Screen widgets (App Group snapshot); web: signed clinician note on every reviewed panel.

**Production hardening (`160bf83`)** — GDPR erasure cron (`CRON_SECRET`, fail-closed), IP rate-limiting on the auth endpoints, non-fabricating bloodwork uploads in prod.

**Payments — Stripe (`0b23f09`, `59282ac`, `aa363e6`, `29d4232`)** — real test-mode Checkout Sessions (subscriptions + add-ons), REST + `node:crypto` webhook signature verification, Customer Portal, 8 prices created, Stripe Tax, payment-settled activation guard, portal is member-auth (cancelling never blocked by health consent).

**Email (`d1638dc`)** — optional SMTP auth + TLS → EU ESP is a config change.

**Admin auth (`9eb988a`, `1109338`, `0604c91`)** — per-admin accounts (scrypt), roles (owner/ops/clinician), Art. 9 access log, **immediate session revocation on disable**, owner-only management UI + access-log viewer.

**Admin MFA (`0914cf3`)** — TOTP 2FA + single-use backup codes, AES-256-GCM secrets at rest, two-step login, opt-in (default off).

**Legal (`a581052`)** — `docs/legal/`: DPIA, Records of Processing, sub-processor/DPA register, retention schedule, breach runbook, admin-auth options (all DRAFT, for DPO/solicitor).

**Tests + docs (`85b78bb`, `8778279`, docs commits)** — 48-test XCTest engine regression suite (confirms no engine bugs, RCV web-parity); `.env.example` tracked + complete; `STRATEGY.md`, `LAUNCH_READINESS.md`, `DEVICE_TESTING_AND_RELEASE.md`, `STRIPE_SETUP.md`, `GO_LIVE_RUNBOOK.md`, `MORNING_BRIEF_2026-07-05.md`.

## Safety posture
Wellness-not-diagnosis throughout; blood adjusts the score + its band, never a diagnosis/prescription; flagged/critical values leave the engine to the clinician-first flow; results never in a push/email payload; amber at worst. All mock/demo bypasses are gated OFF in production.

## Not in this PR (needs founder input before real users)
EU email provider creds · Stripe live keys + webhook secret · legal entity/DPO/DPAs · named IMC clinician + lab partner (paid tiers only) · admin MFA-mandatory policy. See `docs/GO_LIVE_RUNBOOK.md`.

## Reviewer notes
- Consider splitting into stacked PRs by area (daily-engagement / payments / hardening / admin-auth / legal) if a 21-commit review is unwieldy — the commits are cleanly scoped.
- `Arcaevo.xcodeproj` is gitignored (XcodeGen) — run `cd apps/ios && xcodegen generate` to regenerate before building.
