/**
 * Locale RESOLVER — pure, dependency-free, fully unit-testable.
 *
 * Precedence:
 *   1. explicit override — a `?lang=` param or the arc_locale cookie, if valid
 *   2. Accept-Language negotiation (quality-weighted)
 *   3. DEFAULT_LOCALE (en-IE) — Ireland-first when the request is ambiguous
 *
 * Content grouping (spelling is shared within a group):
 *   en-US, en-CA                         → en-US  (American spelling)
 *   en-IE, ga (Irish), bare "en"         → en-IE  (Ireland-first default copy)
 *   en-GB, en-AU, en-NZ, en-ZA, most EU  → en-GB  (European/UK spelling)
 *
 * No request/next APIs here — the thin server wrapper lives in ./server.ts.
 */

import { DEFAULT_LOCALE, isLocale, type Locale } from "./messages";

/**
 * Non-English European languages: a visitor whose top language is, say, German
 * or French gets European English rather than American spelling.
 */
const EUROPEAN_LANGUAGES = new Set([
  "de", "fr", "es", "it", "nl", "pt", "pl", "sv", "da", "fi", "nb", "nn",
  "no", "cs", "sk", "el", "hu", "ro", "bg", "hr", "sl", "et", "lv", "lt",
  "mt", "is", "ca", "eu", "gl",
]);

/** Map a single BCP-47 tag (e.g. "en-US", "de-AT", "ga") to a supported locale. */
function tagToLocale(tag: string): Locale | null {
  const clean = tag.trim().toLowerCase();
  if (!clean) return null;
  const [language, region] = clean.split("-");

  if (language === "en") {
    if (region === "us" || region === "ca") return "en-US";
    if (region === "ie") return "en-IE";
    if (!region) return "en-IE"; // bare "en" is ambiguous → Ireland-first
    return "en-GB"; // en-GB, en-AU, en-NZ, en-ZA, and any other English region
  }
  if (language === "ga") return "en-IE"; // Irish (Gaeilge)
  if (EUROPEAN_LANGUAGES.has(language)) return "en-GB";
  return null;
}

/**
 * Pick a locale from an Accept-Language header, honouring q-weights.
 * Returns null when nothing maps to a supported locale.
 */
export function localeFromAcceptLanguage(
  header: string | null | undefined
): Locale | null {
  if (!header) return null;

  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.split("=")[1]) : 1;
      return { tag: tag.trim(), q: Number.isFinite(q) ? q : 0 };
    })
    .filter((entry) => entry.tag && entry.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const locale = tagToLocale(tag);
    if (locale) return locale;
  }
  return null;
}

/** Inputs to the resolver — all optional, all untrusted strings. */
export interface ResolveLocaleInput {
  /** Value of an explicit `?lang=` query param, if any. */
  param?: string | null;
  /** Value of the arc_locale override cookie, if any. */
  cookie?: string | null;
  /** The request's Accept-Language header. */
  header?: string | null;
}

/**
 * Resolve the visitor's locale. Pure: same inputs → same output.
 */
export function resolveLocale(input: ResolveLocaleInput = {}): Locale {
  // 1. Explicit override wins (param before cookie).
  if (isLocale(input.param)) return input.param;
  if (isLocale(input.cookie)) return input.cookie;

  // 2. Content negotiation.
  const negotiated = localeFromAcceptLanguage(input.header);
  if (negotiated) return negotiated;

  // 3. Ireland-first default.
  return DEFAULT_LOCALE;
}
