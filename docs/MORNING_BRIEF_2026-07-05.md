# Morning brief — 2026-07-05 (overnight CEO report)

_What I built while you slept, the decisions I made on your behalf, exactly how production-ready we are, and the questions only you can answer. Written for a 5-minute read; deeper detail is linked._

---

## The one-paragraph version

The **daily-engagement layer is built, integrated, verified, and pushed** — Arcaevo now computes a blood-recalibrated Readiness score (the fusion no competitor ships), an all-day Energy gauge, a Vitality Age, a morning felt check-in, the real Apple Watch complications + Lock Screen widgets we'd deferred since Phase 17, and a clinician note on every blood panel. The full app builds clean (4 targets) and the web backend is tsc-clean with 193/193 tests. Separately, I ran a **legal/privacy + production-readiness audit** — the honest verdict is that the *architecture* is unusually strong for this stage (real consent enforcement, real erasure, EU-only by design, correctly on the wellness side of the medical-device line), but a **small internal TestFlight is fine today while strangers' real health data is not yet** — the gaps are operational/legal, not structural, and I'm closing the code-actionable ones now. **You can launch the basic (Fusion) tier without a bloodwork partner** — the clinician/lab gate does not block it. There are **21 questions only you can answer** (legal entity, named clinician, DPAs, insurance) before real users.

---

## 1. What got built (Phase 22 — shipped to branch `phase-22-daily-engagement`)

The work is on a feature branch (I couldn't push to `main` — policy correctly blocks direct-to-main; open a PR from `phase-22-daily-engagement` when you're happy). Commit `27a2f86`.

- **The engines** (`ArcaevoKit`, pure deterministic — AI never touches the maths): Readiness (blood penalties + decay + confidence band + a `Train hard/Rest` decision + honest degraded states), Energy (blood-modulated ceiling + afternoon-dip forecast), Vitality Age (RCV-gated so it only moves when the change beats your own test-noise), plus behaviour-impact learning, wake-time learning, and cycle-phase baselines.
- **HealthKit expanded** from 4 signals to the full set: workouts, active energy, steps, **sleep stages**, respiratory rate, SpO₂, wrist temperature — and **cycle tracking as a separate, opt-in, off-by-default ask** (Article 9 data, never synced unless you turn on cycle-aware baselines). This also fixes an integrity bug: the old onboarding copy claimed we read "Workouts" when the app read none.
- **New iOS screens**: Readiness (with the real 71→62 blood-layer ON/OFF toggle — a transparency feature *and* the regulatory fallback flag), Energy, morning Check-in + per-user behaviour impacts + sick mode, Vitality Age + driver table + the €69 recheck loop (never a supplement), a widgets gallery.
- **Changed iOS screens**: full honest HealthKit primer, 8-toggle notifications, cycle-aware privacy toggle, a signed clinician note on every Results panel, the €69 recheck card, plus a **12-push notification layer** (results never carry a value in the payload; morning readiness is passive at your learned wake time; quiet hours 22:00–07:00).
- **Apple Watch**: readiness/energy/check-in/vitality/live-workout screens, and the **real WidgetKit complications + iOS Lock Screen widgets** that were deferred in Phase 17 — via an App Group snapshot store so the wrist matches the phone.
- **Web backend**: a signed clinician note on every reviewed panel (Dr. Nolan persona for now), written at admin sign-off, seeded, +13 tests.

**Verification:** full `Arcaevo` scheme **BUILD SUCCEEDED** (app + embedded watch + both widget extensions); web `tsc` clean; **193/193** vitest.

## 2. Decisions & alterations I made on your behalf (CEO calls)

I took liberties where the spec had blanks, as you asked. The ones worth knowing:

1. **Readiness scoring formula.** The spec's `min(core, ceiling)` mathematically *cannot* produce the design's showcase 71→62 from a −12 ferritin penalty. I used a floored proportional blend that reproduces 62/±9 exactly **and** guarantees blood can never drag the score below 55 — so a bad blood marker never renders an alarmist number. This is the single most important engineering judgement call in the build; flag it if you disagree.
2. **Refused to fabricate data in two places.** (a) The HRV/RHR mini Lock Screen widget was deferred because the snapshot schema carries no raw series and I would not invent one — the readiness widget covers the morning read. (b) More importantly, I'm now **gating the mock "AI photo extraction" so it never fabricates blood values for real users** (see §3) — a real person confirming invented numbers is a genuine safety issue.
3. **Cycle data choreography.** Kept menstrual/cycle tracking out of the first HealthKit sheet entirely — it's a separate ask fired only when you enable cycle-aware baselines in Privacy, matching Article 9 minimisation and Apple's review expectations.
4. **Deferred (with documented TODOs, not blockers):** the ActivityKit workout Live Activity (the in-app live-workout screen renders the pattern meanwhile), and the phone→watch 60-day baseline background transport (the watch renders the deterministic engine story until then).
5. **Notifications are local-only this phase** (no APNs) — everything the design specifies works without a push server, which keeps the first beta simpler.
6. **Branch, not main.** Committed the whole phase as one reviewable commit on a feature branch.

Full detail is in `docs/BUILD_STATE.md` under the Phase 22 log.

## 3. Production hardening I'm doing right now (no input needed from you)

From the audit's top-5, three are code-fixable without you, so I'm doing them (in flight as you read this, will be committed to the same branch):
- **Erasure cron** — wiring a daily Vercel Cron to actually run the deletion queue, so "erased within 30 days" becomes real instead of a script nobody calls.
- **Rate-limiting the magic-link verify endpoint** — it's the only way into an account; adding an IP-level limit on top of the existing per-code ceiling.
- **Non-fabricating uploads** — in production the photo/PDF path will show an honest "enter your values by hand" state instead of inventing numbers; manual entry (which is real and safe) becomes the path until we integrate a real EU OCR vendor.

## 4. How production-ready are we, honestly?

**Safe now:** a tiny **internal** TestFlight with you and a few trusted people, on the **basic/Fusion tier** (Apple Watch + manual/uploaded bloodwork, no lab kit). The architecture supports it and the daily-engagement layer is the differentiator that makes it worth using.

**Not safe yet:** strangers' real health data at any scale, or any **paid blood-testing tier**. See `docs/LAUNCH_READINESS.md` for the full checklist. The split you asked for:

**Needed for a basic-tier launch (no bloodwork partner):**
- ☐ The three hardening items in §3 (in progress)
- ☐ Real EU email provider (magic link currently only hits local MailHog)
- ☐ Real Atlas DB + production secrets set on Vercel (`SESSION_SECRET`, `ADMIN_PASSWORD`, never `ALLOW_DEMO_TOKEN`)
- ☐ Move admin off a single shared password to a real login (it currently unlocks all members' health data)
- ☐ Legal foundation: real controller entity, solicitor-reviewed privacy policy, signed DPAs (Vercel/Atlas/ESP), a DPIA (effectively mandatory for Article 9 data)
- ☐ Apple Developer membership + HealthKit purpose strings + privacy labels (see `docs/DEVICE_TESTING_AND_RELEASE.md`)

**Additionally needed before the paid blood tiers (your bloodwork-partner track):**
- ☐ Real lab partner (LetsGetChecked or equivalent) + webhook signature verification
- ☐ A **named, IMC-registered reviewing clinician** + medical-ops partner — the Dr. Nolan note is a mock persona and must not reach real users as-is
- ☐ Stripe wired for real (test keys are already stored for the next phase)

## 5. Legal & privacy verdict

The good: consent is genuinely enforced server-side, withdrawal instantly kills sessions, "delete everything" really queues a hard deletion, the whole stack is EU-only by design, and the blood-informed readiness engine is deliberately on the **wellness** side of the line (blood adjusts a *score and its band*, never a diagnosis or a training prescription; flagged/critical values leave the engine entirely and route to "clinician phones first, never a red number"). The closest thing to a regulatory edge is the Readiness `Train hard/Rest` decision line — keep it a *ceiling*, never a prescription, and the ON/OFF blood toggle is your documented fallback if a regulator ever wants blood shown only as context. Full analysis + the MDR/IVDR reasoning is in `docs/LAUNCH_READINESS.md`.

## 6. What I need from you — questions & walkthroughs

`docs/LAUNCH_READINESS.md` §7 has all **21** in detail. The ones that block the most:

1. **Legal entity & data controller** — what's the registered company that is the GDPR "controller"? Do you have (or need) a DPO?
2. **DPIA** — will you commission one? It's effectively required for special-category health data and reviewers/regulators will ask.
3. **Named reviewing clinician** — who is the real IMC-registered doctor behind the clinician notes, and the medical-ops partner? (Blocks paid tiers, not basic.)
4. **EU processors** — which email provider (Scaleway TEM / Postmark EU)? Confirm Atlas region eu-west-1 and sign DPAs with Vercel/Atlas/PostHog.
5. **Privacy policy legal review** — has a solicitor reviewed `/legal/privacy` against Irish DPC / GDPR Art. 9?
6. **Insurance** — cyber + professional/product liability for a health product?
7. **Two product calls I recommend but didn't force:** (a) confirm manual-entry-only bloodwork for basic-tier launch — I'm defaulting to it; (b) the "Ask Arcaevo" chat and Insights cards are currently canned/deterministic narrators — keep them clearly labelled, or hold them until a real grounded model is wired?

**Walkthroughs I'd like from you (a live session):** the exact wellness-vs-diagnosis copy line you're comfortable defending to a regulator; the refund/cancellation policy for the annual tiers; and how you want the critical-value phone call operationally handled (who calls, in what window).

---

## 7. Round 2 (later the same night) — Stripe + email, both done

You re-launched the loop, so I kept going on the biggest gaps to production. All on the same `phase-22-daily-engagement` branch, all verified (224/224 tests, tsc clean, build green):

- **Stripe is wired for real — in TEST mode** (no real money, fully reversible). Real Checkout Sessions (subscription mode for the €119/€329/€399 memberships, one-time for the add-ons/recheck), real webhook signature verification (replaced the stub), Stripe Tax for IE VAT, and — following Stripe's own guidance — it never hardcodes payment methods, so **Apple Pay and Link appear automatically on web**, exactly as the design wants. I ran the setup script against your test account and it **created all 8 prices**, and I confirmed the live vendor returns a real `checkout.stripe.com` session URL. The mock stays the default for dev/CI so nothing broke. Because the repo forbids `npm install`, I implemented it against Stripe's REST API directly (no SDK dependency) — noted `stripe` as a wanted dep if you'd rather swap to the SDK later.
- **Email adapter is now EU-ESP-ready** — optional SMTP auth + TLS via env, so pointing at Scaleway TEM / Postmark EU is a config change, not a code change. MailHog still works locally.

**What Stripe still needs from you to go live** (full detail in the new `docs/STRIPE_SETUP.md`): the webhook signing secret (`stripe listen` for dev, or a Dashboard endpoint for prod), swapping the test keys for live ones (use a restricted `rk_live_` key), enabling Stripe Tax + your Irish VAT registration, Apple Pay domain verification, and a small Customer-Portal route for self-service upgrade/cancel. **A CEO judgement call to confirm:** with a live `sk_test` key now in `.env.local`, local `npm run dev` uses the real (test-mode) Stripe vendor — I pinned the e2e suite to the mock so a real key can never leak into a Playwright run. Set `STRIPE_FORCE_MOCK=true` if you want dev back on the mock too.

## 8. Round 3 — legal package, security review, self-service billing

You relaunched again, so I closed the remaining *safe, decision-free* gaps and put the whole branch through a security review. All committed + pushed:

- **GDPR legal documentation package** (`docs/legal/`) — seven DPO-ready drafts grounded in the actual code: a **DPIA** (Art. 35, with 9 rated risks), **Records of Processing** (Art. 30), a **sub-processor register + DPA checklist**, a **data-retention schedule**, a **breach-response runbook** (the 72-hour DPC clock), and an **admin-auth options** decision doc. Every one is marked "DRAFT — needs DPO/solicitor review"; they exist to make your legal review fast and cheap, not to replace it.
- **Security review of the entire branch** — a senior-security pass over all the new server-side surface (Stripe webhook signature verification, the cron auth, the rate limiter, the portal route, vendor key handling, NoSQL-injection paths, the env gates). **Result: clean — no high-confidence vulnerabilities.** The new code held up: constant-time secret compares, fail-closed prod gates, no IDOR on the billing portal, raw-body webhook verification.
- **One fix the review surfaced** — the Stripe webhook activated membership without checking `payment_status`, so a delayed/async payment method could grant a paid membership before funds settled. Now guarded: `unpaid` sessions are acknowledged but not activated (subscriptions settle via `invoice.paid`).
- **Stripe Customer Portal** — real self-service billing (update card, invoices, cancel, plan-switch) via `/api/v1/account/portal`, and I corrected its guard so **cancelling never requires health-data consent** (you must always be able to stop paying).

**The single most urgent item the legal review keeps returning to:** the admin dashboard is still one shared password unlocking every member's Article 9 health data. I deliberately did **not** rebuild it autonomously — it's a real decision (self-hosted per-admin accounts vs a managed IdP like WorkOS/Auth0/Cognito), and `docs/legal/ADMIN_AUTH_OPTIONS.md` lays out the trade-offs with a recommendation. This one needs your call before real users, and I'll implement whichever you pick.

## Where things stand

- ✅ Phase 22 built, integrated, verified
- ✅ Production hardening (erasure cron, magic-link rate-limit, non-fabricating upload)
- ✅ **Stripe real test-mode integration** (8 prices created, session URL verified) + **go-live doc**
- ✅ **Email adapter** EU-ESP-ready
- ✅ Docs: `STRATEGY.md`, `LAUNCH_READINESS.md`, `DEVICE_TESTING_AND_RELEASE.md`, `STRIPE_SETUP.md`, this brief
- ✅ **Stripe Customer Portal** (self-service billing) + payment-settled guard
- ✅ **GDPR legal package** (`docs/legal/`, 7 drafts) + **clean security review** of the whole branch
- ✅ All pushed to `phase-22-daily-engagement` (open one PR: it contains daily-engagement + hardening + Stripe + portal + email + legal docs — review as a set, or I can split into separate PRs if you prefer)
- ⏭️ Next: your go-live decisions above + the basic-tier launch checklist (§4)
- 🧑‍⚕️ Your track: bloodwork partnership + named clinician (unblocks paid tiers; basic tier proceeds without it)

## The decisions I need to keep going productively

I've now exhausted the work I can safely do without your input — three rounds, all verified, a clean security review. The remaining items each need a specific decision or credential from you. Give me any of these and I'll execute the next round:

1. **Admin auth** — self-hosted per-admin accounts + roles + audit log, or a managed IdP (WorkOS/Auth0/Cognito)? (`docs/legal/ADMIN_AUTH_OPTIONS.md`) This is the #1 residual security risk.
2. **EU email provider** — pick one (Scaleway TEM / Postmark EU) and I'll wire + document it; it's already a config-shaped change.
3. **Stripe go-live** — when you've created the webhook endpoint + live keys, I'll do the swap and the Dashboard-config walkthrough.
4. **Legal entity + DPO** — the registered controller entity (CRO number) and whether you're appointing a DPO, so the legal drafts can be finalised.
5. **Split the branch into separate PRs?** — say the word and I'll break it into daily-engagement / payments / hardening / legal for cleaner review.
