import Link from "next/link";

const PRODUCT_LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/app", label: "The app" },
  { href: "/science", label: "Science" },
  { href: "/compare", label: "Compare" },
];

const COMPANY_LINKS = [
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
  { href: "/careers", label: "Careers" },
  { href: "/contact", label: "Contact" },
  { href: "/help", label: "Help centre" },
];

const LEGAL_LINKS = [
  { href: "/legal/privacy", label: "Privacy policy" },
  { href: "/legal/data-deletion", label: "Data deletion & export" },
  { href: "/legal/gdpr-consent", label: "GDPR consent" },
  { href: "/legal/cookies", label: "Cookie policy" },
  { href: "/legal/terms", label: "Terms of service" },
  { href: "/legal/dpa", label: "Sub-processors" },
  { href: "/legal/clinical-safety", label: "Clinical safety" },
];

function FooterColumn({
  heading,
  links,
}: {
  heading: string;
  links: { href: string; label: string }[];
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
          {link.label}
        </Link>
      ))}
    </div>
  );
}

export default function SiteFooter() {
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
              The interpretation layer for your health. Bloods fused with
              wearables, read off your own baseline. Dublin, Ireland.
            </p>
            <div className="flex gap-[10px]">
              <Link
                href="/app"
                className="rounded-pill border border-[rgba(255,255,255,0.14)] px-[13px] py-[7px] font-mono text-[11px] text-muted-dark no-underline"
              >
                iOS App
              </Link>
              <Link
                href="/app"
                className="rounded-pill border border-[rgba(255,255,255,0.14)] px-[13px] py-[7px] font-mono text-[11px] text-muted-dark no-underline"
              >
                Apple Watch
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap gap-12">
            <FooterColumn heading="PRODUCT" links={PRODUCT_LINKS} />
            <FooterColumn heading="COMPANY" links={COMPANY_LINKS} />
            <FooterColumn heading="TRUST & LEGAL" links={LEGAL_LINKS} />
          </div>
        </div>
        <div className="mt-11 flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(255,255,255,0.08)] pt-[22px]">
          <span className="max-w-[62ch] text-xs leading-[1.5] text-[#6E7E74]">
            © 2026 Arcaevo Health, Ireland · Wellness &amp; optimisation, not
            medical diagnosis. Always consult your GP for medical concerns.
          </span>
          <Link
            href="/admin"
            className="font-mono text-[11px] tracking-[0.06em] text-[#5B6A61] no-underline"
          >
            Staff login →
          </Link>
        </div>
      </div>
    </footer>
  );
}
