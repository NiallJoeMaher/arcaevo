import Link from "next/link";
import { DEFAULT_LOCALE, getDictionary, type Locale, type Messages } from "@/i18n/messages";

type FooterLinkKey = keyof Messages["footer"]["links"];

/** Structure only: href + which dictionary label key to render. */
const PRODUCT_LINKS: { href: string; key: FooterLinkKey }[] = [
  { href: "/how-it-works", key: "how" },
  { href: "/pricing", key: "pricing" },
  { href: "/app", key: "app" },
  { href: "/science", key: "science" },
  { href: "/compare", key: "compare" },
];

const COMPANY_LINKS: { href: string; key: FooterLinkKey }[] = [
  { href: "/about", key: "about" },
  { href: "/blog", key: "blog" },
  { href: "/careers", key: "careers" },
  { href: "/contact", key: "contact" },
  { href: "/help", key: "help" },
];

const LEGAL_LINKS: { href: string; key: FooterLinkKey }[] = [
  { href: "/legal/privacy", key: "privacy" },
  { href: "/legal/data-deletion", key: "dataDeletion" },
  { href: "/legal/gdpr-consent", key: "gdpr" },
  { href: "/legal/cookies", key: "cookies" },
  { href: "/legal/terms", key: "terms" },
  { href: "/legal/dpa", key: "subprocessors" },
  { href: "/legal/clinical-safety", key: "clinicalSafety" },
];

function FooterColumn({
  heading,
  links,
  labels,
}: {
  heading: string;
  links: { href: string; key: FooterLinkKey }[];
  labels: Messages["footer"]["links"];
}) {
  return (
    <div className="flex flex-col gap-[11px]">
      <span className="font-mono text-[11px] font-semibold tracking-[0.1em] text-bone-white">
        {heading}
      </span>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-[13.5px] text-muted-dark no-underline"
        >
          {labels[link.key]}
        </Link>
      ))}
    </div>
  );
}

export default function SiteFooter({
  locale = DEFAULT_LOCALE,
}: {
  locale?: Locale;
}) {
  const m = getDictionary(locale).footer;
  return (
    <footer className="bg-ink-deep px-10 pt-16 pb-10 font-sans text-muted-dark">
      <div className="mx-auto max-w-[1180px]">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-12">
          <div className="max-w-[280px]">
            <Link
              href="/"
              className="mb-4 flex items-center gap-[11px] no-underline"
            >
              <span className="text-[17px] font-semibold text-bone-white">
                Arcaevo
              </span>
            </Link>
            <p className="mb-[18px] mt-0 text-[13.5px] leading-[1.6] text-[#7E8F84]">
              {m.tagline}
            </p>
            <div className="flex gap-[10px]">
              <Link
                href="/app"
                className="rounded-pill border border-[rgba(255,255,255,0.14)] px-[13px] py-[7px] font-mono text-[11px] text-muted-dark no-underline"
              >
                {m.badges.ios}
              </Link>
              <Link
                href="/app"
                className="rounded-pill border border-[rgba(255,255,255,0.14)] px-[13px] py-[7px] font-mono text-[11px] text-muted-dark no-underline"
              >
                {m.badges.watch}
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap gap-12">
            <FooterColumn heading={m.columns.product} links={PRODUCT_LINKS} labels={m.links} />
            <FooterColumn heading={m.columns.company} links={COMPANY_LINKS} labels={m.links} />
            <FooterColumn heading={m.columns.legal} links={LEGAL_LINKS} labels={m.links} />
          </div>
        </div>
        <div className="mt-11 flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(255,255,255,0.08)] pt-[22px]">
          <span className="max-w-[62ch] text-xs leading-[1.5] text-[#7E8E84]">
            {m.copyright}
          </span>
          <Link
            href="/admin"
            className="font-mono text-[11px] tracking-[0.06em] text-[#79897F] no-underline"
          >
            {m.staffLogin}
          </Link>
        </div>
      </div>
    </footer>
  );
}
