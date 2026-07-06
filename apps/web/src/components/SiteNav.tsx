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
        className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-6 gap-y-0 px-10 py-4 max-md:px-5 max-md:pb-0 max-md:pt-3"
      >
        <Link
          href="/"
          aria-label={m.brand}
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
        <div className="order-3 -mx-1 -mt-1 flex w-full items-center gap-[22px] overflow-x-auto px-1 pb-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:order-none md:w-auto md:gap-7 md:overflow-visible md:pb-0">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              aria-current={item.key === active ? "page" : undefined}
              className={`whitespace-nowrap text-sm tracking-[-0.005em] no-underline transition-colors duration-150 max-md:py-3 ${
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
          className="shrink-0 rounded-pill bg-ink px-5 py-[10px] text-[13.5px] font-semibold text-bone-white no-underline max-md:px-4 max-md:py-[9px] max-md:text-[12.5px]"
        >
          {m.cta}
        </Link>
      </nav>
    </header>
  );
}
