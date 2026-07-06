import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import SiteMotion from "@/components/SiteMotion";
import { DEFAULT_LOCALE, getDictionary, type Locale } from "@/i18n/messages";

/** Route structure (hrefs + active keys); labels come from the dictionary. */
const NAV_ITEMS = [
  { key: "how", href: "/how-it-works" },
  { key: "pricing", href: "/pricing" },
  { key: "science", href: "/science" },
  { key: "app", href: "/app" },
  { key: "compare", href: "/compare" },
  { key: "blog", href: "/blog" },
] as const;

export default function SiteNav({
  active = "",
  locale = DEFAULT_LOCALE,
}: {
  active?: string;
  locale?: Locale;
}) {
  const m = getDictionary(locale).nav;
  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-[rgba(236,231,221,0.82)] font-sans backdrop-blur-[14px] backdrop-saturate-[1.4]">
      <SiteMotion />
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-[1180px] items-center justify-between gap-6 px-10 py-4"
      >
        <Link
          href="/"
          className="flex min-h-11 shrink-0 items-center gap-[11px] text-ink no-underline"
        >
          <BrandMark width={22} className="shrink-0 text-forest" />
          <span
            data-nav-wordmark
            className="text-[19px] font-semibold tracking-[-0.01em] max-md:hidden"
          >
            {m.brand}
          </span>
        </Link>
        <div className="hidden items-center gap-7 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              aria-current={item.key === active ? "page" : undefined}
              className={`text-sm tracking-[-0.005em] no-underline transition-colors duration-150 ${
                item.key === active
                  ? "font-semibold text-forest"
                  : "font-medium text-muted"
              }`}
            >
              {m.items[item.key]}
            </Link>
          ))}
        </div>
        <Link
          href="/pricing"
          className="shrink-0 rounded-pill bg-ink px-5 py-[10px] text-[13.5px] font-semibold text-bone-white no-underline"
        >
          {m.cta}
        </Link>
      </nav>
    </header>
  );
}
