# DPO decision brief — Arcaevo / Codú Limited

> **Practical guidance, not legal advice.** This is a briefing to take to an Irish solicitor or a privacy/DPO consultant so we can settle the Data Protection Officer question before real users. Interim controller: **Codú Limited**. Written 2026-07-05. Pairs with `docs/legal/DPIA.md`.

## Why this matters for us specifically

We process **special-category personal data** (GDPR Article 9): health and biometric data — Apple Watch vitals (HRV, resting HR, sleep, VO₂max, etc.), at-home blood biomarkers, subjective daily health check-ins, and optionally menstrual/cycle data. This is the most heavily regulated category of personal data, and our regulator — Ireland's **Data Protection Commission (DPC)** — is one of the more active in the EU.

A **DPO is a specific statutory role** (GDPR Art. 37–39), not just "whoever handles privacy." A DPO independently advises on and monitors compliance and is the contact point for the DPC and for data subjects. Whether we're legally required to appoint one turns on the test below.

## The legal test — when is a DPO mandatory (Art. 37(1))?

Three triggers; two are squarely relevant to us:
- **(b)** core activities require *"regular and systematic monitoring of data subjects on a large scale"* — continuous wearable monitoring is exactly this pattern; and
- **(c)** core activities consist of *"processing on a large scale of special categories of data"* (Art. 9 health data) — this is our core activity.

Both point toward "DPO likely required." **The only thing holding it off is the "large scale" threshold.**

## The crux: "large scale"

GDPR gives no number. EDPB/WP29 guidance weighs: number of data subjects (absolute and as a proportion of the population), the volume and range of data, the duration/permanence of the processing, and its geographic extent.

- At **<10 trial users**, we're plausibly **not "large scale" yet**.
- **But** three things make me cautious: (1) health data is inherently sensitive, so regulators lean conservative; (2) our **core activity / business model *is* large-scale continuous health monitoring** — the DPC may assess the nature and intended scale of the activity, not just today's headcount; (3) the moment we scale past the trial the trigger flips, and a DPO has to be **already appointed**, not appointed reactively.

## My concerns (the honest version)

1. **This isn't my call to assert.** Declaring "no DPO required" for an Art. 9 health-monitoring company — even at trial scale — is a legal judgment I'm not qualified to make for you. Getting it wrong is a supervisory-authority finding, not just a possible fine.
2. **Even if not strictly mandatory at trial scale, a DPO is *recommended*** by the EDPB for this kind of processing, and it's a strong trust/governance signal to users and partners.
3. **"No DPO" still has obligations.** If we don't appoint one, GDPR expects us to (a) **document the reasoning** — a dated "DPO not required" assessment — and (b) still name an accountable **privacy contact**. We can't have nobody: the privacy policy and consent flow must give data subjects someone to reach.
4. **Independence / conflict of interest (Art. 38(6)).** A DPO must be independent and cannot be someone who *decides the purposes and means* of the processing. That most likely rules out **Niall (as founder/controller) being the DPO** for the processing he directs. So "I'll be the DPO" probably doesn't work.
5. **Practicality/cost.** A full-time DPO is overkill for a trial. The usual pragmatic answer for Irish health-tech is an **outsourced / fractional DPO ("DPO-as-a-service")** — independent, experienced, a few hundred €/month — which also solves the independence problem.

## The questions we need answered (for the solicitor / privacy consultant)

1. Given our core activity is a wellness app processing Apple Watch vitals + finger-prick blood biomarkers (Art. 9 data) with continuous, systematic monitoring, are we caught by **Art. 37(1)(b)/(c)** — is a DPO **mandatory** — (a) at the current **<10-user closed trial**, and (b) at **intended launch scale** (hundreds–thousands of Irish users)?
2. How does the **DPC interpret "large scale"** for Art. 9 health data in practice — by current user numbers, or by the nature/intended scale of the core activity? Is there a rough threshold they apply?
3. If a DPO is **not** mandatory at trial scale, **what must we document** to defend that position, and **who should sign** that assessment?
4. Can we use an **outsourced / fractional DPO** (DPO-as-a-service) for the trial and early growth? Can you **recommend providers** experienced with Irish health-tech, and roughly what does it **cost**?
5. **Independence:** can any founder/employee who decides how we process data also be the DPO, or must it be someone without that conflict? Is there anyone internal who could legitimately hold it?
6. If we appoint a DPO, must we **notify their contact details to the DPC** and **publish** them (e.g., in the privacy policy + in-app)?
7. Is there any **downside to appointing early** (even voluntarily) — i.e., does it lock us into Art. 38/39 obligations (independence, resourcing, tasks) we'd otherwise not have at trial scale?
8. **Linked question — Art. 36 prior consultation:** does our processing require **prior consultation with the DPC** before launch (triggered if the DPIA shows high residual risk we can't fully mitigate)? The DPO decision and the DPIA sign-off are connected — can you review `docs/legal/DPIA.md` alongside this?
9. Given **Codú Limited is the interim controller** and a dedicated entity may be formed on monetisation, should the DPO (or the "not required" assessment) sit at **Codú Limited level now and novate later**, or wait for the dedicated entity?

## What each answer changes — and what I'll do in code/docs

- **If mandatory (now or at launch):** I'll wire the DPO's name + contact into the **privacy policy, consent screens, Records of Processing, breach runbook**, and the app's **Data & Privacy** screen; and we front-load appointing one (likely outsourced) so it's not the launch critical path.
- **If not required at trial scale:** I'll draft the dated **"DPO not required" assessment memo** for your solicitor to sign, name a **privacy contact** instead, and set an explicit **trigger** (a user-count / launch milestone) at which we appoint one — so it doesn't get forgotten when we scale.
- **Either way:** there must be a **named, reachable privacy contact before the first real user**, because the consent flow and privacy policy have to give data subjects someone to contact. Tell me the email to use (`privacy@arcaevo.com` once SES verifies the domain, or `niall@codu.ie` interim) and I'll set it everywhere.

## Related governance to settle in the same conversation (ask once)

- **DPIA sign-off** — who reviews and signs `docs/legal/DPIA.md` (a DPO would normally advise on this).
- **Art. 36 prior consultation** — see Q8; depends on the DPIA's residual-risk rating.
- **EU representative (Art. 27)** — *not* needed because the controller (Codú Limited) is established in Ireland/the EU. Confirm.
- **Lead supervisory authority** — the DPC (Ireland), given establishment here. Confirm no cross-border complication.
