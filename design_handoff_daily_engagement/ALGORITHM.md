# Arcaevo — Readiness, Energy & Notification engine spec

Implementation spec for the daily-engagement layer added in the July 2026 design update.
Pairs with `README.md` (screen map + business rules) and `PROMPT.md` (build brief).

The new screens this document backs:
`readiness` · `energy` · `checkin` (morning felt check-in) · `widgets` (Lock Screen / Smart Stack / complications) · plus watch `wtoday` (readiness), `wenergy`, `wcheckin`, and the expanded `notify` prefs.

**Positioning first.** Arcaevo's defensible position is the *fusion*: blood is **the why**, wearables are **the what**, experiments are the bridge. Every competitor (WHOOP Advanced Labs, Oura Health Panels, Ultrahuman Blood Vision) displays blood *beside* the recovery score and lets an AI comment; **none feed blood biomarkers into the readiness algorithm itself.** Arcaevo does. That is the whole point of this engine — protect it in the maths, the copy, and the PR.

**Wellness, not diagnosis.** Everything below is a *wellness readiness* signal. Blood modulates the personal *baseline and confidence band* of a wellness score; it never produces a clinical interpretation on the daily surface. Critical/flagged values never enter this engine — they route to the clinician-first flow (`critical`). Keep that line watertight, especially under EU/Irish rules.

---

## 1. Readiness score (flagship daily hook)

A single glanceable 0–100 score, colour-coded, **locked at wake** and not recomputed through the day (cache one sleep-derived RHR so it doesn't drift). Every score ends in a **decision**: `Train hard` / `Train as planned` / `Go easy` / `Rest`, plus a one-line *why*.

### 1.1 Inputs
| Input | Source | Role |
|---|---|---|
| Overnight HRV (RMSSD) | HealthKit, sleeping window | primary acute driver |
| Resting HR | HealthKit, sleep-derived | primary acute driver |
| Respiratory rate, wrist temp, SpO2 | HealthKit | out-of-range illness flag; widen band |
| Sleep duration/stages | HealthKit | **shown, not folded into the core score** (see 1.4) |
| Blood biomarkers | Arcaevo panels | recalibrate baseline + band (see 1.3) |
| Felt check-in | in-app (`checkin`) | correction signal (see 1.5) |

### 1.2 Personal baseline (wearable core)
Compute a rolling **60-day baseline** per signal — mean μ and SD σ of overnight HRV and RHR. Accuracy is poor for the first 4–6 weeks of wear; during that window show a `CALIBRATING` state, not a confident number. Blood shortens this: an uploaded historical panel lets the baseline start biologically anchored on day one rather than purely statistically after two months.

Acute deviation as z-scores (RHR inverted — higher RHR = worse):
```
z_hrv = (hrv_last_night − μ_hrv) / σ_hrv
z_rhr = (μ_rhr − rhr_last_night) / σ_rhr
core  = 50 + 50 * clamp( w_hrv*z_hrv + w_rhr*z_rhr , −1, +1 )   // w_hrv≈0.6, w_rhr≈0.4
```
`core` is the wearable-only readiness (the "blood layer OFF" number on the `readiness` screen — design shows 71).

### 1.3 Blood recalibration (the differentiator)
Blood does **two** things, and only these two — it must never silently invent a number:

**(a) Shift the baseline ceiling.** When a fatigue-driving marker is out of its personal/optimal range, lower the achievable ceiling by a bounded penalty. Deterministic, additive, capped:

| Marker | Trigger (wellness thresholds — tune with clinician) | Ceiling penalty | Note surfaced |
|---|---|---|---|
| Ferritin | < ~45 µg/L pronounced, < ~70 mild | up to −12 | "low iron caps recovery" |
| Vitamin D | deficient | up to −8 | "low vitamin D independently causes tiredness" |
| Free T3 / thyroid | out of range | up to −10 | "thyroid affects deep sleep + energy" |
| hs-CRP | elevated | up to −8 **and** widen band | "inflammation lowers recovery" |
| Testosterone | low (where measured) | up to −8 | "affects recovery + mood" |

```
ceiling      = 100 − Σ penalties            // clamp floor ≈ 55 so it never reads alarmist
readiness    = min(core, ceiling)
```
Penalties **decay** as the marker ages: full weight for ~6 weeks post-draw, linearly fading toward 0 by the next expected draw (a 6-week-old ferritin is weaker evidence than yesterday's HRV). Always annotate with marker value + test date: *"Ferritin 29 µg/L, tested 2 Jul — your baseline is adjusted down until it recovers."*

**(b) Widen the confidence band.** Elevated hs-CRP (or any active out-of-range inflammatory/illness signal) increases uncertainty. Widen the ± band shown with the score (design: ±9) and soften the decision one step toward rest. The band is a first-class UI element, not a hidden internal.

The `readiness` screen's **"blood layer ON/OFF" toggle** demonstrates exactly this: 71 wearable-only → 62 blood-recalibrated, with the ferritin explanation. That toggle is a real, shippable transparency feature — keep it.

### 1.4 Sleep is shown, not scored
Deliberately do **not** fold sleep *duration* into the core score (philosophy: if the body signals recovery on short sleep, don't override it). Sleep is displayed alongside and drives the Energy model (§2) and Target Sleep/Bedtime nudges instead.

### 1.5 Felt check-in as a correction loop
The `checkin` screen captures a 5-point felt state + optional tags. Use it two ways:
- **Immediate:** if felt state strongly contradicts the score repeatedly, surface "the score doesn't match how you feel" and bias toward the subjective read for the decision text.
- **Long-run per-user tuning:** regress logged tags against next-day readiness delta to produce the personal **behaviour-impact table** ("Alcohol −11 readiness", "Evening walk +4") shown on `checkin`. These are *this user's* coefficients from their own history — never population averages. This is the direct analogue of the loop-closing journal the product already believes in; extend it to "did this supplement move the next blood marker?" at draw cadence.

### 1.6 Target Exertion
Readiness sets a **ceiling, not a quota**: a green Target Exertion Zone (0–10 daily load off rolling 30-day max HR + 60-day RHR). Low readiness → narrower ceiling (design: 4/10 when blood-recalibrated vs 7/10 wearable-only). Never nag to hit a number; only cap. **Load includes resistance work** (workout type + duration + HR from HealthKit), not just cardio — cardio-only strain under-weighting lifting is the top documented complaint against the Athlytic class.

### 1.7 Sick mode (rest as a first-class state)
Tagging "Feeling ill" in the check-in (or a sustained out-of-band vitals run) enters **sick mode**: experiments pause without penalty, nudges are silenced, the exertion ceiling drops to rest, and the score copy switches to permission-to-rest tone ("rest is the plan, not a failure"). Auto-exits when overnight signals return to band; one push confirms entry (see notification vocabulary). This is the Gentler-Streak-class kindness pattern our fatigue-managing longevity segment explicitly wants — without abandoning numbers.

### 1.8 The ten-second rule (product-wide invariant)
The single most-loved behaviour in the category is "check readiness in under ten seconds." Enforce it as a build invariant: every daily surface (widget, complication, Smart Stack card, watch Today, dashboard readiness card) must deliver score + decision inside 10 seconds and zero taps. Instrument it: time-to-glance is a tracked metric, and any surface that needs a tap to answer "how am I today?" fails review.

---

## 2. Energy ("Body Battery"-style all-day gauge)

A continuous 0–100 gauge (the metric ex-Garmin users most miss on Apple). Drains with strain/stress, recharges with rest/sleep.

```
energy(t) = clamp( energy(t−Δ) − drain(strain, stress, Δ) + recharge(rest, sleep_quality, Δ), 0, ceiling_energy )
overnight recharge toward ceiling_energy, scaled by sleep quality
```
- **ceiling_energy** is blood-modulated by the same §1.3 mechanism — low ferritin/thyroid lowers the day's max (design copy: "same walk, heavier legs: that's this number, not your effort"). This is the fusion nobody else ships on an energy gauge.
- Morning start value reflects overnight recharge (design: started at 68 not 100 because of short sleep + low iron).
- **Forecast the afternoon dip** from the personal circadian pattern (design: ~15:00) and nudge daylight/movement over caffeine — cross-referenced with the user's own caffeine experiment result.

---

## 3. Vitality Age (the chronic companion — screens `vitality`, `wvitality`)

The two-speed model's slow half: acute scores (readiness, energy) answer *today*; **Vitality Age** answers *is any of this working* between draws. Design: banded number (29 ±2) vs calendar age, monthly cadence, driver table, watch glance.

**Computation**
- **Blood anchor:** age-associated markers (ApoB, HbA1c, hs-CRP, vitamin D, ferritin where limiting) mapped to age-offset contributions via the clinician-reviewed rule table. Anchored at each draw.
- **Wearable drift:** VO₂max, RHR, (later HR-recovery) move the number *between* draws, weighted lower than blood.
- **RCV gating — the honesty rule:** a driver only contributes when its change exceeds that user's own test-noise threshold (reuse `apps/web/src/lib/rcv.ts` — the RCV verdict engine is the platform's genuinely unique asset; Vitality is that engine wearing a chronic face). No RCV-significant change → the number does not move.
- **Cadence:** recomputed monthly, never daily. Show the ±2 band always; never a decimal-point age.
- **Ferritin (or any capped marker) can show as "+x yrs · holding it back"** — the same marker that caps readiness, so the two surfaces tell one story and both point at the same January recheck.
- Copy tone: "the slow score — it only moves when it's real."

**Monetisation hook (the only one):** the Vitality CTA and the recheck-window notification sell the **€69 recheck kit** — closing the experiment→recheck→verdict loop. **No supplement upsells, ever** (documented category trust-killer).

### 3.1 Cycle-aware baselines (readiness + vitality prerequisites)
When the user tracks cycles in HealthKit (`menstrualFlow` + cycle categories, wrist temperature on S8+), compute per-phase baseline bands (μ, σ per phase). Luteal-phase HRV dips and temperature rises are expected — they must **not** read as "run down" (a known wearable complaint; Athlytic/Bevel are cycle-blind — this is the women's-health wedge). Readiness screen shows "Cycle phase — luteal · band adjusted, no false alarm". Menstrual data is GDPR Art. 9: opt-in, flows under existing `health_processing` consent, never synced unless cycle-aware baselines are on.

---

## 4. Notifications & Live Activities (world-class glance layer)

Prefs live on `notify` (and Account → Notifications). Defaults reflect the "only the ones worth a buzz — never streak guilt" rule.

| Pref | Default | Trigger | Delivery |
|---|---|---|---|
| Results & clinician notes | on | panel reviewed / clinician action | push **without values in payload** |
| Test & fasting reminders | on | night before + morning of a draw | scheduled local |
| **Morning readiness** | on | score locked at **user's usual wake time** | Smart Stack Relevance API + Lock Screen widget |
| **Out-of-range vitals** | on | overnight signal leaves personal band (early illness) | push, gentle wording, never a number |
| **Monthly Vitality** | on | month rollover, RCV-gated change | push, delta only |
| Weekly focus | off | one nudge/week | scheduled |
| **Energy dips** | off | ~30 min before personal afternoon dip | local, opt-in |
| Recheck window | on | N weeks after a capped/low marker, experiment ending | push, sells only the €69 kit |
| Sick mode entered | on | "Feeling ill" tag or sustained out-of-band vitals | push, permission-to-rest tone |
| Lock app with Face ID | on | app open | — |

**Final copy for every push lives on the `pushgallery` screen ("Notification copy") — twelve cards, one voice. Anything not on that list doesn't ship.**

**Delivery rules**
- **Morning readiness** must fire at the user's *learned* wake time and location, never earlier — use the watchOS **Smart Stack Relevance API** to surface the readiness widget, don't blast a push at 6am.
- **Results never in the payload.** Push says "your July panel is ready", never the value. Critical values never push at all — clinician phones first (`critical`).
- **No streak guilt, ever.** No "you broke your streak", no red alarmist numbers on watch/lock surfaces. Vitals alerts are worded as a gentle heads-up.
- Respect a quiet-hours window; batch non-urgent nudges.

**Surfaces to build (see `widgets` screen)**
- Lock Screen widgets: readiness ring, energy gauge, HRV/RHR mini-chart, next-test countdown.
- Smart Stack Live Activity: morning readiness rises to top of the stack at wake, then recedes; workout Live Activity stays wrist-down during a session.
- Complications across **every face family** (readiness, energy, next-test) so the user can put the number on any face — Apple ships no readiness/Body-Battery score, this is the gap.
- **Live workout screen** (`wworkout`): current HR + zone bar + a live "today's ceiling" bar (3.4/4.0) with an ease-off cue — the in-workout readiness-buffer pattern users praise. Ship as a workout Live Activity that stays visible wrist-down.
- **Background HealthKit + iCloud baseline caching:** the Watch can only query ~7 days locally, so post 60-day HRV/RHR baselines (and current blood penalties) via a background task, so the Watch score matches the phone. Keep every watch surface a **sub-10-second glance** — the "too busy/too many numbers" complaint is the category's #1 criticism.

---

## 5. Guardrails (non-negotiable)
- **Directional, not absolute.** Independent testing shows no Apple-Watch recovery app is accurate in absolute terms vs felt recovery. Always pair the score with the felt check-in; never over-claim precision. Apple-Watch overnight HRV is noisier than a chest strap/ring — consider an optional guided morning HRV measurement for power users.
- **Deterministic rules decide, AI narrates.** The score, penalties, band and decision are computed by the rules above. Claude/AI only writes the sentence around them, grounded in the real numbers — unlike Oura Advisor/WHOOP Coach, our number is one the blood *actually* changed.
- **Blood never on the alarming edge.** No blood value modulating the score may push a user toward alarm; flagged values leave this engine entirely.
- **EU/Ireland:** if wellness-framed blood-modulated scoring is later deemed too close to the medical line (MDCG June 2025 guidance puts health apps in MDR/IVDR scope), fall back to blood as a clearly-separated *context* layer (the WHOOP/Oura pattern — the `readiness` toggle's "OFF" state) until cleared. Build the toggle so this fallback is a config flag, not a rewrite.
- **Clinician note on every panel** (`results` screen): the Dr.-Nolan review flow extends from critical-values-only to a short human-written note on **every** panel — the verified #1 industry pain point is uninterpreted results, and no US player does this. Template-assisted, but a human signs it (name + IMC number + read date shown).
- **Honesty before capability.** The HealthKit primer lists exactly what is read — the primer + system sheet now enumerate: sleep & stages, heart rate, HRV, VO₂max, workouts, active energy, steps, respiratory rate, SpO₂, wrist temperature, and (separate, off-by-default) cycle tracking. The **cycle-aware baselines toggle lives in Data & privacy** — Art. 9 data, never synced unless on. Never claim a signal before its ingestion ships. Wearable-only readiness must be credible at Athlytic parity *before* the blood layer is the headline.
- **Amber at worst.** No red numbers anywhere in the daily layer; the calmest state is the default state.
- **Blood-informed, never prescriptive.** Vitara-style "ferritin 28 → reduce eccentric volume" is training *prescription* and sits closer to the MDR line; Arcaevo's blood layer adjusts the *score and its ceiling* and explains why — the user (or their clinician) decides what to do.

---

## 6. First-run & degraded states (build these; do not invent numbers)

The scores must never bluff. Each state has fixed copy tone — calm, specific, never apologetic:

| State | Condition | Surface behaviour |
|---|---|---|
| **Calibrating** | < 28 days of overnight HRV/RHR | Ring shows no number — "CALIBRATING · DAY 9 OF 28" with a fill-progress ring; decision line reads "Learning your normal. Check back — or upload old bloodwork to start sooner." Widgets/complications show the calibration ring, not a fake score. |
| **No bloods yet** (Fusion pre-upload) | zero BiomarkerReadings | Readiness runs wearable-only; blood-layer card becomes an invite: "Add any past bloodwork — your baseline starts the day you do." Never show the ON/OFF toggle with nothing behind it. |
| **Stale blood** | last draw > 26 weeks | Penalties fully decayed; blood card says "Your July panel has aged out of the score — recheck to bring it back." (feeds the recheck loop, honestly) |
| **Sparse night** | no overnight HRV (loose wrist, watch charging) | "No overnight read — wear the watch to sleep tonight." Yesterday's score greys out; never interpolate. |
| **Sick mode** | §1.7 | Ceiling → rest; experiments paused; exits on band return. |
| **Offline** | no network | All scores compute on-device from cached baselines; blood context uses last sync with a quiet "as of" stamp. |

## 7. Permission choreography (iOS one-shot prompts — order matters)
1. **Consent (in-app, Art. 9)** — our screen, before anything.
2. **HealthKit** — primer screen, then the system sheet (read-only types listed in §Guardrails; cycle tracking is a *separate later ask*, only when the user enables cycle-aware baselines in Data & privacy — never bundled into the first sheet).
3. **Notifications** — the onboarding "Only the ones worth a buzz" screen IS the primer; request the system permission only when the user taps continue with ≥1 toggle on (provisional/quiet authorization acceptable fallback). Never ask on first launch before value is shown.

App Review notes: HealthKit purpose strings must name each type and its use in plain language; App Privacy labels must declare health data as linked, with the Art. 9 wording mirrored from the consent screen; menstrual data only appears in the manifest behind the optional entitlement path.

## 8. Accessibility & platform quality bar
- Full **Dynamic Type** (the mono data labels may cap at XL; body text never caps); VoiceOver labels on every score ("Readiness sixty-two of one hundred, go easy today"); ring colours never the only signal (score + word always present — already true in the designs).
- Haptics: single light tap on quick-log confirm and check-in save; the success haptic only for verdicts.
- All watch hit targets ≥ 44pt (already in the designs); reduce-motion honoured on ring animations.

## 9. Explicitly out of scope for this phase
Android, iPad layouts, Garmin/WHOOP/Oura ingestion (UI slots exist in Connected sources; APIs later), the chronic screen beyond Vitality, corporate/B2B, any supplement or third-party commerce.

## 10. New entities (extend the §Entities list in PROMPT.md)
`VitalityScore(month, age, band, drivers[], rcvGated)` ·
`CyclePhaseBaseline(userId, phase, signal, mu, sigma)` ·
`ClinicianNote(panelId, text, clinicianId, imcNumber, readAt)` ·
`RecheckOrder(markerId, experimentId, price)` ·
`ReadinessScore(date, core, ceiling, final, band, decision, contributions[])` ·
`EnergySample(t, value, ceiling)` ·
`FeltCheckin(date, feelState, tags[])` ·
`BehaviourImpact(userId, tag, coefficient, n)` — per-user, from own history ·
`BiomarkerPenalty(marker, value, testDate, penalty, decayAt)` ·
`NotificationPref(key, enabled)` · `WakeTimeModel(userId, learnedWake, confidence)`.
