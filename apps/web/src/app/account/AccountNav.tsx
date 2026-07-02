"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Sidebar per design §10 W10. Sections without a page yet are marked so —
 * sessions live under Sign-in & security; the rest arrive with the app. */
const ITEMS: { label: string; href: string | null; alias?: boolean }[] = [
  { label: "Membership", href: "/account" },
  { label: "Personal details", href: null },
  { label: "Sign-in & security", href: "/account/security" },
  { label: "Data & privacy", href: "/account/privacy" },
  // Sessions live on the security page until the app's device list lands.
  { label: "Devices & sessions", href: "/account/security", alias: true },
  { label: "Notifications", href: null },
];

export default function AccountNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Account"
      className="border-b border-hairline-soft py-3 sm:border-b-0 sm:border-r sm:py-[22px]"
    >
      <ul className="flex flex-wrap sm:block">
        {ITEMS.map((item) => {
          const active = item.href === pathname && !item.alias;
          if (!item.href) {
            return (
              <li key={item.label}>
                <span className="block px-[18px] py-[9px] text-[12.5px] text-muted opacity-45">
                  {item.label}
                </span>
              </li>
            );
          }
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "block border-forest bg-[rgba(52,160,124,0.1)] px-[18px] py-[9px] text-[12.5px] font-bold text-forest no-underline sm:border-r-2"
                    : "block px-[18px] py-[9px] text-[12.5px] text-muted no-underline"
                }
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
