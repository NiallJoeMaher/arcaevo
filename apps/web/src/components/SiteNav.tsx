import Link from "next/link";

const NAV_ITEMS = [
  { key: "how", href: "/how-it-works", label: "How it works" },
  { key: "pricing", href: "/pricing", label: "Pricing" },
  { key: "science", href: "/science", label: "Science" },
  { key: "app", href: "/app", label: "The app" },
  { key: "compare", href: "/compare", label: "Compare" },
  { key: "blog", href: "/blog", label: "Blog" },
];

export default function SiteNav({ active = "" }: { active?: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-[rgba(236,231,221,0.82)] font-sans backdrop-blur-[14px] backdrop-saturate-[1.4]">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-[1180px] items-center justify-between gap-6 px-10 py-4"
      >
        <Link
          href="/"
          className="flex shrink-0 items-center gap-[11px] text-ink no-underline"
        >
          <span className="text-[19px] font-semibold tracking-[-0.01em]">
            Arcaevo
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
              {item.label}
            </Link>
          ))}
        </div>
        <Link
          href="/pricing"
          className="shrink-0 rounded-pill bg-ink px-5 py-[10px] text-[13.5px] font-semibold text-bone-white no-underline"
        >
          Start membership
        </Link>
      </nav>
    </header>
  );
}
