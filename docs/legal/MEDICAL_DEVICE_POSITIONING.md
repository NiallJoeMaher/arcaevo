# Medical-Device Positioning — Staying in Wellness, Outside EU MDR / IVDR

> **Practical guidance, not a substitute for a qualified Irish solicitor** (and, for the regulatory line specifically, someone with EU MDR/IVDR experience — a notified body or a medical-device regulatory consultant). This is an internal working position written from the current codebase and design so that a professional review is faster and cheaper. It is the single most important compliance document for keeping Arcaevo shippable without a CE mark.
>
> Interim controller: **Codú Limited** (see `RECORDS_OF_PROCESSING.md`). Regulatory exposure here attaches to whoever puts the software on the market — currently Codú Limited for the trial.

---

## 0. Why this matters, in one paragraph

If Arcaevo's software qualifies as a **medical device** under EU Regulation 2017/745 (MDR) — or an **in-vitro diagnostic** under 2017/746 (IVDR) — then before it can be placed on the EU market it needs a **CE mark**, a **conformity-assessment** (almost always via a **notified body** for anything above the lowest class), a **quality management system (ISO 13485)**, **clinical evaluation**, **post-market surveillance**, and registration with the competent authority (in Ireland, the **HPRA**). That is a 12–24 month, six-figure programme. The entire point of the wellness positioning is to stay **out of that scope** — legitimately, not by hiding function. The good news, established below: **as currently built and worded, Arcaevo is very likely NOT a medical device.** The risk is not the code; it is the *claims*. This document exists to stop a marketing sentence or a generated-insight string from silently reclassifying the product.

---

## 1. The legal line — what makes software a "medical device"

### 1.1 The definition (MDR Article 2(1))
Software is a medical device if the manufacturer intends it, alone or in combination, for one or more of these **medical purposes**:

- **diagnosis**, prevention, **monitoring**, **prediction**, prognosis, **treatment or alleviation of disease**;
- diagnosis, monitoring, treatment, alleviation of, or compensation for, an **injury or disability**;
- investigation, replacement or modification of the anatomy or of a physiological/pathological **process or state**;
- providing information by means of **in-vitro examination of specimens** (this last limb pulls "software that interprets a blood test" toward **IVDR**, not MDR — see §7).

The verbs that pull you *in*: **diagnose, screen, detect, monitor (a disease/condition), predict/assess risk of disease, prevent disease, treat, prescribe.**

### 1.2 "Software" is explicitly in scope — and health apps are the current focus
MDR Recital 19 and Article 2 confirm **standalone software** can be a device. The **MDCG 2019-11** guidance (qualification/classification of software) is the working test, and the **MDCG June-2025 guidance on the qualification of health-and-wellness apps** sharpened this: regulators are actively looking at consumer health apps and will classify by **intended purpose**, not by the marketing label the developer prefers. Calling yourself "wellness" is necessary but **not sufficient** — the whole product (function + claims + UI) has to actually behave like wellness.

### 1.3 The decisive concept: **intended purpose is set by CLAIMS, not just function**
This is the load-bearing idea. Under MDR Art. 2(12), the "intended purpose" is *"the use for which a device is intended according to the data supplied by the manufacturer on the **label, in the instructions for use or in promotional or sales materials or statements**."*

Consequence: **the same algorithm can be a device or not a device depending on what you say about it.**
- "Here is your recovery score relative to your own baseline" → wellness.
- "Arcaevo detects overtraining syndrome / flags low iron / tells you if you're at risk of anaemia" → the *identical* score is now claimed as diagnosis/monitoring/prediction → **medical device**.

So the compliance surface is **every string a user or regulator can read**: marketing site, App Store description, onboarding copy, push/email, in-app labels, generated insight/chat narration, and support macros. A single reviewer, clinician, or investor deck sentence can move the line.

### 1.4 The MDCG "software driving/influencing" test (MDCG 2019-11)
Two questions decide qualification:
1. Does the software perform an action on data **beyond storage, archival, lossless compression, communication, or simple search**? (Arcaevo: **yes** — it computes scores.) — this alone does **not** make it a device.
2. Is that action **for the benefit of an individual patient**, for one of the **medical purposes** in §1.1? If **no** (it is for general wellbeing/fitness/lifestyle), it is **not** a medical device. **This is Arcaevo's exit door: the purpose is general wellness, not a medical purpose.**

There is an explicit carve-out in MDR Recital 19 / MDCG for software intended for **lifestyle and well-being purposes** — that is exactly the lane Arcaevo occupies, and must be kept demonstrably in.

---

## 2. DO / DON'T wording table (make this a launch invariant)

Apply to **all** copy: website, App Store, onboarding, in-app, notifications, emails, generated narration, chat, support replies, decks.

| Concept | ❌ DON'T say (pulls into MDR/IVDR) | ✅ DO say (keeps wellness) |
|---|---|---|
| What the product is | "medical device", "diagnostic tool", "clinical-grade diagnosis" | "wellness and fitness membership", "for general wellbeing / lifestyle / informational purposes", **"not a medical device"**, **"not a diagnosis"** |
| Detecting things | "**detects** low iron", "**screens for** thyroid problems", "**identifies** disease" | "shows how your ferritin compares **to your own baseline**", "gives context on your markers" |
| Diagnosis | "**diagnoses** X", "you have / you likely have X" | "we don't diagnose — talk to your GP", "for wellness optimisation only" |
| Monitoring | "**monitors your condition**", "**tracks your disease**", "continuous health monitoring" | "tracks your **wellness trends** over time", "your baseline, relative to itself" |
| Prediction / risk | "**predicts** your risk of heart disease", "your risk of X", "early-warning for disease" | "shows change **relative to your baseline**", "highlights when something has moved" |
| Prevention | "**prevents** disease", "catch illness early" | "supports healthy habits", "general wellbeing" |
| Treatment / advice | "**prescribes** training", "reduce eccentric volume", "take supplement X", "you should treat this" | "**suggests** how hard to train today, you decide", "a wellness suggestion, not medical advice", "discuss any changes with a healthcare professional" |
| Blood interpretation | "your results **mean** you have…", "clinical interpretation of your bloods" | "your results **in the context of** your wellness trends", "what changed vs your last panel" |
| Urgency | red values, "abnormal", "critical — see a doctor now" (as an app claim) | "a clinician would like to talk this through with you first", route to human, **never** a red number |
| Age metric | "**biological age**", "your body is X years old", "ageing/disease risk" | "**Vitality Age** — a **wellness index** relative to age-typical ranges", "a lifestyle indicator, not a health-risk prediction" |
| General | "clinically proven to…", "medically validated to detect…" | "built with clinical input", "informational; consult your GP for anything medical" |

**Rule of thumb for any new string:** if it names a **disease/condition** and pairs it with a **verb of detection/diagnosis/monitoring/prediction/treatment**, it is a device claim. Rewrite to reference the user's **own baseline** and a **wellness/lifestyle** purpose, or route it to a human.

---

## 3. Arcaevo's risky surfaces — specific review + exact wording

These are the places where the product edges toward the line. Each is currently on the wellness side by design; the notes lock that in.

### 3.1 The Readiness decision — `Train hard / Train as planned / Go easy / Rest`
*(`design_handoff_daily_engagement/ALGORITHM.md` §1.6–1.7; Prototype "Go easy today")*

- **Why it's near the line:** a directive about physical activity, if framed as *prescribed dosing*, edges toward a therapeutic/medical claim. A **training-load ceiling framed as "your recovery — you decide"** is wellness (this is the WHOOP/Oura/Athlytic pattern, all wellness-positioned).
- **Keep it wellness:**
  - Present the decision as a **suggestion/ceiling, never a quota or instruction**. The spec already says *"never nag to hit a number; only cap"* — hold that.
  - Prefer softening verbs: "Today looks like a **good day to go easy**" over "Rest." "Your body seems ready — **train as planned if you like.**"
  - Add a persistent micro-disclaimer on the readiness surface: *"A wellness suggestion based on your own baseline — not medical or training advice."*
  - **Never** tie the decision to a disease or symptom ("Rest — signs of illness/overtraining syndrome"). Deviation language only ("your HRV is below your baseline").
- **Verdict:** wellness, low risk, as worded. The word to hunt-and-kill in generated copy is **"must" / "should" / prescriptive imperatives** about health.

### 3.2 The blood-recalibrated readiness score (the moat feature)
*(`ALGORITHM.md` §1.3, §5; `BiomarkerPenalty`; `docs/STRATEGY.md` §3 #1)*

- **Why it's the highest-attention surface:** biomarker-modified training guidance is exactly what a regulator would scrutinise, because blood → advice is close to "using an in-vitro examination to inform a health decision."
- **What keeps it wellness (already designed in — treat as invariants):**
  1. Blood only **shifts the baseline ceiling** of a wellness score via a **bounded, deterministic, decaying penalty** (floor ≈ 55, never alarmist) and **widens the confidence band** — it never emits a clinical statement on the daily surface.
  2. **Flagged/critical values never enter the engine** — they route to the human clinician-first flow. *(Verify in code that `BiomarkerPenalty.derive` excludes flagged values — this is the single most important rule.)*
  3. **Amber at worst, no red numbers** anywhere in the daily layer.
  4. The **blood-layer ON/OFF toggle** is a real user feature **and** the documented MDR fallback: if a reviewer/regulator deems blood-modulated scoring too device-like, flip blood back to a clearly-separated *context* layer (the WHOOP/Oura pattern) via config, not a rewrite.
- **Wording:** ✅ *"Recovery 62% — capped by low ferritin relative to your baseline. Worth a recheck in ~6 weeks."* (explains a wellness score + points to a recheck). ❌ *"Ferritin 28 → reduce eccentric training volume"* (the Vitara pattern — this is **training prescription** and sits closer to MDR; the spec explicitly names this as the line NOT to cross).
- **Verdict:** wellness, **low–medium** risk. It stays low *only* while blood adjusts **score + band + ceiling** and **explains**, never **prescribes** and never handles flagged values in-app.

### 3.3 The clinician note on every panel
*(`ClinicianNoteSchema`; `models.ts` `CLINICIAN_NAME`; `STRATEGY.md` §3 #2)*

- **Key distinction:** the clinician note is **not primarily an MDR/software question** — a human clinician interpreting a blood result is a **clinical act** governed by **professional/clinical-governance** rules (IMC registration, indemnity, scope of practice), not device law. But it changes the product's overall character from "wellness app" to "wellness app **+ a regulated clinical service**," which raises the whole risk profile (and is a hard **paid-tier gate**).
- **Two separate red lines here:**
  1. **Regulatory (device):** the *app* must not present the note as an automated diagnostic output. The note must be visibly **human-authored** ("reviewed by …") — which the design does.
  2. **Clinical governance (fraud/safety):** the note is currently a **mock persona ("Dr. S. Nolan, IMC 412887")** with auto-marked `clinician_reviewed` values. **This must not reach any real user.** Presenting a fabricated clinician name/IMC, or auto-"reviewing" a real result with no human, is a serious clinical-governance and potential fraud issue. Real IMC-registered clinician + medical-ops partner before any real blood result — see `docs/LAUNCH_READINESS.md` §3.
- **Wording for the note itself:** clinician notes may legitimately be clinical (a real clinician is speaking) — but the **app framing** around them should stay wellness ("a note from the reviewing clinician on your panel"), and the note must still steer medical questions to the user's GP.
- **Verdict:** the *software* stays out of scope; the *service* is a clinical activity that must be governed. Low device-risk, **high governance-risk until a real clinician exists** (paid tiers).

### 3.4 The critical-value "Dr. Nolan would like a word first" flow
*(`ALGORITHM.md` §4; Prototype "Dr. Nolan would like a word first"; `CriticalValueV3`)*

- **This flow is a regulatory *asset*, not a risk** — and one of the cleverest parts of the design. By **routing an alarming value to a human phone call and never rendering a red number, a diagnosis, or advice in-app**, Arcaevo deliberately keeps the *software* from making the medical call. The clinical judgement is a person's; the app only says *"a clinician would like to talk this through with you first."*
- **Keep it wellness/safe:**
  - The app copy must **never** state the value, name a condition, or imply urgency beyond "a person will call you." ✅ *"One value is worth a conversation before you read it alone — a clinician will call you."* ❌ *"Critical result: possible cardiac risk — call 112."*
  - **Results never in email/push payloads** (already an invariant — keep it).
  - There **must be a real clinician on the other end with a real SLA** before this ships to real users — a promise of a call that no one makes is both a safety and a trust failure.
- **Verdict:** wellness/safe by design. The risk is operational (a real human must exist), not regulatory.

### 3.5 Vitality Age
*(`ALGORITHM.md` §3; `how-it-works` "the biological age it implies")*

- **Why it's near the line:** an "age" derived from health markers reads as a **health-risk / longevity prediction** if worded that way — and "predicting a health state" is a device purpose.
- **⚠️ Copy fix flagged:** the current How-It-Works string *"…with the biological age it implies…"* uses **"biological age,"** which leans predictive/medical. **Recommend rewording** to the wellness framing, e.g. *"a Vitality Age — a wellness index that compares your markers to age-typical ranges."* (This is a design-copy change; route it through the design owner given the verbatim-copy rule, but it is worth making.)
- **Keep it wellness:**
  - Frame Vitality Age as a **banded wellness index vs age-typical ranges**, explicitly **"not a measure of disease risk or life expectancy."**
  - Never pair it with disease/mortality language ("your biological age suggests heart-disease risk").
  - Keep it **banded (29 ±2)**, never false-precision, never "abnormal."
- **Verdict:** wellness, **low–medium** — low once "biological age" is softened and disease-risk framing is banned.

---

## 4. Required disclaimers + where they must appear

Disclaimers do **not** by themselves keep you out of scope (a disclaimer can't cure a "we diagnose X" claim), but their **presence and consistency** are strong evidence of intended purpose, and their **absence** is a red flag. Required placements:

| Disclaimer | Where it must appear |
|---|---|
| **"Arcaevo is a wellness service, not a medical device, and does not diagnose, treat, or monitor any disease."** | App Store description; marketing site footer/《science》bar; onboarding consent; `/legal/clinical-safety` (present — keep). |
| **"For informational and general wellbeing purposes only — not medical advice. Consult your GP for anything medical."** | Every screen that shows a **score, band, biomarker, or suggestion** (Readiness, Vitality Age, Results, Insights, Ask-Arcaevo). A persistent footer/caption is fine. |
| **"In an emergency call 112. Never rely on Arcaevo for urgent or symptomatic concerns."** | Clinical-safety page (present) + anywhere a user might mistake the app for urgent care (Results, critical-value flow). |
| **"Self-reported values you enter are not clinician-reviewed."** | Anywhere self-uploaded bloods are shown (the "hollow gold dots" design already carries this distinction — keep it explicit in copy too). |
| **"AI narration explains your results in plain English; it does not set thresholds, diagnose, or give medical advice."** | Insights / Ask-Arcaevo surfaces, before generated narration ships. |

Consistency matters more than volume: the App Store listing, the website, and the in-app copy must all say the **same** wellness thing. A regulator or Apple reviewer who finds the website saying "detects deficiencies" while the app says "wellness only" will read the strongest (most medical) claim as your intended purpose.

---

## 5. The IVDR angle — the at-home blood tests

This is a distinct and commonly-misunderstood axis. Two different products, two different regulatory owners:

### 5.1 The test KIT is (almost certainly) a CE-marked IVD — and that's the LAB partner's responsibility, not Arcaevo's
- A **finger-prick blood collection kit + the lab assay** that returns a quantified biomarker result is an **in-vitro diagnostic device** under IVDR. It must be **CE-marked as an IVD**, and that obligation sits with its **manufacturer / the accredited lab** (e.g. LetsGetChecked and the lab performing the assay), **not** with Arcaevo.
- **Arcaevo's job:** contractually confirm the lab partner supplies a **properly CE-marked IVD** and is an **ISO 15189 / accredited EU laboratory**, and that Arcaevo only ever **displays** those already-regulated results as **wellness context**. This is a due-diligence + contractual dependency, captured in `SUBPROCESSORS.md` (LetsGetChecked = processor **and** a health-data controller for its own regulated testing records).

### 5.2 Displaying results ≠ being the diagnostic device
- **Arcaevo showing a lab's CE-marked result inside a wellness timeline is not the same as Arcaevo being the IVD.** The distinction: the **assay** (the thing that measures ferritin from blood) is the regulated IVD; Arcaevo's software **presents and contextualises** that value against the user's baseline for wellness. As long as Arcaevo doesn't add a **new diagnostic interpretation** ("this value means you have X"), it isn't providing information "by means of in-vitro examination" itself.
- **Where Arcaevo could accidentally become an IVD-adjacent device:** if its software **interprets specimen results to diagnose/screen** ("your bloods indicate iron-deficiency anaemia"). That is IVDR software. Stay on: **display + baseline-relative wellness context + route medical interpretation to a human/GP.**
- **The OCR/extraction path:** reading numbers off an uploaded lab PDF is data-entry, not diagnosis — fine — but note it currently **fabricates values in mock** and is gated OFF in production (`ALLOW_MOCK_EXTRACTION`); do not ship the mock to real users (separate integrity issue, not a device issue).

### 5.3 The dependency, stated plainly
Arcaevo's clean IVDR position **depends on the lab partner's regulatory status**. Before any real lab test: obtain and file the partner's **IVD CE certificates + lab accreditation**, and ensure the contract makes their regulatory compliance an ongoing warranty. This is a **paid-tier gate**.

---

## 6. Red lines you must NOT cross — even in a small closed trial

These are absolute. Crossing any one of them can convert Arcaevo into a medical device (or a fraudulent clinical service) regardless of trial size — there is **no "it's only a few test users" exemption** from MDR/clinical-governance for these:

1. **Never claim to diagnose, screen for, detect, monitor, predict, prevent, or treat any disease or condition** — in any copy, anywhere (site, App Store, in-app, email, chat, deck).
2. **Never show a real user a clinician name/IMC number that is not a real, IMC-registered clinician who actually reviewed their result.** (Kill the mock "Dr. S. Nolan" before real bloods — this is fraud territory, not just a claims problem.)
3. **Never present an automated output as a clinical review / diagnosis.** No auto-`clinician_reviewed` on real results without a real human in the loop.
4. **Never let blood produce prescriptive medical/training instructions** ("reduce X," "take supplement Y," "your dose is Z"). Adjust the wellness score and explain it — never prescribe. **No supplement upsells, ever** (also a trust red line — `STRATEGY.md`).
5. **Never render a red/critical number, a "you are at risk of X," or an urgency claim in-app.** Route to the human clinician-first flow; keep results out of email/push.
6. **Never promise a clinician phone call (critical-value flow) unless a real clinician with a real SLA exists to make it.**
7. **Never display or interpret a lab result without confirming the lab supplied a CE-marked IVD from an accredited EU lab.**
8. **Never dilute or remove the wellness/not-a-diagnosis disclaimers** — including via generated AI narration. The AI narrates; deterministic rules decide; the AI may never invent a threshold, name a condition, or give advice.

If a feature can only be described by breaking one of these, it is a medical device and needs the CE-mark route — stop and get regulatory advice first.

---

## 7. Best-estimate risk verdict

> **Overall MDR/IVDR risk for the current app, under the current wellness framing: LOW.**

Rationale: the product's **intended purpose is general wellness/fitness**, and the software is architected to **stay on the correct side of every device verb** — baseline-relative scores (not diagnosis), bounded/decaying blood modulation that only shifts a wellness score (not clinical interpretation), flagged/critical values deliberately **removed from the software** and handed to a human, no red numbers, and a documented ON/OFF fallback to demote blood to pure context. The test kit's IVD obligation sits with the accredited lab, not Arcaevo. This is a deliberately, defensibly wellness product.

**What is NOT low, and why it's separate from the device question:**
- **Clinical governance** (mock clinician / auto-review) — **HIGH** until a real IMC clinician exists (paid-tier gate). This is a fraud/safety issue, not strictly MDR, but it is the thing most likely to cause real harm and reputational/legal damage.
- **The "biological age" copy string** and any future **generated narration** — **MEDIUM drift risk** until reworded/reviewed, because they are where a device claim can slip in unnoticed.

**What would flip the whole product INTO medical-device territory (any one of these):**
1. **Marketing/claims drift** — the site, App Store, or generated copy starting to say the product detects/diagnoses/monitors/predicts/prevents a **disease** (by far the most likely trigger, and the cheapest to avoid).
2. **Blood → prescription** — biomarker-driven prescriptive training/supplement/treatment instructions.
3. **In-app diagnosis** — the software interpreting bloods or wearables to name a condition or state a risk of disease (this also pulls in IVDR for the blood side).
4. **Rendering clinical alarms** — showing critical values, red numbers, or "you are at risk" instead of routing to a human.
5. **Presenting automated output as clinical review** — auto-diagnosis dressed as a clinician note.

**Recommended standing action:** keep a **one-page MDR/IVDR intended-purpose self-assessment on file** (this document is its backbone) stating *"intended purpose = general wellness; not a medical device; rationale as above,"* dated and refreshed on any material change — so that if the HPRA, DPC, a notified body, or Apple asks, Arcaevo has a documented position rather than an improvised one. Refresh it specifically when: **generated narration ships, the lab goes live, cycle features ship, or any new health claim is drafted.**

---

_Practical guidance only, not legal or regulatory advice. Have an MDR/IVDR-competent professional review this before relying on it, and before any material change to claims or the blood-scoring behaviour._
