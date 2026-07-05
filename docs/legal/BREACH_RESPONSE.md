# Personal-Data Breach Response Runbook — DRAFT

> **DRAFT — prepared for review by a Data Protection Officer / solicitor before reliance. Not legal advice.**
>
> First-draft incident runbook for a personal-data breach under GDPR Art. 33 (notify the DPC) and Art. 34 (notify affected individuals). Because Arcaevo processes **special-category health data**, the bar for "high risk to individuals" is low — assume most confirmed breaches of health data are notifiable. Fill the **[TBD]** contact fields before any real user exists.

---

## 0. Pre-incident checklist (complete BEFORE real users)

- [ ] **Controller of record:** **Codú Limited** (interim controller for the trial) — the entity that notifies the DPC and data subjects. Confirm CRO number on file.
- [ ] **Incident lead** named: [TBD — founder, Niall Maher, for Codú Limited]
- [ ] **DPO / privacy contact** named + reachable: [TBD] (`privacy@arcaevo.health` per `legal.ts` — reconcile against the `arcaevo.com` SES sending domain and the interim `niall@codu.ie`; pick one contact and align all docs — see `RECORDS_OF_PROCESSING.md`)
- [ ] **DPC breach-notification portal** account/route confirmed: the Irish Data Protection Commission **Breach Notification Form** at forms.dataprotection.ie (verify current URL) — know how to reach it under time pressure
- [ ] **Cyber / data-breach insurer** + 24/7 incident hotline: [TBD] (strongly advised for a health-data controller — `LAUNCH_READINESS.md` §7 Q14)
- [ ] **Solicitor** (data-protection) on call: [TBD]
- [ ] **Processor emergency contacts** listed: MongoDB Atlas, Vercel, EU ESP, PostHog, (paid) Stripe/LGC (`SUBPROCESSORS.md`)
- [ ] **Clinical-ops partner** contact (for any breach touching clinical review / critical values): [TBD]
- [ ] **This runbook** + the incident log template stored somewhere reachable if the primary systems are down
- [ ] **Art. 30 register, DPIA, retention schedule** on file (they are the context a regulator asks for)

---

## 1. What counts as a breach

A "personal data breach" = any **breach of security leading to accidental or unlawful destruction, loss, alteration, unauthorised disclosure of, or access to** personal data (Art. 4(12)) — it is **not** only a hack. Examples relevant here:
- Unauthorised access to member health data (e.g. via the **shared admin password** — `MOCKED_APIS.md` §3; a top gap, see `ADMIN_AUTH_OPTIONS.md`).
- A misconfigured Atlas/Vercel making health data public; leaked `SESSION_SECRET`/`ADMIN_PASSWORD`/`CRON_SECRET`/API keys.
- A processor's breach (Atlas, Vercel, ESP, PostHog, or a paid-tier lab/Stripe) — **a processor must notify Arcaevo without undue delay** (Art. 33(2)); their clock feeds yours.
- Health values sent to the wrong recipient (email/share misdirection); lost/stolen unlocked device with a live session.
- Erasure failure that unlawfully retains data (a compliance failure; assess whether it is also a breach).

---

## 2. The 72-hour clock (Art. 33)

**The clock starts when Arcaevo becomes *aware* that a breach has (likely) occurred — not when it is fully understood.** You have **72 hours** to notify the DPC unless the breach is **unlikely to result in a risk** to individuals. Given health data, treat "no risk" as the rare exception and document the reasoning if you claim it. If full details aren't ready in 72h, **notify in phases** (Art. 33(4)) — an initial notification with what you know, then updates.

```
Aware ──► Triage (hours) ──► Risk assessment ──► Decision
                                                   ├─ Notifiable to DPC? ──► ≤72h DPC notification (phased if needed)
                                                   └─ High risk to individuals? ──► notify data subjects "without undue delay" (Art. 34)
```

---

## 3. Triage & severity flow

**Step 1 — Contain (immediately).**
- Revoke sessions / rotate secrets (`SESSION_SECRET`, `ADMIN_PASSWORD`, `CRON_SECRET`, Stripe/webhook/ESP keys). Session revocation is a delete on the `sessions` collection (`revokeSessions`); admin/member access can be cut fast.
- Isolate the affected component; if a processor is the source, open their incident channel.
- **Preserve evidence before changing anything you don't have to** (see §5).

**Step 2 — Classify severity.**

| Factor | Low | Medium | High |
|---|---|---|---|
| Data type | Ordinary PII (email, name) | Identity + membership | **Health / biomarker / cycle data** |
| Volume | 1–few | Tens | Many / whole collection |
| Identifiability | Pseudonymised/hashed only | Directly identifiable | Identifiable **+ health** |
| Exposure | Internal, contained | Limited external | Public / unknown recipients |
| Mitigation | Data was encrypted/erased/hashed | Partial | None; live credentials leaked |

Any row landing in **High** for health data ⇒ treat as **notifiable to the DPC and likely notifiable to individuals**.

**Step 3 — Decide (record the reasoning either way).**

- **Notify DPC (Art. 33)?** Yes unless *unlikely to result in a risk*. Health data → default **yes**.
- **Notify individuals (Art. 34)?** Yes if *high risk to their rights and freedoms*. Exceptions: (a) data was **unintelligible** to the recipient (e.g. strong encryption / only hashed tokens leaked — plausible here given hashed sessions/passwords), (b) subsequent measures ensure the high risk is no longer likely, or (c) it would require disproportionate effort (then a **public communication** instead). Document which applies.

---

## 4. Notification decision tree

```
Confirmed breach?
├─ No (near-miss)  ──► Log it internally (§5). No external notice. Fix root cause.
└─ Yes
   ├─ Unlikely to risk individuals?  (rare for health data; justify in writing)
   │     └─ Yes ──► Log + internal record only (Art. 33(5)). Keep evidence.
   └─ Risk to individuals?
         ├─ Notify DPC ≤72h from awareness (phased if needed).
         └─ High risk to individuals?
               ├─ No  ──► DPC only.
               └─ Yes ──► Also notify affected data subjects without undue delay,
                          in plain language, unless an Art. 34(3) exception applies.
```

### DPC notification — minimum content (Art. 33(3))
1. Nature of the breach; categories & **approximate number** of data subjects and records.
2. Name + contact of the DPO / point of contact.
3. Likely consequences.
4. Measures taken / proposed to address it and mitigate harm.

### Data-subject notification — content (Art. 34(2))
- Plain-language description of what happened.
- DPO/contact point.
- Likely consequences.
- Measures taken + concrete advice (e.g. re-authenticate, watch for phishing).
- **Never** include the breached health values themselves in the notice.

---

## 5. Evidence & logging to preserve (Art. 33(5) — mandatory record)

Keep an internal breach record **for every incident, notifiable or not** — the DPC can ask to see it. Capture:
- **Timeline:** when/how detected, when aware, containment actions + timestamps, notification times.
- **Scope:** collections/fields involved, member ids affected (from erasure/consent records — but do **not** export health values into the incident file), approximate counts.
- **Technical evidence:** relevant logs (Vercel function logs, Atlas access logs, auth/rate-limit records), affected commit/deploy, secrets rotated. **Note:** Arcaevo does **not yet** have an admin access-audit log (a gap — `ADMIN_AUTH_OPTIONS.md`), so admin-side access may be hard to reconstruct; prioritise fixing this.
- **Assessment:** risk classification + the reasoning for the notify / don't-notify decision.
- **Outcome:** root cause, remediation, prevention.

Store the record where it survives the incident (not only in the affected system). Retain per the record-keeping obligation.

---

## 6. Roles (RACI — fill names)

| Action | Owner |
|---|---|
| Declare incident, run the response | Incident lead [TBD] |
| Legal/notification decisions, DPC liaison | DPO / privacy contact [TBD] + solicitor [TBD] |
| Containment, secret rotation, forensics | Engineering [TBD] |
| Processor coordination | Incident lead |
| Member communications | Incident lead + solicitor sign-off |
| Clinical safety (if clinical data / critical values involved) | Clinical-ops partner [TBD] |
| Insurer notification | Incident lead [TBD] |

---

## 7. Post-incident
- Root-cause analysis; ship the fix; update the DPIA + this runbook if the risk picture changed.
- If a processor caused it, review their DPA and remediation.
- Verify the Art. 33(5) record is complete and filed.

## Open items for the DPO/solicitor
1. Fill every **[TBD]** contact and confirm the **DPC portal** route.
2. Confirm **cyber-insurance** is in place before real users.
3. Prioritise an **admin access-audit log** so breach forensics are possible (`ADMIN_AUTH_OPTIONS.md`).
4. Pre-draft the **DPC notification** and **member-notification** templates so they're ready under the 72-hour clock.
5. Agree the standing position that **health-data breaches are notifiable by default**.
