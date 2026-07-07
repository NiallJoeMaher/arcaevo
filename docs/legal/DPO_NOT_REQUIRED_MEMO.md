# DPO "not required (yet)" assessment — Arcaevo / Codú Limited

> **DRAFT — for solicitor / accredited-privacy-professional sign-off. Not legal advice.**
>
> This is a dated, documented assessment of whether a statutory Data Protection Officer (GDPR Art. 37) must be appointed **at the current closed-trial scale**. It exists to satisfy the GDPR **accountability** principle (Art. 5(2)): where a controller decides *not* to appoint a DPO for processing that plausibly engages Art. 37(1), it should be able to **show the analysis behind that decision**. It is written to be taken to an Irish solicitor or an accredited privacy professional for review and sign-off. It pairs with [`DPO_BRIEF.md`](./DPO_BRIEF.md) (Q3) and [`DPIA.md`](./DPIA.md).
>
> **This memo is expressly scale-dependent and time-limited.** It concludes only that a DPO is *arguably not mandatory at present trial scale* — **not** that one is never required. A DPO **will** be appointed at launch scale (see §7 Review triggers).

---

## 1. Metadata

| Field | Value |
|---|---|
| Assessment date | **2026-07-05** |
| Controller (interim) | **Codú Limited**, Dublin, Ireland (CRO number — **TODO: confirm and record**) — interim data controller for the early closed trial; a dedicated entity may be formed on monetisation, at which point this assessment is re-made for that entity |
| Prepared by | Niall Maher, founder, for Codú Limited |
| Approved by | *(founder sign-off, §8)* — then **countersigned by a solicitor / accredited privacy professional before reliance** |
| Regulator / lead SA | Ireland — Data Protection Commission (DPC); controller established in Ireland, EU-only processing |
| Status | **DRAFT — unsigned. Do not rely on until countersigned.** |
| Review by | Before any public availability; before onboarding beyond the set user count; on any material change (see §7) |

**Naming caution.** No contact, address or role in Arcaevo's user-facing surfaces or documents is labelled "DPO". Under GDPR Art. 37(7) and WP243 (Guidelines on Data Protection Officers), a controller that publicly designates a "DPO" may be treated as having **voluntarily appointed** one — which triggers the full Art. 37–39 regime (independence, resourcing, tasks, DPC notification and publication) that this assessment concludes is not yet mandatory. The accountable contact is therefore named as a **"privacy contact" / "privacy team" / "data-protection enquiries"** at **`privacy@arcaevo.com`**. The address `dpo@arcaevo.com` is reserved and **not advertised** until a DPO is actually appointed.

---

## 2. Description of the processing

**Nature.** Arcaevo is a wellness membership that fuses Apple Watch / Apple Health vitals with at-home finger-prick blood biomarkers into baseline-relative insights. It is positioned as **wellness, not diagnosis** (see [`MEDICAL_DEVICE_POSITIONING.md`](./MEDICAL_DEVICE_POSITIONING.md)).

**Special-category data (Art. 9).** The processing is core-to-purpose **health and biometric** data:
- **Apple Watch / Apple Health vitals** — resting heart rate, heart-rate variability, sleep, VO₂max, activity and related metrics the member chooses to connect (only a minimal set is synced server-side).
- **Blood biomarkers** — at-home finger-prick test results and the biomarkers measured.
- **Subjective daily health check-ins** — self-reported wellbeing / readiness inputs.
- **Optional menstrual / cycle data** — off by default; stays on-device unless the member explicitly enables cycle-aware baselines.

Ordinary personal data (account: name, email, date of birth, delivery address; usage/security telemetry) is also processed but is not the driver of the Art. 37 analysis.

**Sources.** Directly from the data subject (account details, check-ins, consent choices); from the member's device / Apple Health (with explicit permission); from the member's own blood sample processed by an accredited laboratory (paid-tier; not yet live with real samples).

**Purposes.** To generate the member's baselines, insights and verdicts; to enable clinician sign-off of results (paid tier); optionally, de-identified research to improve rules/ranges (opt-in, off by default). Lawful basis for health/biometric data is **explicit consent, Art. 9(2)(a)**, server-enforced and versioned, with instant withdrawal.

**Scale today.** **Closed trial, currently fewer than 10 users.** No public availability; no open sign-up. Real blood samples and generated clinician review are not yet live.

---

## 3. The Art. 37(1) test — is a DPO mandatory?

A DPO is mandatory where any of Art. 37(1)(a)–(c) applies. Two are squarely relevant here, and this memo **concedes both on the "core activity" and "monitoring" limbs** — the decision turns solely on **"large scale"**:

- **Art. 37(1)(b)** — core activities require *"regular and systematic monitoring of data subjects on a large scale"*. **Conceded** that continuous wearable ingestion is *regular and systematic monitoring*, and that it is a *core activity* (it is the product). The open element is **"large scale"**.
- **Art. 37(1)(c)** — core activities consist of *"processing on a large scale of special categories of data"* (Art. 9). **Conceded** that Art. 9 health/biometric processing is a *core activity*. Again, the open element is **"large scale"**.
- Art. 37(1)(a) (public authority/body) — **not applicable**; Codú Limited is a private company.

So the entire question reduces to: **is the current processing "large scale"?** If yes, a DPO is mandatory now. If no, it is not mandatory *at this scale* — but the concessions above mean the trigger flips the moment scale crosses the threshold, so a DPO must be appointed *proactively* at that point, not reactively.

---

## 4. "Large scale" — the four-factor (WP243) analysis

GDPR gives no numeric threshold. WP243 (endorsed by the EDPB) and Recital 91 direct controllers to weigh, in particular, four factors. Applying them to the trial today:

| Factor (WP243) | Application to Arcaevo at trial scale | Direction |
|---|---|---|
| **1. Number of data subjects** — absolute, and as a proportion of the relevant population | **Fewer than 10** individuals; a closed, invite-only trial; a negligible fraction of the Irish population. WP243's own examples of "large scale" (e.g. a hospital, a national insurer, a chain's customer base, an ISP's subscribers) are **orders of magnitude larger**; its "not large scale" example is an *individual professional* processing patient data. Ten trial users sits at the small end. | **Below threshold** |
| **2. Volume / range of data** | The *range* is broad and sensitive (multi-parameter continuous vitals + biomarkers + check-ins). This is the factor that cuts **against** us — health data is inherently sensitive and the data is rich per subject. But WP243 weighs volume/range *alongside* the number of subjects, not instead of it; high per-subject richness across <10 people is still a small aggregate. | **Cuts against (mitigated by small N)** |
| **3. Duration / permanence** | Processing is **continuous and ongoing** for each active member (a monitoring relationship, not a one-off). This factor leans toward "large scale" in *character*, but its weight is bounded by the tiny cohort and the short elapsed trial duration. | **Cuts against (mitigated by small N + short elapsed time)** |
| **4. Geographic extent** | Single jurisdiction (**Ireland**), EU-only hosting (`eu-west-1`); no cross-border or pan-EU processing. | **Below threshold** |

**Weighing.** Two factors (number of subjects; geographic extent) point clearly **below** "large scale". Two (range/sensitivity; permanence) point toward it in *character* but are heavily discounted by the fact that they apply to **fewer than 10 people over a short, closed trial**. On balance, the current processing is **arguably not "large scale"** within the meaning of Art. 37(1)(b)/(c).

**Honest counter-weight (why this is a *position*, not a certainty).** (a) Regulators, and the DPC in particular, lean **conservative** on Art. 9 health data. (b) A supervisory authority may look to the **nature and intended scale of the core activity** — which *is* large-scale continuous health monitoring — rather than to today's headcount alone. (c) The EDPB **recommends** a DPO for this kind of processing even where not strictly mandatory. These are the reasons this memo is framed as *defensible*, kept **time-limited**, and paired with hard review triggers — not as a settled "no DPO needed" conclusion.

---

## 5. "No DPO" does not mean "no accountability"

Choosing not to appoint a statutory DPO at trial scale does **not** remove obligations. The following remain in place and are recorded here:

- **A named, reachable privacy contact** stands in for data subjects and the DPC: **`privacy@arcaevo.com`** — role-based, monitored, wired into the privacy policy, consent flow (`/consent`, iOS onboarding), the account Data & privacy screen (`/account/privacy`, iOS), the contact page, and every legal document. **DSR response deadline: ~one month** (Art. 12(3)); the mailbox must be actively monitored so this is not missed (mailbox setup: [`../EMAIL_ADDRESSES.md`](../EMAIL_ADDRESSES.md)).
- **This documented assessment** (accountability, Art. 5(2)).
- **A DPIA** for the special-category processing ([`DPIA.md`](./DPIA.md)) — effectively expected for Art. 9 processing at any meaningful scale under DPC guidance.
- **The Art. 30 register**, retention schedule, sub-processor register and breach runbook (this directory).

**Independence note (Art. 38(6)).** A key reason *not* to hand a founder the "DPO" title is that a DPO must be **independent** and cannot be a person who **determines the purposes and means** of the processing. The founder directs the processing, so the founder **cannot** validly be the DPO. When a DPO is appointed (see §7), the pragmatic, independence-clean route is an **outsourced / fractional DPO** ("DPO-as-a-service").

---

## 6. Conclusion

On the WP243 four-factor analysis, and **expressly limited to the current closed trial of fewer than 10 users**, a statutory DPO is **arguably not mandatory at present scale**. This conclusion is:

- **Scale-dependent** — it rests entirely on the "large scale" limb of Art. 37(1)(b)/(c); the core-activity and regular/systematic-monitoring limbs are conceded.
- **Time-limited** — valid only for the trial phase and subject to the review triggers in §7.
- **Provisional pending sign-off** — a legal judgment about Art. 9 health monitoring should be countersigned by a solicitor / accredited privacy professional before it is relied upon (§8).

Because the trigger flips with scale, a DPO must be **already appointed** at the point of crossing — not appointed reactively afterwards.

---

## 7. Review triggers — reassess (and appoint) at these points

Reassess this memo, and **appoint a DPO (likely outsourced/fractional) before**, any of:

1. **Any public availability / open sign-up** — leaving the closed trial for general availability.
2. **Onboarding beyond a set user count** — **[SET THRESHOLD — e.g. 250 active users; confirm the number with the solicitor/DPC guidance]**; reassess well *before* reaching it so appointment precedes the crossing.
3. **Going live with real blood samples and/or real clinician review at any meaningful volume** — a material change in the nature and volume of Art. 9 processing.
4. **Any material change** to purposes, data categories (e.g. enabling cycle data broadly, new biomarkers), processors, or cross-border transfers — **including enabling the new AI-OCR of blood-report images** (automated transcription of uploaded reports via AWS Bedrock EU; see `DPIA.md` R10). At scale, **large-scale automated processing of special-category data** is a WP243 factor that weighs toward "large scale" and should be **revisited when OCR is enabled and as volume grows** — noted here as a factor to reconsider (not, on its own at trial scale, a conclusion that a DPO is now required).
5. **Formation of a dedicated Arcaevo entity** on monetisation — re-make this assessment for the new controller and migrate/novate accordingly.
6. **DPC guidance or a supervisory-authority signal** indicating a lower "large scale" threshold for health data.
7. **Time-box:** in any event, **review by [DATE — e.g. 6 months from the assessment date]** even absent a trigger.

**Commitment:** a DPO **will be appointed at launch scale.** The reserved `dpo@arcaevo.com` address is provisioned but not advertised until that appointment is made.

---

## 8. Sign-off

| Role | Name | Signature | Date |
|---|---|---|---|
| Prepared by (controller) | Niall Maher, for Codú Limited | ______________________ | 2026-07-05 |
| Approved by (controller) | Niall Maher, for Codú Limited | ______________________ | ____________ |
| Reviewed / countersigned by (solicitor or accredited privacy professional) | ______________________ | ______________________ | ____________ |

*Until the review/countersign row is completed, this memo is an **unsigned draft** and must not be relied upon as a compliance determination.*
