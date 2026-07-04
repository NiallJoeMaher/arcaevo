# Stripe setup & go-live checklist

Real Stripe is wired into the web app (`apps/web`) behind the existing
`PaymentsVendor` interface. It runs in **TEST mode** today and is fully
reversible. This doc is the operator runbook: what's done, what you run, and the
exact steps to go live.

- Code: `src/lib/vendors/stripe.live.ts` (LIVE vendor, REST + `fetch`, no SDK),
  `src/lib/vendors/stripe.mock.ts` (unchanged mock), `src/lib/vendors/stripe.ts`
  (selection factory), `src/lib/vendors/stripe-config.ts` (SKU→`lookup_key`),
  `src/lib/stripe-signature.ts` (webhook signature verification),
  `src/app/api/v1/webhooks/stripe/route.ts` (real + mock webhook handling),
  `scripts/stripe-setup.ts` (`npm run stripe:setup`).
- API version pinned: **`2026-06-24.dahlia`**.
- Best practices baked in: subscriptions for memberships, one-off payments for
  add-ons; **no `payment_method_types`** (dynamic methods → Apple Pay/Link/card);
  Stripe Tax (`automatic_tax`) + address collection; one Customer per member;
  real webhook signature verification.

## Vendor selection (how dev/CI stay on the mock)

`selectedPaymentsVendorKind()`:

- **LIVE** when `STRIPE_SECRET_KEY` is a real `sk_…` key **and**
  `STRIPE_FORCE_MOCK !== "true"`.
- **MOCK** otherwise — which is what CI (no key), and the e2e / docker stacks
  (`STRIPE_FORCE_MOCK=true`) use, so the whole existing test suite is unchanged.

## Environment variables (`apps/web/.env.local`, gitignored)

| Var | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_…` now; `sk_live_…` (ideally a restricted `rk_live_…`) for prod. Selects LIVE when present. |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_…` / `pk_live_…`. Not needed for hosted Checkout, kept for future client-side Elements. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…`. **When set, the webhook route switches to REAL `Stripe-Signature` verification.** Unset = dev/mock shared-secret path. |
| `STRIPE_FORCE_MOCK` | `true` pins the deterministic mock even when a key is present (fast off-switch / e2e). |
| `STRIPE_PRICE_ARCAEVO_*` | Optional. Pin a resolved Price id per `lookup_key` to skip the runtime lookup. |

## 1. Create the TEST products & prices

```bash
cd apps/web
npm run stripe:setup     # idempotent; reads STRIPE_SECRET_KEY from .env.local
```

Creates one Product + one Price for every SKU, keyed by a stable `lookup_key`
(re-runs find the existing price and never duplicate). It prints the price ids
and the optional `STRIPE_PRICE_*` env lines. SKUs / prices (contractual):

| lookup_key | € | mode |
| --- | --- | --- |
| `arcaevo_fusion_annual` | 119 | subscription (year) |
| `arcaevo_essential_annual` | 329 | subscription (year) |
| `arcaevo_performance_annual` | 399 | subscription (year) |
| `arcaevo_quarterly_upgrade` | 130 | subscription (year) |
| `arcaevo_addon_full_panel` | 99 | payment |
| `arcaevo_addon_recheck` | 69 | payment |
| `arcaevo_addon_venous` | 199 | payment |
| `arcaevo_recheck_kit` | 69 | payment |

## 2. Get the webhook signing secret

**Dev (Stripe CLI):**

```bash
stripe login
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
# prints: whsec_...  → put in .env.local as STRIPE_WEBHOOK_SECRET, restart the dev server
```

Now the webhook route verifies real `Stripe-Signature` headers. Trigger events:

```bash
stripe trigger checkout.session.completed
stripe trigger invoice.payment_failed
```

**Prod (Dashboard):** Developers → Webhooks → Add endpoint →
`https://<your-domain>/api/v1/webhooks/stripe`, subscribe to
`checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Copy
the endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`.

> When `STRIPE_WEBHOOK_SECRET` is unset the route keeps the interim dev path (the
> `/checkout` page fires a simplified `checkout.session.completed` from the
> browser). Setting the secret flips it to real server-to-server verification —
> the browser-fired mock webhook is then rejected (no signature), which is
> correct: real Stripe fires it server-side.

## 3. Test cards (QA in test mode)

| Scenario | Card |
| --- | --- |
| Success | `4242 4242 4242 4242` |
| Requires authentication (3DS) | `4000 0025 0000 3155` |
| Declined (generic) | `4000 0000 0000 0002` |
| Insufficient funds | `4000 0000 0000 9995` |
| Charge succeeds, dispute | `4000 0000 0000 0259` |

Any future expiry, any CVC, any postal code. (More: the `stripe:test-cards`
skill, or stripe.com/docs/testing.)

## 4. Go-live checklist

1. **Keys** — swap `sk_test_`→`sk_live_`. Prefer a **restricted key** (`rk_live_…`)
   scoped to only what the server needs (Checkout Sessions, Customers, Prices,
   Subscriptions read, Webhooks) instead of the full secret key. Never commit
   keys; never log them (the code never does).
2. **Products/prices** — run `npm run stripe:setup` again with the **live** key to
   create the same `lookup_key`s in live mode (or create them in the Dashboard).
3. **Stripe Tax** — enable Tax in the Dashboard, add the **IE VAT registration**,
   confirm product tax codes. `automatic_tax` is already on in code.
4. **Payment methods** — in the Dashboard enable card, Link, and **Apple Pay**;
   for Apple Pay **verify your production domain** (Settings → Payment methods →
   Apple Pay → add domain). Code passes no `payment_method_types`, so enabled
   methods appear automatically.
5. **Customer Portal** — the route is **wired**: `POST /api/v1/account/portal`
   (member-auth + consent-guarded) looks up the member's `stripeCustomerId`,
   calls `POST /v1/billing_portal/sessions` with a `return_url` back to
   `/account`, and returns `{ url }`. The account membership card (`Update card`
   / `Invoices` / `Cancel renewal` / `Manage billing`) opens that URL **when the
   LIVE vendor is active**; on the mock it keeps the interim pills + webhook
   cancel path. A member with no `stripeCustomerId` yet (never checked out via
   live Stripe) gets a clean **409** (`no_stripe_customer`), not a crash.
   **You must still CONFIGURE the portal in the Dashboard** — Settings → Billing
   → **Customer portal** — or the call 400s (`No configuration provided…`). Turn
   on: **payment method update**, **cancellation** (cancel at period end — keeps
   access to year-end, matching the cancel-renewal copy), and **plan switching**
   among the Arcaevo Billing Prices (so the +€130 quarterly upgrade and
   tier changes are self-service). Set the return URL / business info to taste.
   Until it is configured the LIVE route surfaces a **502** (`portal_unavailable`)
   to the UI rather than a raw Stripe error.
6. **Webhook endpoint** — add the production endpoint + set its
   `STRIPE_WEBHOOK_SECRET` (step 2).
7. **Optional** — swap the REST calls for the official `stripe` SDK once the dep
   ban is lifted (see BUILD_STATE "Wanted deps"); no call sites change.
8. **Refunds** — the vendor currently returns only the *policy* decision (full
   refund while the order is still `ordered`). To issue real refunds, persist the
   PaymentIntent/charge id per order and call `POST /refunds`.
