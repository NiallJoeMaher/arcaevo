/**
 * Server-only locale helper.
 *
 * Reads the request's Accept-Language header + arc_locale override cookie via
 * next/headers and runs the pure resolver. IMPORTANT: calling getLocale()
 * opts the calling route into dynamic (per-request) rendering — that is the
 * intended trade-off for content-negotiated copy on a single URL structure
 * (see docs/LOCALIZATION.md). Statically-rendered surfaces should instead pass
 * DEFAULT_LOCALE and stay on the Ireland-first en-IE default.
 */

import { cookies, headers } from "next/headers";
import { getDictionary, LOCALE_COOKIE, type Locale, type Messages } from "./messages";
import { resolveLocale } from "./resolve";

/** Resolve the current request's locale (dynamic — reads request headers). */
export async function getLocale(): Promise<Locale> {
  const [headerStore, cookieStore] = await Promise.all([headers(), cookies()]);
  return resolveLocale({
    header: headerStore.get("accept-language"),
    cookie: cookieStore.get(LOCALE_COOKIE)?.value ?? null,
  });
}

/** Resolve the request's locale and its message dictionary in one call. */
export async function getServerMessages(): Promise<{
  locale: Locale;
  m: Messages;
}> {
  const locale = await getLocale();
  return { locale, m: getDictionary(locale) };
}
