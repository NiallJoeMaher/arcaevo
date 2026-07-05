# Localization (i18n)

A lightweight, **dependency-free** internationalization layer for the Arcaevo
marketing site. No `next-intl` / `react-intl` — just typed TS dictionaries + a
pure resolver, built for React Server Components.

- **US English is the SOURCE baseline** (`src/i18n/locales/en-US.ts`).
- Every other locale is **generated from that baseline**, keeping the same keys
  and changing only the values (spelling).
- EU / Ireland / UK visitors see **European English** (`en-GB`, re-used by
  `en-IE`); US / Canada visitors see **American English** (`en-US`).
- One URL structure — **no `/en-us/` path segments**. The locale is chosen per
  request by content negotiation (`Accept-Language`), with self-referencing
  `hreflang` alternates.

---

## File map (`src/i18n/`)

| File | Role |
| --- | --- |
| `locales/en-US.ts` | **SOURCE baseline.** Typed nested dictionary (`nav`, `footer`, `home`, `common`). American spelling. `export type Messages = typeof enUS` is the shape every locale must satisfy. |
| `locales/en-GB.ts` | European / UK English, **generated from en-US** (spelling only). What EU/IE/UK visitors see. Typed `: Messages`, so a missing/extra key fails `tsc`. |
| `locales/en-IE.ts` | Irish English. Re-exports `en-GB` (Irish ≈ UK spelling). IE-only overrides go here via a spread. |
| `messages.ts` | Registry: `Locale` type, `LOCALES`, `DEFAULT_LOCALE`, `LOCALE_COOKIE`, `MESSAGES`, `isLocale()`, `getDictionary(locale)`, and the dot-path `t(locale, "home.hero.title")` accessor. Pure — safe in any RSC. |
| `resolve.ts` | **Pure resolver.** `resolveLocale({ param, cookie, header })` + `localeFromAcceptLanguage()`. No request APIs — fully unit-testable. |
| `server.ts` | Thin server wrapper: `getLocale()` / `getServerMessages()` read `next/headers` (cookies + `Accept-Language`) and call the resolver. **Reading headers opts the route into dynamic rendering** (see trade-off below). |

---

## How locale resolution works

`resolveLocale()` picks a locale in strict precedence order:

1. **Explicit override** — a `?lang=` param or the `arc_locale` cookie, if it is
   a valid locale. (`param` beats `cookie`.) Useful for QA and a future
   language switcher.
2. **`Accept-Language` negotiation** — the header is parsed with q-weights
   (highest quality wins, not document order), and the first tag that maps to a
   supported locale is used:

   | Incoming tag(s) | Resolves to | Spelling |
   | --- | --- | --- |
   | `en-US`, `en-CA` | `en-US` | American |
   | `en-IE`, `ga` (Irish), bare `en` | `en-IE` | European (Ireland-first) |
   | `en-GB`, `en-AU`, `en-NZ`, `en-ZA`, other English regions | `en-GB` | European |
   | non-English European langs (`de`, `fr`, `es`, `nl`, …) | `en-GB` | European |
   | anything unmapped (`ja`, `zh`, …) | falls through to step 3 | — |

3. **`DEFAULT_LOCALE` = `en-IE`** — the Ireland-first default for ambiguous or
   header-less requests. Guarantees the default experience is always correct
   European spelling.

The `<html lang>` attribute (set in `src/app/layout.tsx`) reflects the resolved
locale, and each page passes the resolved `locale` to `SiteNav` / `SiteFooter`.

---

## Static vs dynamic — the trade-off we chose

Content negotiation on a single URL is inherently **per-request**: the server
can only pick American vs European spelling after it reads the visitor's
`Accept-Language` header. We therefore let the root layout call `getLocale()`,
which opts the marketing routes into **dynamic (SSR-on-demand) rendering**
instead of build-time static generation.

This is safe here because the app ships as a **Node server** (`output:
"standalone"`, Vercel/Docker), **not** a static export — dynamic routes are
fully supported and `next build` stays green (routes show as `ƒ Dynamic`).

**Why this is fine for the Ireland-first launch:** the resolver defaults to
`en-IE`, so an ambiguous/EU/IE request always renders correct European spelling.
US visitors additionally get American spelling per request.

**If a fully static build were ever required** (e.g. `output: export`): remove
the `getLocale()` call from the layout and any page, and render everything at
`DEFAULT_LOCALE` (`en-IE`). You keep correct Ireland-first copy at the cost of
per-request US spelling. The dictionaries and resolver stay exactly as-is —
only the call site changes. `DEFAULT_LOCALE` is deliberately the static
fallback so a statically-cached page is always the correct default.

### hreflang

`hreflangFor()` in `src/lib/seo.ts` advertises `en-US`, `en-GB`, `en-IE` and
`x-default`, **all pointing at the same absolute URL** (self-referencing). That
is the correct signal for content negotiation on a single URL structure —
there are no locale-specific URLs to point at.

---

## THE GENERATION PROCESS — adding a new locale

The founder's ask: *"run Claude to create all the files from the USA baseline."*
Here is exactly how.

### Option A — ask Claude (recommended)

> Generate `src/i18n/locales/<new-locale>.ts` from `src/i18n/locales/en-US.ts`.
> Keep **every key byte-identical**; translate only the string **values**.
> Do NOT introduce prices, numbers, brand names, or legal text. Preserve the
> existing punctuation/glyphs (straight vs curly quotes, en/em dashes) exactly.
> Type the object `: Messages` importing from `./en-US`.

Then register it (3 lines):

```ts
// messages.ts
import enXX from "./locales/en-XX";
export type Locale = "en-US" | "en-GB" | "en-IE" | "en-XX";
export const LOCALES = ["en-US", "en-GB", "en-IE", "en-XX"] as const;
export const MESSAGES = { /* … */ "en-XX": enXX };
```

Add its `Accept-Language` mapping in `resolve.ts` and (optionally) a tag in
`hreflangFor()`.

### Option B — by hand

1. `cp src/i18n/locales/en-US.ts src/i18n/locales/en-XX.ts`.
2. Change the values, keep the keys. Type it `const enXX: Messages = { … }`.
3. Register it in `messages.ts` (as above).

### Guardrails that catch mistakes automatically

- **`tsc --noEmit`** — a missing or extra key fails the type check (`: Messages`).
- **`npm test`** (`src/i18n/__tests__/i18n.test.ts`) asserts:
  - every locale has the **same key tree** as `en-US`, all leaves non-empty;
  - **no `€` amount** ever appears in any dictionary;
  - the pricing page still contains every exact price string;
  - the resolver maps `Accept-Language` correctly.

### The en-US → en-GB spelling transformation

The rules applied to generate European English from the American baseline:

```
optimization → optimisation      color → colour           center/-er → centre/-re
prioritize/-d → prioritise/-d     organize/-d → organise   personalize → personalise
favor → favour                    analyze → analyse        "while" → "whilst" (where natural)
```

Only spelling changes. **Never** touch prices, numbers, brand names
(Arcaevo, Apple Watch, WHOOP…), or legal/verbatim copy.

---

## What is converted today — and the incremental backlog

The framework is proven on the **primary marketing surfaces**. Everything else
still renders hardcoded copy and can be migrated incrementally the same way
(pull strings into `en-US.ts`, render via `getDictionary`).

**Converted (reads from the dictionary):**

- `SiteNav` — brand, nav labels, CTA.
- `SiteFooter` — tagline, badges, all column headings + link labels, copyright,
  staff login.
- Home page (`/`) — hero, logo strip, "How it works", differentiators
  heading/intro/CTA, pricing-teaser heading, credibility heading/intro/CTAs,
  founder quote, final-CTA heading + buttons.
- `<html lang>` (`layout.tsx`) + `hreflang` alternates (`seo.ts`).

**Deliberately NOT converted (kept hardcoded):**

- **All prices** — `€119 / €329 / €399`, `+€130`, `€99 / €69 / €199`. Contractual,
  byte-exact, never in a dictionary (enforced by a test). The final-CTA
  price sentence and the pricing-teaser cards stay hardcoded for this reason.
- **Legal documents** (`/legal/*`) and other design-locked verbatim copy.
- The 6 home "trust signal" cards and the 5 differentiator card bodies — they
  contain inline `<em>`/entities and have no spelling variance; migrate only if
  a future locale needs them.

**Backlog (migrate next, in rough priority order):**

1. `/pricing` prose (plan names/descriptions — **not** the price numbers).
2. `/how-it-works`, `/science`, `/compare`, `/app`.
3. `/about`, `/careers`, `/contact`, `/help`.
4. Home trust-signal + differentiator card bodies (needs a rich-text pattern for
   the inline `<em>`).
5. `/blog` article chrome (labels, not article bodies).
6. A user-facing language switcher that writes the `arc_locale` cookie.
