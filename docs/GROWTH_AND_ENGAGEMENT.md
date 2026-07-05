# Arcaevo — Growth & Engagement Review (PLG + retention)

> **The founder's worry:** stickiness. *"A daily push if a user doesn't check in is vital."* This doc audits the **engagement and product-led-growth mechanics that already exist in the codebase** (cited by file), then gives a **prioritised backlog** (impact × effort) grounded in the product and the WHOOP/Oura retention playbook in `docs/STRATEGY.md`. It ends with the **top 5 to do first**.
>
> Written 2026-07-05. Companions: `docs/STRATEGY.md` (market + retention economics), `docs/BUILD_STATE.md` (build truth), `docs/legal/MEDICAL_DEVICE_POSITIONING.md` (the wellness/MDR line every social surface must respect).

---

## The honest headline

A striking pattern runs through the codebase: **the surfaces and data models for retention/PLG are built, but the engine that fires the mechanic on a schedule or credits a reward is repeatedly missing.** The habit loop the founder is worried about is *half-wired* — the notification planner, the copy, and the toggles all exist; the daily re-engagement trigger does not yet. And the single strongest viral lever — referral — *was* a polished screen with no backend; it is now **wired end-to-end** (`src/lib/referral.ts` + attribution at signup + idempotent both-sides crediting on paid activation).

The good news: because the models and copy already exist, most of the high-impact fixes are **wiring, not invention.**

---

## Part 1 — What already exists (cited)

Legend: **[LIVE]** works end-to-end · **[UI/model only]** surface built, no engine · **[toggle — no scheduler]** pref honoured but nothing fires it.

### Retention / habit mechanics

| Mechanic | Status | Where | Note |
|---|---|---|---|
| **Morning readiness push at learned wake time** | **[LIVE]** | `apps/ios/Arcaevo/Notifications/NotificationPlanner.swift` (`plan`/`schedule`/`refresh`), `PushCopy.swift` | Fires at the member's learned wake time (`WakeTimeModel`, fallback 07:00); passive, never buzzes. Wired from onboarding + prefs. |
| **First-visit re-engagement nudge** | **[LIVE]** | `apps/ios/Arcaevo/Notifications/FirstReadingNudge.swift` | One-time local nudge ~24h post-onboarding ("your first reading is ready") if they granted notifications but haven't viewed a score; cancelled by `markFirstScoreViewed()`. |
| **Daily check-in re-engagement nudge** | **[NOT BUILT — in progress, task #38]** | *(no file yet)* | The thing the founder wants. Only the *one-time* first-reading nudge covers re-engagement today. **This is the gap.** |
| **Morning felt check-in ("10-second check-in")** | **[LIVE, local-only]** | `apps/ios/Arcaevo/Views/MemberV3/CheckinV3View.swift`, `AppModel.saveCheckin` | Feeds the behaviour/energy engines. Persisted to UserDefaults, not synced. |
| **Baseline "calibrating" countdown** | **[LIVE]** | `apps/ios/ArcaevoKit/EngineModels.swift` (`case calibrating`), `ArcaevoWatch/WatchScreens.swift` | `<28 days` HRV/RHR → calibrating; **bloods on file shorten it to 14 days** — a real "sync your bloods to see your score sooner" hook. |
| **Streaks / milestones** | **Intentionally absent** | "No streak guilt, ever" (`PushCopy.swift`), repeated across the code | A deliberate design stance, not a gap — see the backlog for how to add positive milestones without guilt. |
| **Weekly focus / Monthly Vitality** | **[toggle — no scheduler]** | `NotificationPrefsStore.weeklyFocus`, `PushKey.weeklyFocus`/`monthlyVitality`, `PushCopy.swift` | Toggle + final copy + planner slot exist; **nothing ever sets `weeklyFocusAt`/`monthlyVitalityAt`**, so they never fire. No web email digest at all. |

> **Notification reality:** of the **12 canonical push cards** in `PushCopy.swift`, only **readiness + energy-dip** get a live anchor in `refresh()`. The six event-driven cards — **results-ready, weeklyFocus, monthlyVitality, experimentVerdict, recheckWindow, vitalsOutOfRange** — have a key, verbatim copy, a planner slot, and a working toggle, but **no event source is wired**. Web has no push/notification backend at all (transactional email only, `apps/web/src/lib/emails.ts`).

### PLG / acquisition / monetisation mechanics

| Mechanic | Status | Where | Note |
|---|---|---|---|
| **Referral — give-a-month / get-a-month** | **[LIVE]** end-to-end | Engine `apps/web/src/lib/referral.ts`; attribution in `auth/signup` + `checkout` routes; crediting in `webhooks/stripe/route.ts` (both mock + real activation); API `apps/web/src/app/api/v1/referral` (+ `/resolve`); `JoinForm.tsx` now reads/persists `?ref=`; models `Referral`/`ReferralSchema` + `User.referredBy/referredByCode/referredAt/referralCreditMonths` (`models.ts`), collection `referrals` (`db.ts`) | `/join?ref=<code>` is attributed to the referrer at signup (pending referral). When the referred member's membership goes genuinely PAID/active, BOTH sides get **+1 month** (renewalDate extended) idempotently; if the referrer isn't active yet their month is HELD and applied at their own activation. Anti-abuse: no self-referral (id/email), one credit per referred member, unknown/expired codes ignored, no credit on unpaid/free, soft farming cap, referrer never learns who joined (counts only). iOS `InviteV3View` already shares the `?ref=` link — unchanged. |
| **Gift codes** | **[LIVE]** end-to-end | `apps/web/src/app/api/v1/gift/route.ts` (create), `.../gift/redeem/route.ts` (redeem), `gift/` + `redeem/` UIs | Fully implemented, Essential-tier at launch. Membership year starts at **activation**, not purchase. Honest out-of-area fallback (Fusion + waitlist, or refund). |
| **Waitlist + county position** | **[LIVE]** | `apps/web/src/app/api/v1/waitlist/route.ts`, `WaitlistEntrySchema` | County-scoped 1-based position, idempotent, anti-enumeration; "You're number N on the {county} list" on the account page + iOS. |
| **Founding-member 30-day window (E11)** | **[ops/manual — no scheduler]** | waitlist route comment | The county-open founding-member email and monthly position updates are "later from ops" — no automation sends them. |
| **Experiment → recheck → verdict loop** | **[LIVE on iOS + real RCV engine]** | `apps/web/src/lib/rcv.ts` (`computeRcvVerdict` — the "within the noise" logic), `apps/ios/Arcaevo/Views/MemberV3/ExperimentsV3View.swift` (the **€69 "close the loop" recheck card**) | The moat loop. Verdict chips: improved→"IT WORKED", no_real_change→"WITHIN NOISE", worsened→"WRONG WAY" (amber, never red). Caveat: adherence % + some completed rows are demo/hardcoded; experiment persistence is UserDefaults-local, no web experiment model yet. |
| **€69 recheck kit monetisation** | **[LIVE pricing + flow]** | `ADDON_PRICE_EUR.recheck` (`models.ts`), `composeClinicianNote` points at it | The honest year-two renewal loop — "prove your change in your blood." No supplement upsells anywhere (a deliberate anti-pattern avoided, per STRATEGY). |
| **Analytics funnel (measure retention)** | **[wired — dark until keyed]** | `apps/web/src/lib/analytics.ts` | Whole journey instrumented, PII/health-free; no-op until `NEXT_PUBLIC_POSTHOG_KEY`. You can't improve retention you can't see — key this first. |

---

## Part 2 — Why this matters (the retention playbook)

From `docs/STRATEGY.md` (verified research pass):

- **Oura's first-year retention is >80%**, and its stated driver is **feature velocity + moving from measurement to intervention** — measurement-only scores decay in value. Arcaevo's intervention loop is the **experiment → recheck → verdict**; that's the retention asset, not the daily score alone.
- **The #1 verified industry pain point is uninterpreted results** (NPR, Apr 2026). Every "your result actually means X" moment is both retention *and* the wedge.
- **Premium annual plans ≈ 4× the LTV** of cheap plans — so a small retention lift compounds hard on the €119/€329/€399 tiers.
- **The fusion insight is itself a retention asset:** "WHOOP tells you you're run down; Arcaevo tells you *why* — and proves it in your blood." A wearable-only app *cannot* close the recheck loop. Lean on it.
- **Anti-pattern to avoid:** Superpower's supplement upsells (trust-killer). **No supplement upsells, ever.** The €69 recheck is the honest loop.

---

## Part 3 — Prioritised backlog (impact × effort)

Scored **Impact** (1–5) and **Effort** (S/M/L). Sorted by impact-per-effort.

### Tier 1 — do first (high impact, low-ish effort; mostly wiring what exists)

| # | Item | Impact | Effort | What it is |
|---|---|---|---|---|
| 1 | **Daily check-in habit loop** (task #38) | 5 | M | Finish the daily re-engagement nudge. Wire a scheduled local notification that fires if the member hasn't opened/checked in by their usual time — **framed as value, not guilt** ("your readiness is ready", never "you broke your streak"). The planner, copy pattern, and wake-time model already exist in `NotificationPlanner.swift`; this is the missing trigger. **Directly answers the founder's core worry.** |
| 2 | **Key PostHog (turn the lights on)** | 5 | S | The funnel is wired and dark. Set `NEXT_PUBLIC_POSTHOG_KEY` (needs the EU DPA — `FOUNDER_SETUP.md B7`). Without it you're optimising retention blind. Near-zero eng effort. |
| 3 | ~~**Make referral actually work**~~ **DONE** | 5 | M | ✅ Shipped. `src/lib/referral.ts` engine: `/join?ref=` attributed at signup, both sides credited **+1 month** idempotently when the referred member's membership goes paid/active (the reward is a **time extension**, never a discount/coupon — no pricing change), held-credit fallback for a not-yet-active referrer, full anti-abuse (self-referral/loop/unknown-code/unpaid guards, GDPR counts-only). API `GET /api/v1/referral` (+ `/resolve`). |
| 4 | **Wire the event-driven notifications** | 4 | M | Six cards (results-ready, experimentVerdict, recheckWindow, weeklyFocus, monthlyVitality, vitalsOutOfRange) are fully built but have no event source. Emit the events from the existing backend signals (results ingested, RCV verdict computed, recheck window open) so the toggles a user already flipped actually fire. High perceived-aliveness for low effort. |

### Tier 2 — high impact, more effort

| # | Item | Impact | Effort | What it is |
|---|---|---|---|---|
| 5 | **Shareable "it worked" verdict card** (the viral moment) | 5 | M–L | When an experiment returns **improved**, offer a beautiful, **wellness-framed** share card: "I ran a 6-week experiment and it *worked* — proven against my own baseline." **Leak zero health values** — no biomarker readings, no scores, no verdicts-with-numbers; direction + narrative only, per the analytics/MDR invariant. This is Arcaevo's uniquely ownable viral hook (no wearable-only app can prove a change in blood). **See the guardrail box below — this surface is the highest MDR/data-leak risk in the doc.** |
| 6 | **Close the experiment→recheck loop for real** | 4 | M | Replace the demo/hardcoded adherence + completed rows with real adherence from HealthKit workouts/steps, and add a web experiment model so verdicts persist server-side. This is the moat loop and the €69 monetisation engine (STRATEGY #3). |
| 7 | **Weekly digest email** | 4 | M | No weekly email exists on web. A calm weekly "here's your focus + one thing to do" email (transactional, wellness-framed) is the proven low-frequency retention surface for members who aren't daily-active. Reuse the `weeklyFocus` copy. |
| 8 | **Founding-member scarcity automation (E11)** | 3 | M | Automate the 30-day county-open founding-member window + monthly position updates (currently ops-manual). Real, honest scarcity ("you're #12 in Cork; founding pricing closes in 30 days") drives waitlist→paid conversion. Don't fake it. |

### Tier 3 — durable, do after launch

| # | Item | Impact | Effort | What it is |
|---|---|---|---|---|
| 9 | **Positive milestones WITHOUT guilt** | 3 | M | Respect the "no streaks" stance. Celebrate *arrivals*, not chains: "Your baseline is now calibrated" (day 28/14), "First recheck verdict in", "6 months of data". One-time, warm, never a broken-streak penalty. |
| 10 | **Baseline-calibrating onboarding hook, harder** | 3 | S | Lean into the existing calibrating countdown: surface "sync your bloods → see your score in 14 days instead of 28" prominently in onboarding. It converts a dead 4-week wait into a reason to come back *and* to upload bloods. |
| 11 | **Both-sides referral tiering** | 2 | M | Once #3 works, consider a small ladder (invite 3 → an extra month) — but keep it counts-only, "no leaderboards" (the code's stated stance). |
| 12 | **Fusion insight as the retention narrative** | 3 | M | Make the fusion "why" (blood-modified readiness — "Recovery capped by low ferritin, recheck in 6 weeks") a recurring, real insight, not a canned card. This is the thing WHOOP/Athlytic structurally can't do — it's the reason to renew (STRATEGY #1/#3). |

---

## ⚠️ Guardrails — where growth can cross the wellness/MDR line

Any social/shareable/re-engagement surface must hold the line in `docs/legal/MEDICAL_DEVICE_POSITIONING.md`:

- **Never leak an Art. 9 health value into a shareable/social surface.** No biomarker readings, no scores, no numeric verdicts on a share card. Direction + wellness narrative only ("it worked", not "my ferritin went 28→41"). This mirrors the coded analytics invariant (ids/counts/enums only).
- **Never let a notification or share become a diagnostic claim.** Keep the amber-at-worst, no-red-numbers tone. A re-engagement push says "your readiness is ready", never "your health is declining".
- **No guilt mechanics.** The "no streaks, ever" stance is also a wellness-safety posture — a health app that punishes non-use reads as manipulative and invites App Review scrutiny. Positive-arrival milestones only.
- **No supplement or upsell spam.** The €69 recheck is the only monetisation nudge; STRATEGY explicitly flags supplement upsells as a documented trust-killer.
- **Referral rewards must be honest.** "Give a month / get a month" must actually credit a month once wired — don't ship the promise (currently on the invite screen) without the mechanism.

---

## Top 5 to do first

1. **Ship the daily check-in re-engagement nudge (task #38).** The founder's exact worry; the planner + wake-time model already exist — wire the missing trigger, framed as value not guilt.
2. **Key PostHog.** Turn the wired-but-dark funnel on so retention is measurable — near-zero effort, unblocks everything else (needs the EU DPA).
3. ~~**Make referral actually attribute + reward.**~~ **DONE** — `?ref=` is persisted at signup and both sides get a real +1-month extension on paid activation, idempotently and abuse-resistantly (`src/lib/referral.ts`). The promise on the invite screen is now real.
4. **Wire the six event-driven notifications** (results-ready, experiment verdict, recheck window, weekly focus, monthly vitality, vitals). Fully built, just no event source — high aliveness for low effort.
5. **Build the shareable "it worked" verdict card** — the uniquely ownable viral moment (proven-in-blood), wellness-framed with **zero health values leaked** (see guardrails).
