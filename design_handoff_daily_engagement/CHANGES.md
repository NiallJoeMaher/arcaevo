# What's new in this handoff (session of 4 July 2026)

This package supersedes `design_handoff_ios_watch/` — same 8-group prototype, now 52 screens, plus the algorithm spec. Read order: `README.md` → `ALGORITHM.md` → `PROMPT.md` → click through `designs/Prototype.dc.html`.

## New screens (phone)
- **Readiness** — blood-recalibrated morning score with the blood-layer ON/OFF compare toggle (71 wearable-only → 62 recalibrated), why-breakdown, cycle-phase row, target-exertion ceiling (resistance load counts)
- **Energy** — all-day gauge, blood-lowered ceiling, forecast 15:00 dip
- **Morning check-in** — felt score + tags, per-user behaviour impacts, sick mode
- **Vitality Age** — RCV-gated chronic slow score with driver table and €69 recheck CTA
- **Widgets & complications** — Lock Screen, Smart Stack (wake-time Relevance), complication set
- **Notification copy** — all 12 pushes, final copy, one voice

## New screens (watch)
Today = readiness + decision · energy gauge · felt check-in · vitality glance · **live workout** (HR zone bar + today's-ceiling bar + ease-off cue)

## Changed screens
- **Results** — a signed clinician note on every panel (Dr. Nolan, IMC number, read date)
- **Dashboard** — readiness and vitality entry cards
- **Experiments** — €69 recheck-loop card ("never a supplement")
- **HealthKit primer + sheet** — full read list (sleep & stages, HR, HRV, VO₂max, workouts, energy, steps, respiratory, SpO₂, temperature); cycle tracking separate + off by default
- **Data & privacy** — cycle-aware baselines toggle (Art. 9, never synced unless on)
- **Notifications prefs** — 8 toggles (readiness/vitals/monthly on; focus/energy-dip off)

## The spec
`ALGORITHM.md` covers: readiness maths + blood penalty/decay/band rules · energy model ·
Vitality Age (RCV-gated) · cycle-aware baselines · sick mode · the ten-second rule (build
invariant) · notification triggers + delivery rules · first-run/degraded states (calibrating,
no-bloods, stale blood, sparse night, offline) · permission choreography + App Review notes ·
accessibility bar · out-of-scope list · new entities.

## Strategy constraints encoded throughout
Blood-informed never prescriptive · deterministic rules decide, AI narrates · amber at worst,
no red numbers · no streak guilt · results never in a push payload · clinician phones first ·
the recheck kit is the only in-app sell, never supplements.
