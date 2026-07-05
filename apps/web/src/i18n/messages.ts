/**
 * Locale registry + typed dictionary accessors.
 *
 * Dep-free, server-component friendly: these are pure functions over static
 * imports, safe to call from any React Server Component without touching
 * request state (that lives in ./server.ts). en-US is the source baseline;
 * en-GB/en-IE are generated from it and structurally must match `Messages`.
 */

import enUS, { type Messages } from "./locales/en-US";
import enGB from "./locales/en-GB";
import enIE from "./locales/en-IE";

/** Supported BCP-47 locales. en-IE is the Ireland-first default. */
export type Locale = "en-US" | "en-GB" | "en-IE";

/** All supported locales, in registry order. */
export const LOCALES: readonly Locale[] = ["en-US", "en-GB", "en-IE"];

/**
 * The built-in default. Ireland-first: an ambiguous / header-less request, and
 * any statically-rendered page, falls back to en-IE (European spelling).
 */
export const DEFAULT_LOCALE: Locale = "en-IE";

/** Cookie name for an explicit locale override (QA / user preference). */
export const LOCALE_COOKIE = "arc_locale";

/** locale → message dictionary. */
export const MESSAGES: Record<Locale, Messages> = {
  "en-US": enUS,
  "en-GB": enGB,
  "en-IE": enIE,
};

/** Narrowing guard for untrusted input (cookie/param/header values). */
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Return the full typed dictionary for a locale. Preferred accessor in server
 * components: `const m = getDictionary(locale); m.home.hero.title`.
 * Unknown locales fall back to the default (never throws).
 */
export function getDictionary(locale: Locale): Messages {
  return MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
}

/**
 * Dot-path string accessor: `t("en-GB", "footer.links.help") // "Help centre"`.
 * Returns the key itself if the path is missing or non-string, so a typo shows
 * up loudly in the UI rather than crashing the render.
 */
export function t(locale: Locale, path: string): string {
  const value = path
    .split(".")
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[key]
          : undefined,
      getDictionary(locale)
    );
  return typeof value === "string" ? value : path;
}

export type { Messages };
