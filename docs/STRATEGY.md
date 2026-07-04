# Arcaevo — Competitive Strategy & Product Direction

_Compiled 2026-07-04 from a verified multi-source research pass (107-agent deep-research workflow; 25 sources fetched; 22 claims survived 3-vote adversarial verification) plus a full audit of the current codebase. This doc is the strategic input for the next design/build phase. Companion docs: `BUILD_STATE.md` (build truth), `MOCKED_APIS.md` (integration status)._

---

## TL;DR

The wearables + bloods fusion thesis was validated by WHOOP and Oura launching exactly this in the US in late 2025 — but every credible player is US-only or ring-based, so **Ireland/EU is an open launch window (not a moat)**. The two most defensible things Arcaevo can build:

1. **Blood-informed recovery scoring** — near-empty white space. Only Vitara (private beta, import-only, no kits, no clinician) attempts it.
2. **A human clinician note on every panel** — the #1 verified industry pain point is uninterpreted results.

The honest gap: the app today cannot compete with a $25/yr Athlytic on recovery — it reads no workouts, active energy, or sleep stages, and insights/chat/fusion are canned demo content. The asset to build on: the **RCV verdict engine** ("is this a real change vs your own baseline"), which nobody in the consumer space has.

---

## 1. Market picture (verified findings)

### Fusion is a validated category, and the clock is running
- **WHOOP Advanced Labs** (Sept 30 2025, Quest-powered): 65–75+ biomarkers, clinician-reviewed, explicitly connects results "to your daily recovery, strain, and sleep data." $199/$349/$599 add-on atop the ~$199–359/yr membership. 350k+ waitlist signups. ([Quest newsroom](https://newsroom.questdiagnostics.com/2025-09-30-WHOOP-Launches-Clinician-Reviewed-Advanced-Labs,-Unlocking-a-Comprehensive-View-of-Human-Health), [whoop.com/advanced-labs](https://www.whoop.com/us/en/advanced-labs/))
- **Oura Health Panels** (Oct 2025, Quest-powered): 50 biomarkers, $99 one-time, fused via Oura Advisor. US-only. ([Oura blog](https://ouraring.com/blog/health-panels/))
- Both are wellness-positioned, not diagnostic — the same regulatory posture as Arcaevo.
- **The window is narrowing:** WHOOP's free global PDF bloodwork-upload (~Nov 2025) already gives EU members partial fusion, and WHOOP shipped women's hormonal insights **in Ireland** (Mar 2026). Oura says "more countries coming soon." Assume 12–24 months to establish incumbency.

### Ireland is locally uncontested
- **Randox Health** (biggest private incumbent): snapshot lab panels, 150–600+ data points, up to €2,437 top tier with GP consults — **zero wearable/Apple Health integration**; app is bookings + PDFs. ([randoxhealth.com/en-IE](https://randoxhealth.com/en-IE/))
- **LetsGetChecked**: one-off kits €89–169, no membership, no wearable, no GP loop.
- Arcaevo's €119/€329/€399 annual pricing ≈ "one to three individual tests, but continuous." Randox's top tier trains the market to expect **clinician access at premium prices** — Arcaevo can meet that at a quarter of the cost.

### The Athlytic-class benchmark (why wearable-only recovery is a losing fight)
- **Athlytic** ~$24.99/yr: daily Recovery/Exertion from a personal 60-day HRV baseline. Users benchmarking Apple Watch + Athlytic vs WHOOP (against lab-grade VO₂max/RMR/DEXA validation) concluded Athlytic **won**. Churn drivers: no workout programming, flaky overnight HRV from poor wrist contact, no Garmin/Oura/WHOOP support.
- **Bevel**: core free, Pro $5.99/mo — Recovery, Cardio Load, a well-regarded Strength Builder (muscular load), conversational assistant. Wearable-only, no blood input.
- **Gentler Streak**: ~$9/mo, numbers-free positioning that actively repels metrics-oriented users.
- Consequence: **the Fusion tier (€119/yr) must be sold as "your bloodwork finally means something" (upload + RCV verdicts + timeline), never as "another recovery app."**

### The verified #1 pain point: uninterpreted results
[NPR (Apr 2026)](https://www.npr.org/2026/04/14/nx-s1-5780066/oura-function-wearables-blood-testing-bloodwork): an Oura customer's $99 panel "didn't come with any explanation… turned to Google"; "most patients will never hear from the clinicians who interpreted their results." Oura's clinician review touches critical values only. This is the acute, ownable gap.

### Retention economics
- Oura first-year retention **>80%** (category benchmark); stated driver = feature velocity (14 features/yr) and moving **from measurement to intervention** — measurement-only scores lose value over time.
- Premium-annual pricing supported: high-priced annual Health & Fitness plans ≈ **4x the LTV** of low-priced plans (Adapty, correlational; the only benchmark source that survived verification — treat category churn figures as directional).
- Free trials: 42.2% trial-to-paid conversion; trial users retain 8–60% better at first renewal.
- Anti-pattern: Superpower's supplement upsells push effective spend to $3,500–5,000/yr — a documented trust-killer. **No supplement upsells, ever.** The recheck kit (€69) is the honest monetization loop.

---

## 2. Codebase reality check (audit 2026-07-03)

| Genuinely strong (lean on these) | Missing / demo-only (fix before claiming) |
|---|---|
| RCV verdict engine (`apps/web/src/lib/rcv.ts`) — statistically grounded per-marker "real change" verdicts | No workout / steps / active-energy HealthKit ingestion at all (onboarding copy claims "Workouts" — integrity + App Review risk) |
| 15-marker panel with per-marker RCV thresholds + beneficial direction (`seed.ts`) | Only 4 metrics ingested: HRV, RHR, sleep *hours*, VO₂max — no sleep stages, temperature, respiratory rate, cycle data |
| Fusion-timeline concept; hollow-gold self-reported honesty | No recovery/strain/training-load score — the single score is a deterministic baseline index (`Readiness.score`) |
| GP-share with clinician summary + revocable links | Insights = 3 hard-coded cards; Ask Arcaevo = keyword-matched canned narrator; fusion chart = hand-placed demo points |
| Experiments loop with honest verdicts ("within the noise") | No watch complication (in-app stand-in); notification toggles exist but no scheduler |

---

## 3. Ranked opportunities

### #1 Blood-informed recovery score — THE moat feature
White space confirmed: only [Vitara](https://getvitara.health/) (private beta, iOS-first, no bundled kits, no clinician review) attempts biomarker-modified training guidance (e.g. "ferritin 28 → reduced eccentric volume"). Arcaevo already stocks the recovery-relevant markers **ferritin, hs-CRP, vitamin D, TSH, cortisol** with RCV thresholds.

Product shape:
- Daily recovery score at Athlytic parity (HRV/RHR/sleep-stages vs personal baseline) **plus blood modifiers**: low ferritin caps the ceiling; elevated hs-CRP flags inflammation-adjusted readiness — with a plain-language "why": _"Recovery 62% — capped by low ferritin. Recheck in 6 weeks."_
- Positioning line: **"WHOOP tells you you're run down. Arcaevo tells you why — and proves it in your blood."**
- Regulatory: stay blood-*informed*, never training *prescription*; wellness language throughout (MDCG June 2025 guidance confirms health apps are in MDR/IVDR scope — the locked wellness posture is correct).
- Prereqs: workouts + active energy + sleep-stage ingestion; wearable-only score credible first; WidgetKit complication ships with it.

### #2 Clinician note on EVERY panel
Extend the Dr.-Nolan review flow from critical-values-only to a short human-written note on every panel. Flagship promise of the €329/€399 tiers. Operationally scalable (2 panels/yr, 15 markers, template-assisted). Directly answers the NPR-verified pain point; no US player does it.

### #3 Close the experiment→recheck retention loop
Insight → suggested experiment → watch adherence logging → **recheck kit (€69)** → RCV verdict "it worked / within the noise." The verdict moment justifies year-two renewal, and Athlytic-class apps can't close this loop (no bloods). Requires: real generated insights from the RCV engine, notification scheduler, experiment-aware recheck ordering.

### #4 Women's health — ELEVATED (user decision 2026-07-04): cycle-aware from day one, hormone panels to follow
Oura is moving fast (women's-health AI model Feb 2026; Midi/Evernow/Maven/Progyny partnerships; WHOOP hormonal insights live in Ireland). Split the play in two:
- **Now (pure iOS/HealthKit, near-zero marginal cost):** cycle-aware baselines. Menstrual-cycle data already lives in HealthKit (`menstrualFlow` + cycle-tracking categories, wrist temperature on Watch S8+). HRV/RHR/temperature shift predictably across the cycle — a baseline model that ignores this produces false "you're run down" alarms in the luteal phase (a known wearable complaint). Phase-aware baseline bands = an honest-recovery differentiator vs Athlytic/Bevel, which are cycle-blind, and it lands inside the pre-launch HealthKit expansion (§5).
- **Later (needs lab ops):** perimenopause/hormone **panels** + clinician review — what rings can't do. Ferritin/iron focus for women athletes (disproportionately relevant, almost never surfaced by wearable-only apps). Candidate tier/add-on: "Her Baseline."

### #5 The Irish GP loop as local moat
Deepen GP-share: referral-grade printable summaries, eventually Healthmail delivery. "Your GP can actually use this" is a trust wedge no US entrant will build for years.

(#6 Corporate wellness = future channel; Randox's B2B model proves Irish demand exists.)

---

## 4. Threats

1. **WHOOP EU rollout** ("global rollout to follow"; UAE live; free PDF-upload fusion already in Irish users' hands). Speed > polish.
2. **Oura's women's-health machine** closes opportunity #4 if we wait.
3. **EU MDR/IVDR scope** — keep wellness framing ironclad; softer than Vitara's guideline-traceability approach.
4. **Fusion tier vs $25/yr Athlytic** — value must be bloods+RCV, not the score alone.

---

## 5. Build sequence (input for next design phase)

**Scope decision (user, 2026-07-04): iOS + watchOS only for the next phase.** Web/backend changes only where the iOS features need an API (recovery-score persistence, cycle-phase-aware baselines in insights). No new web surfaces.

### Phase A — pre-launch credibility (iOS/watchOS) — EXPANDED SPEC

**A1. HealthKit expansion** (all read-only, primer-before-sheet per locked design; every new type honestly listed in the primer — this also fixes the current "Workouts" copy claim that reads nothing):

| Signal | HealthKit type | Feeds |
|---|---|---|
| Workouts (type, duration, avg/max HR, energy) | `HKWorkoutType` + `heartRate` samples per workout | Exertion/training-load score; experiment adherence (real, not demo) |
| Active energy | `activeEnergyBurned` | Daily exertion; non-workout activity |
| Steps | `stepCount` | Low-intensity load; "evening walks" experiment verification |
| Sleep **stages** (core/deep/REM/awake) | `sleepAnalysis` category values (stage-level, not just asleep-hours) | Recovery score; real "deep sleep dropped 31 min" insights (currently canned copy) |
| Respiratory rate | `respiratoryRate` | Recovery modifiers; illness-onset deviation |
| Blood oxygen | `oxygenSaturation` | Recovery context (deviation from baseline) |
| Sleeping wrist temperature | `appleSleepingWristTemperature` (Watch S8+, graceful absence) | Cycle-phase model; illness deviation |
| Heart-rate recovery | `heartRateRecoveryOneMinute` | Fitness/readiness trend alongside VO₂max |
| Cycle tracking | `menstrualFlow` + cycle-tracking category types (opt-in, only if user tracks) | Cycle-aware baselines (§3 #4); phase-tagged wearable signals |

Data notes: extend `WearableMetric`/`WearableSignal` (iOS) + `WearableSignalType` (`apps/web/src/lib/models.ts`) for the new series; workouts likely need their own model (per-session, not daily-point). Keep 90-day local series; sync daily aggregates only (GDPR-minimal). Menstrual data is Art. 9 — flows under the existing `health_processing` consent; never synced unless cycle-aware baselines are enabled.

**A2. Recovery score v1 (wearable-only, Athlytic parity, honest):**
- Inputs: overnight HRV vs personal 60-day baseline (primary), RHR delta, sleep-stage quality, respiratory-rate/temperature deviation, yesterday's exertion.
- Personal-baseline-relative, banded (like RCV philosophy): show "in your band / below your band," never false precision. Keep the calm no-red-numbers tone — amber at worst.
- **Cycle-aware baselines** when cycle data exists: baseline bands computed per cycle phase so luteal-phase HRV dips don't false-alarm. This is the women's-health wedge (§3 #4) and no Athlytic-class app does it.
- Separate **Exertion/Load** number from workouts + active energy (Athlytic's Recovery/Exertion split; Bevel's strength-load praise says include resistance-training load, not just cardio).
- Replaces the current `Readiness.score` stub; the Today ring + watch baseline ring re-point at it.

**A3. Watch surfaces:**
- WidgetKit accessory complication (corner + circular + rectangular): recovery band + next-test countdown. Requires the widget-extension target in `project.yml` (currently deferred).
- Watch app: recovery band replaces the demo ring; quick-log tags feed the score's context (alcohol/late-meal annotations on tomorrow's dip).

**A4. Insights engine (replace the 3 canned cards):**
- Rule-generated from real data: RCV verdicts (blood), baseline deviations (wearables), experiment progress. Deterministic rules decide; AI narrates (per locked posture). Server-side generation in `apps/web/src/lib` (insights API already exists; it's the content that's canned).
- Notification scheduler behind the existing prefs toggles (weekly focus, results-ready) — content exists, triggers don't.

**A5. Honesty fixes (cheap, do first):** onboarding primer lists exactly what we read; remove "Workouts" until A1 lands or ship A1 first.

### Phase B — differentiation (iOS-first, minimal API additions)
- **Blood modifiers on the recovery score**: ferritin/hs-CRP/vitamin-D/cortisol caps with plain-language why ("Recovery 62% — capped by low ferritin. Recheck in 6 weeks"). Blood-informed, never prescriptive.
- **Clinician note on every panel** (admin workflow + iOS Results surfaces).
- **Experiment→recheck loop** wired to real verdicts + adherence from real workout/step data.

### Phase C — expansion (6–12 months)
- Perimenopause/hormone panel ("Her Baseline") + clinician review
- Garmin/WHOOP import (roadmap slots already in ConnectedSources UI)
- Corporate wellness channel

---

## Evidence caveats

Retention numbers are the thinnest area (one vendor benchmark survived; a widely-quoted renewal-decay stat was refuted in verification). Vitara/Ultrahuman fusion depth is marketing-described, not independently verified. US pricing is indicative, not same-market. Biomarker→recovery mappings (ferritin/CRP thresholds) are asserted by Vitara, not independently validated as clinically sound — our clinician review step is also the safety net here.
