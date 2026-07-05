# RCV thresholds — canonical reference

**Reference Change Value (RCV)** is the per-biomarker percentage a reading must
move, between two draws of the same marker, before Arcaevo calls the change
**real** rather than noise (analytical + within-person biological variation).
It is the deterministic heart of the product: _"deterministic rules decide; AI
only narrates."_

## Single source of truth

**The web owns these numbers.** They live in exactly one place:

- **Canonical:** [`apps/web/src/lib/biomarker-rules.ts`](../apps/web/src/lib/biomarker-rules.ts) — `CANONICAL_BIOMARKER_RULES`.
- **Seed:** `apps/web/scripts/seed.ts` imports the canonical array to seed the `biomarkerRules` collection (no re-declaration).
- **Endpoint:** `GET /api/v1/biomarker-rules` (public, `force-dynamic`, no auth, no secrets) serves the canonical `code → { rcvPercent, unit, direction }` map so clients can read the live values with no rebuild.
- **iOS:** `ArcaevoKit/VitalityEngine.swift` → `BiomarkerRuleLite.defaults` mirrors these `rcvPercent` values as an **offline fallback**. At runtime the app **fetches** `/biomarker-rules` (`APIClient.biomarkerRulesOrDefaults()`) and **prefers** the fetched values, falling back to the matching hardcoded constants on any failure (offline / unreachable / bad payload).

Previously the numbers were defined twice (web seed **and** iOS Swift constants)
and had drifted — e.g. hs-CRP **85%** on web vs **46%** on iOS — so the same
member saw a different "meaningful change" verdict on the web GP-share than on
their phone. That drift is now closed and guarded by parity tests on both sides.

## Canonical table

| Marker code | Name | Unit | RCV % | Direction |
|---|---|---|---|---|
| `apob` | ApoB | g/L | **10** | lower is better |
| `ldl_c` | LDL-C | mmol/L | 17 | lower is better |
| `hdl_c` | HDL-C | mmol/L | 12 | higher is better |
| `triglycerides` | Triglycerides | mmol/L | 40 | lower is better |
| `hba1c` | HbA1c | mmol/mol | **6** | lower is better |
| `fasting_glucose` | Fasting glucose | mmol/L | 11 | lower is better |
| `hs_crp` | hs-CRP | mg/L | **85** | lower is better |
| `ferritin` | Ferritin | µg/L | **30** | higher is better |
| `vitamin_d` | Vitamin D (25-OH) | nmol/L | **25** | higher is better |
| `tsh` | TSH | mIU/L | 20 | lower is better |
| `alt` | ALT | U/L | 25 | lower is better |
| `creatinine` | Creatinine (eGFR basis) | µmol/L | 9 | lower is better |
| `testosterone` | Testosterone (total) | nmol/L | 20 | higher is better |
| `cortisol` | Cortisol (morning) | nmol/L | 45 | lower is better |
| `omega3_index` | Omega-3 Index | % | 15 | higher is better |

**Bold** rows are the five markers iOS also hardcodes (they are the ones that
had drifted); iOS was reconciled **to** these canonical web values:

| Marker | iOS was | iOS now (= web) |
|---|---|---|
| `apob` | 10.6 | **10** |
| `hba1c` | 4.5 | **6** |
| `hs_crp` | 46 | **85** |
| `vitamin_d` | 16 | **25** |
| `ferritin` | 15 | **30** |

> The iOS-only fields `optimalLow` / `optimalHigh` / `yearsWeight` on
> `BiomarkerRuleLite` are **age-offset weights** for the Vitality-Age surface —
> they are **not** part of the RCV threshold, the server does not own them, and
> the runtime merge preserves them while overriding only `rcvPercent`.

## ⚠️ These values are PROVISIONAL — not clinically validated

The percentages above are **plausible wellness thresholds, not clinically
validated RCVs.** They MUST be confirmed **by a clinician** and against
**published biological-variation data** (within-person CVi and analytical CVa,
combined into RCV) before any real clinical reliance. Arcaevo is a **wellness
product, never a diagnostic device** — every "real change" verdict is framed as
a baseline-relative wellness signal, not a diagnosis.

## Changing a threshold (do all of these together)

A change to any number is a **deliberate clinical decision**. Update, in one
change:

1. `apps/web/src/lib/biomarker-rules.ts` (`CANONICAL_BIOMARKER_RULES`).
2. This table (`docs/RCV_THRESHOLDS.md`).
3. The web parity test literals — `apps/web/src/lib/__tests__/biomarker-rules.test.ts`.
4. The iOS fallback constants — `ArcaevoKit/VitalityEngine.swift` (`BiomarkerRuleLite.defaults`) — **only for the markers iOS carries.**
5. The iOS parity test literals — `ArcaevoKitTests/RCVParityTests.swift`.

The seed and the endpoint need no edit — they read the canonical array. The
two parity tests (web vitest + iOS XCTest) will fail CI if any of the above
fall out of lockstep, which is exactly what stops the drift from re-opening.
