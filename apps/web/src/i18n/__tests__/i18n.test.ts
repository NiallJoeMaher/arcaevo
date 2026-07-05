/**
 * Unit tests for the dep-free i18n system:
 *  - the Accept-Language resolver maps tags → locales correctly
 *  - every locale dictionary has the exact same key tree as the en-US baseline
 *  - NO contractual prices leak into the translatable dictionaries
 *  - the pricing PAGE still carries the exact price strings (byte-for-byte)
 *  - spelling actually differs (en-US American vs en-GB European)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  LOCALES,
  MESSAGES,
  getDictionary,
  isLocale,
  t,
  type Locale,
} from "@/i18n/messages";
import { localeFromAcceptLanguage, resolveLocale } from "@/i18n/resolve";
import enUS from "@/i18n/locales/en-US";

/* ── Resolver ─────────────────────────────────────────────────────────── */

describe("resolveLocale — Accept-Language negotiation", () => {
  const cases: [string, Locale][] = [
    ["en-US,en;q=0.9", "en-US"],
    ["en-CA", "en-US"],
    ["en-GB,en;q=0.8", "en-GB"],
    ["en-AU", "en-GB"],
    ["en-NZ", "en-GB"],
    ["en-IE,en;q=0.9", "en-IE"],
    ["ga-IE,en;q=0.5", "en-IE"],
    ["de-DE,de;q=0.9,en;q=0.4", "en-GB"], // European language → European English
    ["fr-FR", "en-GB"],
    ["en", "en-IE"], // bare English is ambiguous → Ireland-first
  ];
  it.each(cases)("maps %s → %s", (header, expected) => {
    expect(resolveLocale({ header })).toBe(expected);
  });

  it("honours q-weights (higher q wins over document order)", () => {
    expect(resolveLocale({ header: "en-GB;q=0.6, en-US;q=0.9" })).toBe("en-US");
    expect(resolveLocale({ header: "en-US;q=0.2, en-GB;q=0.9" })).toBe("en-GB");
  });

  it("falls back to DEFAULT_LOCALE when nothing matches or header is absent", () => {
    expect(resolveLocale({})).toBe(DEFAULT_LOCALE);
    expect(resolveLocale({ header: null })).toBe(DEFAULT_LOCALE);
    expect(resolveLocale({ header: "zz-ZZ,xx;q=0.5" })).toBe(DEFAULT_LOCALE);
    expect(DEFAULT_LOCALE).toBe("en-IE"); // Ireland-first
  });

  it("returns null from the header parser for unmatched input", () => {
    expect(localeFromAcceptLanguage(null)).toBeNull();
    expect(localeFromAcceptLanguage("")).toBeNull();
    expect(localeFromAcceptLanguage("ja-JP")).toBeNull();
  });
});

describe("resolveLocale — explicit overrides win over the header", () => {
  it("param overrides Accept-Language", () => {
    expect(resolveLocale({ param: "en-US", header: "en-IE" })).toBe("en-US");
  });
  it("cookie overrides Accept-Language", () => {
    expect(resolveLocale({ cookie: "en-US", header: "en-IE" })).toBe("en-US");
  });
  it("param beats cookie", () => {
    expect(resolveLocale({ param: "en-GB", cookie: "en-US" })).toBe("en-GB");
  });
  it("ignores an invalid override and negotiates instead", () => {
    expect(resolveLocale({ cookie: "not-a-locale", header: "en-US" })).toBe(
      "en-US"
    );
  });
});

describe("isLocale", () => {
  it("accepts supported locales and rejects everything else", () => {
    for (const l of LOCALES) expect(isLocale(l)).toBe(true);
    expect(isLocale("en")).toBe(false);
    expect(isLocale("fr-FR")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

/* ── Key-parity across locales ────────────────────────────────────────── */

/** Collect every leaf key path ("home.hero.title") in a nested string tree. */
function keyPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" && !Array.isArray(value)
      ? keyPaths(value as Record<string, unknown>, path)
      : [path];
  });
}

describe("locale dictionaries share the en-US baseline shape", () => {
  const baseline = keyPaths(enUS).sort();

  it.each(LOCALES)("%s has exactly the same key paths as en-US", (locale) => {
    const paths = keyPaths(
      MESSAGES[locale] as unknown as Record<string, unknown>
    ).sort();
    expect(paths).toEqual(baseline);
  });

  it("every leaf value is a non-empty string in every locale", () => {
    for (const locale of LOCALES) {
      for (const path of baseline) {
        const value = t(locale, path);
        expect(typeof value).toBe("string");
        expect(value.length).toBeGreaterThan(0);
        expect(value).not.toBe(path); // t() returns the key on a miss
      }
    }
  });
});

/* ── Prices must NEVER live in a translatable dictionary ───────────────── */

describe("no contractual prices leak into the dictionaries", () => {
  const CONTRACTUAL = ["€119", "€329", "€399", "€130", "€99", "€69", "€199"];

  it.each(LOCALES)("%s dictionary contains no € amount", (locale) => {
    const blob = JSON.stringify(getDictionary(locale));
    expect(blob).not.toMatch(/€/);
    for (const price of CONTRACTUAL) expect(blob).not.toContain(price);
  });
});

/* ── The pricing PAGE still carries exact, unaltered prices ────────────── */

describe("pricing page keeps prices byte-exact", () => {
  const pricingSrc = readFileSync(
    fileURLToPath(new URL("../../app/pricing/page.tsx", import.meta.url)),
    "utf8"
  );

  it.each(["€119", "€329", "€399", "+€130", "€99", "€69", "€199"])(
    "still contains %s",
    (price) => {
      expect(pricingSrc).toContain(price);
    }
  );
});

/* ── Spelling: American baseline vs European variant ──────────────────── */

describe("spelling differs between en-US and en-GB", () => {
  it("en-US uses American spelling", () => {
    expect(t("en-US", "footer.links.help")).toBe("Help center");
    expect(t("en-US", "footer.copyright")).toContain("optimization");
    expect(t("en-US", "home.howItWorks.step3Body")).toContain("prioritized");
    expect(t("en-US", "home.finalCta.helpBtn")).toBe("Questions? Help center");
  });

  it("en-GB uses European spelling", () => {
    expect(t("en-GB", "footer.links.help")).toBe("Help centre");
    expect(t("en-GB", "footer.copyright")).toContain("optimisation");
    expect(t("en-GB", "home.howItWorks.step3Body")).toContain("prioritised");
    expect(t("en-GB", "home.finalCta.helpBtn")).toBe("Questions? Help centre");
  });

  it("en-IE mirrors en-GB (Irish ≈ UK spelling)", () => {
    expect(getDictionary("en-IE")).toBe(getDictionary("en-GB"));
    expect(t("en-IE", "footer.links.help")).toBe("Help centre");
  });

  it("the Ireland-first default renders European spelling", () => {
    expect(t(DEFAULT_LOCALE, "footer.links.help")).toBe("Help centre");
  });
});
