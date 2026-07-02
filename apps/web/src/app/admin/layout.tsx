import type { Metadata } from "next";

/**
 * Outer /admin layout — metadata only (noindex; robots.ts also disallows
 * /admin). The auth gate + admin chrome live in the (panel) route group so
 * /admin/login stays reachable when signed out.
 */
export const metadata: Metadata = {
  title: {
    template: "%s — Arcaevo Admin",
    default: "Admin — Arcaevo",
  },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
