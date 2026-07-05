import type { Metadata } from "next";
import { Geist_Mono, Hanken_Grotesk, Instrument_Serif } from "next/font/google";
import "./globals.css";
import {
  SITE_URL,
  OG_LOCALE,
  hreflangFor,
  jsonLd,
  websiteJsonLd,
} from "@/lib/seo";
import { getLocale } from "@/i18n/server";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken-grotesk",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: "%s — Arcaevo",
    default: "Arcaevo — The interpretation layer for your health",
  },
  description:
    "Everyone else hands you a panel of biomarkers and walks away. Arcaevo fuses your bloods with your Apple Watch, reads them off your own baseline, and gives you two things to change — then proves whether they worked.",
  // Site-wide defaults. Content routes override alternates/openGraph via
  // routeMetadata() (Next merges metadata shallowly), re-supplying these.
  alternates: {
    canonical: "/",
    languages: hreflangFor("/"),
  },
  openGraph: {
    type: "website",
    siteName: "Arcaevo",
    locale: OG_LOCALE,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolve the visitor's locale from request headers so <html lang> reflects
  // the negotiated locale (content-negotiation on a single URL structure).
  // Reading headers opts the tree into dynamic rendering; the Ireland-first
  // en-IE default keeps ambiguous/EU/IE requests correct. See docs/LOCALIZATION.md.
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${instrumentSerif.variable} ${hankenGrotesk.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen bg-bone font-sans text-ink">
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(websiteJsonLd) }}
        />
      </body>
    </html>
  );
}
