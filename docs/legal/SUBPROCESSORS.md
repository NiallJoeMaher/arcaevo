# Sub-processor Register & DPA Tracking Checklist — DRAFT

> **DRAFT — prepared for review by a Data Protection Officer / solicitor before reliance. Not legal advice.**
>
> First-draft register of every third party the code integrates or plans to, generated from `docs/MOCKED_APIS.md`, the CDK/infra decisions in `docs/BUILD_STATE.md`, and the vendor adapters under `apps/web/src/lib/vendors/`. The public-facing version is `apps/web/src/content/legal.ts` ("Sub-processors" doc) — **that page currently describes categories, not named vendors, and the contracts behind it do not yet exist.** This register is the internal source of truth to close that gap.
>
> **Controller (interim): Codú Limited** — DPAs for the trial are signed **by Codú Limited as controller**. When a dedicated entity is formed on monetisation, DPAs must be **novated/re-signed** to the new controller. Data-protection / sub-processor-change contact: **`privacy@arcaevo.com`** (role-based, monitored — see [`../EMAIL_ADDRESSES.md`](../EMAIL_ADDRESSES.md)). **No DPO is appointed at trial scale** — see [`DPO_NOT_REQUIRED_MEMO.md`](./DPO_NOT_REQUIRED_MEMO.md); do not label the contact "DPO". `SES` (AWS) appears as an email-sending option (`infra/cdk/SES_SETUP.md`, EU `eu-west-1`); if used instead of / alongside Scaleway/Postmark, **AWS is a US-parented processor → an AWS DPA + SCCs are required** (add it to the register below).

## How to read this

- **Role** — *Processor* (acts only on Arcaevo's instructions, needs an Art. 28 DPA) vs *Controller* (decides its own purposes for some data — a DPA alone is not enough; understand the joint/independent relationship) vs *Not a processor* (e.g. on-device platform).
- **DPA status** — ☐ not signed / ☑ signed. **All are ☐ today.**
- **Transfer basis** — Adequacy (EU/EEA), or SCCs (Standard Contractual Clauses) where a vendor is a non-EU entity even if data is EU-hosted.
- **Live in code?** — is the integration actually wired, or planned.

---

## The register

### 1. MongoDB Atlas — database hosting & storage
| | |
|---|---|
| Data shared | **All** personal + special-category data (accounts, memberships, biomarker readings, wearable aggregates, consents, sessions, uploads) |
| Role | **Processor** |
| Region | eu-west-1 (Ireland) — target per `MOCKED_APIS.md` §9; CDK `region: eu-west-1` (`infra/cdk`) |
| Live in code? | Prod target; local dev uses docker Mongo (`mongodb://localhost:27019/arcaevo`). `MONGODB_URI` env |
| Transfer basis | EU-hosted; MongoDB Inc. is US-parented → **SCCs required** in the DPA even for EU data |
| DPA status | ☐ **MUST SIGN before real users.** MongoDB offers a standard DPA + SCCs |
| Open items | Confirm cluster pinned to eu-west-1; confirm **backups/PITR are also EU-region**; enable encryption at rest; least-privilege DB user; IP allow-list |

### 2. Vercel — web hosting & serverless functions
| | |
|---|---|
| Data shared | All request/response data transiting the app (accounts, health data in flight, session cookies) |
| Role | **Processor** |
| Region | dub1 / fra1 (EU) — architecture decision, `BUILD_STATE.md`. Cron runs the erasure drain (`apps/web/vercel.json` `0 3 * * *`) |
| Live in code? | Primary hosting path; Dockerfile/compose kept as AWS escape hatch (CLAUDE.md) |
| Transfer basis | EU-hosted; Vercel Inc. is US → **SCCs required** |
| DPA status | ☐ **MUST SIGN before real users** |
| Open items | **Confirm Functions actually execute in dub1/fra1** (region pinning), not a US default; confirm log retention region; set `CRON_SECRET` |

### 3. Stripe — payments
| | |
|---|---|
| Data shared | Customer email/name, billing address, DOB (indirectly at checkout), card data (Stripe-side, never stored by Arcaevo), subscription/payment metadata |
| Role | **Processor AND independent/joint Controller.** Stripe acts as a processor for payment instructions but is an **independent controller** for parts of the payment data it must process for its own fraud-prevention, regulatory and network-compliance obligations. Reflect both in the contract, not just an Art. 28 DPA |
| Region | Stripe is US-headquartered (Irish/EU entity available: Stripe Payments Europe Ltd — Dublin) |
| Live in code? | REAL (test-mode wired) behind a mock fallback — `apps/web/src/lib/vendors/stripe.live.ts`, `stripe-config.ts`; webhook signature verification real when `STRIPE_WEBHOOK_SECRET` set (`MOCKED_APIS.md` §2) |
| Transfer basis | Contract with **Stripe Payments Europe Ltd** for EU establishment; **SCCs** for any onward US transfer |
| DPA status | ☐ **MUST SIGN before taking real payments** (paid-tier gate) |
| Open items | Use the **EU Stripe entity**; enable Stripe Tax + IE VAT; restricted `rk_` server key; verify Apple Pay domain; card data is PCI-scoped to Stripe |

### 4. EU Email Service Provider (ESP) — transactional email
| | |
|---|---|
| Data shared | Email address, name, transactional content (magic links/codes, receipts, reminders, closure confirmation) — **never health values / result numbers** by design |
| Role | **Processor** |
| Region | EU — candidates: **AWS SES** (`eu-west-1`; setup already scripted in `infra/cdk/SES_SETUP.md`, sending domain `arcaevo.com` — **US-parented → AWS DPA + SCCs required**), **Scaleway TEM** (French processor, EU-resident, adequacy — no transfer), or **Postmark EU** (EU data region + DPA, US parent → SCCs). **TBD — not chosen.** SES is the lowest-friction path given the existing CDK stack; Scaleway is the cleanest transfer posture. |
| Live in code? | Adapter ready (`apps/web/src/lib/vendors/email.smtp.ts`, env-driven auth/TLS) — swapping in a real ESP is a config change; today only Mongo `outbox` + local MailHog |
| Transfer basis | Prefer an EU-resident ESP (Scaleway = adequacy, no transfer). Postmark (US parent) → **SCCs** |
| DPA status | ☐ **MUST SIGN before real users** (magic link is the only way in — health-adjacent PII crosses the ESP) |
| Open items | Choose vendor; sign DPA; point `SMTP_*` env at it; decide whether the outbox stays as an audit log |

### 5. PostHog EU — product analytics
| | |
|---|---|
| Data shared | Product-usage / event data. **No health data ever** (invariant). Off by default |
| Role | **Processor** |
| Region | EU — `https://eu.i.posthog.com` hardcoded (`apps/web/src/lib/analytics.ts`); only active when `NEXT_PUBLIC_POSTHOG_KEY` set |
| Live in code? | Stubbed off unless keyed (`MOCKED_APIS.md` §6) |
| Transfer basis | EU ingest host; **confirm the PostHog account/organisation region is EU, not just the ingest URL.** PostHog Inc. is US → SCCs if account is US-region |
| DPA status | ☐ **SIGN before enabling analytics with real users**; decide whether analytics is on at launch or stays off |
| Open items | Set a retention window; confirm cookie-consent gating (analytics "off until you accept", `legal.ts`) |

### 6. LetsGetChecked — finger-prick blood-test lab **[PLANNED]**
| | |
|---|---|
| Data shared | Member identity, DOB, address, sample data, biomarker results (special-category health) |
| Role | **Processor** (lab acting on Arcaevo's instructions) — though the lab may have its own controller obligations for accredited testing records; clarify |
| Region | EU labs intended (`legal.ts` "ISO-accredited EU laboratories") |
| Live in code? | **MOCKED** — no API contract signed; shapes are guesses (`apps/web/src/lib/vendors/letsgetchecked.mock.ts`, `MOCKED_APIS.md` §1) |
| Transfer basis | Confirm EU processing + SCCs if any non-EU element |
| DPA status | ☐ **MUST SIGN before any real lab test** (paid-tier gate) |
| Open items | Partner agreement; real webhook signature verification; biomarker-code mapping; **erasure must reach the lab's copy** (`MOCKED_APIS.md` §17); the lab is also a health-data controller for its own regulated records — pin down the relationship |

### 7. Mobile phlebotomy vendor (Dublin, Performance venous draws) **[PLANNED]**
| | |
|---|---|
| Data shared | Member identity, address, appointment data, potentially health context |
| Role | **Processor** (and a healthcare provider with its own professional obligations) |
| Region | Ireland |
| Live in code? | **NOT MODELLED** — `TestOrder` supports `type:"venous"` but no vendor adapter exists (`MOCKED_APIS.md` §10) |
| Transfer basis | EU/Ireland — adequacy |
| DPA status | ☐ **MUST SIGN before any venous-draw booking** (paid-tier gate) |
| Open items | Select vendor; DPA; scope-of-practice + clinical governance |

### 8. EU OCR / vision extraction vendor (bloodwork upload) **[PLANNED]**
| | |
|---|---|
| Data shared | Uploaded lab documents (photo/PDF) containing special-category health data |
| Role | **Processor** |
| Region | Must be **EU-hosted** |
| Live in code? | **MOCKED and gated OFF in production** — `ai-extraction.mock.ts` fabricates values; `ALLOW_MOCK_EXTRACTION` gate keeps it off for real users, who are routed to manual entry (`MOCKED_APIS.md` §11, `env.ts`) |
| Transfer basis | EU-hosted; SCCs if non-EU vendor |
| DPA status | ☐ **MUST SIGN before enabling real photo/PDF extraction**; contractually prohibit training on customer data |
| Open items | Choose EU vendor; original-file storage (user-deletable); human-in-the-loop for low-confidence reads |

### 9. LLM / AI narration provider **[PLANNED]**
| | |
|---|---|
| Data shared | Deterministic rule outputs turned into plain-English narration. **Must be constrained so no raw health identifiers/values are sent unnecessarily**; today insights/chat are canned demo content (`STRATEGY.md` §2) |
| Role | **Processor** |
| Region | Choose an **EU-region** endpoint |
| Live in code? | Not wired for real generation yet (`legal.ts` "AI narration" describes the intended posture: prohibited from training on data, cannot set thresholds) |
| Transfer basis | EU endpoint + SCCs as needed |
| DPA status | ☐ **SIGN before shipping real generated narration**; zero-retention / no-training terms |
| Open items | Data-minimise the prompt; review generated copy against the wellness/MDR line (`LAUNCH_READINESS.md` §2) |

### 10. Apple — HealthKit & platform — **NOT a processor for on-device HealthKit**
| | |
|---|---|
| Data shared | HealthKit data stays **on the user's device** under the user's own Apple/iCloud relationship; Arcaevo reads it locally and syncs only 4 daily aggregates to its own backend |
| Role | **NOT a sub-processor for on-device HealthKit data.** Apple is the user's platform provider; it does not process HealthKit data on Arcaevo's behalf. (Apple *is* a processor/controller in other capacities — App Store distribution, push via APNs if used, Sign in with Apple later — assess those separately if/when used) |
| Region | On-device |
| Live in code? | REAL read-only HealthKit (`apps/ios/Arcaevo/Health/HealthKitProvider.swift` — `requestAuthorization(toShare: [], read:)`, no write types); cycle access is a separate later ask |
| Transfer basis | N/A on-device |
| DPA status | N/A for on-device HealthKit. **Apple Developer Program Agreement + App Store terms govern distribution.** HealthKit data must not be used for advertising and must match declared purpose strings |
| Open items | Keep purpose strings accurate to what is read; App Privacy labels declare health data as linked to the user |

---

## The "must sign a DPA before real users" list — explicit

**Basic / Fusion tier (wearables + user-uploaded bloods) — required BEFORE any real user:**
- ☐ **MongoDB Atlas** (all data) — with SCCs
- ☐ **Vercel** (all data) — with SCCs
- ☐ **EU ESP** (magic-link delivery = the only way in) — vendor must be chosen first
- ☐ **PostHog EU** — before analytics is enabled with real users (or keep analytics off at launch)

**Additionally required BEFORE paid blood-testing tiers:**
- ☐ **Stripe** (EU entity) — controller/processor mix; before real payments
- ☐ **LetsGetChecked** (lab) — before any real lab test; erasure must reach the lab copy
- ☐ **Mobile phlebotomy vendor** — before any venous draw
- ☐ **EU OCR vendor** — before enabling real photo/PDF extraction
- ☐ **LLM narration provider** — before shipping real generated narration

**Not a DPA item:** Apple (on-device HealthKit) — governed by the Developer Program Agreement, not an Art. 28 DPA.

## Cross-cutting open items for the DPO/solicitor
1. Every DPA must **list the vendor's own sub-processors**, guarantee EU processing (or SCCs), and **support Arcaevo's erasure obligations** (deletion propagates to the processor).
2. Update the public sub-processor page (`legal.ts`) to name the actual vendors once chosen, and offer the change-notification subscription it already promises.
3. Confirm no processor silently egresses to the US (region pinning verified for Atlas, Vercel functions, PostHog account).
4. Maintain this register as the living Art. 30 sub-processor record; date every DPA on signature.
