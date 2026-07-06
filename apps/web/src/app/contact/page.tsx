import type { Metadata } from "next";
import { routeMetadata } from "@/lib/seo";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import ContactForm from "./ContactForm";

export const metadata: Metadata = routeMetadata({
  path: "/contact",
  title: "Contact",
  description:
    "Talk to a human. Support, press, partnerships or a clinical question — we read everything and reply within one working day.",
});

const CHANNELS = [
  {
    icon: "✉",
    t: "General & support",
    d: "Account help, orders, anything about the app.",
    v: "hello@arcaevo.com",
  },
  {
    icon: "⚕",
    t: "Clinical questions",
    d: "Reviewed by our medical team, not the coach.",
    v: "clinical@arcaevo.com",
  },
  {
    icon: "🔒",
    t: "Data & privacy",
    d: "Access, export or deletion requests.",
    v: "privacy@arcaevo.com",
  },
  {
    icon: "📣",
    t: "Press & partnerships",
    d: "Media, labs, and integration partners.",
    v: "press@arcaevo.com",
  },
];

export default function ContactPage() {
  return (
    <div className="w-full overflow-x-hidden bg-bone font-sans text-ink">
      <SiteNav active="contact" />

      <main>
        <section className="mx-auto grid max-w-[1080px] gap-14 px-[22px] md:px-10 pb-20 pt-[72px] lg:grid-cols-2">
          <div>
            <div className="mb-5 font-mono text-xs tracking-[0.14em] text-forest">
              CONTACT
            </div>
            <h1 className="mb-[22px] mt-0 font-serif text-[clamp(36px,4.6vw,50px)] max-md:text-[clamp(34px,9.5vw,42px)] font-normal leading-[1.05] tracking-[-0.015em]">
              Talk to a human.
            </h1>
            <p className="mb-[34px] mt-0 max-w-[40ch] text-[17px] leading-[1.6] text-muted">
              Support, press, partnerships or a clinical question — we read
              everything and reply within one working day.
            </p>
            <div className="flex flex-col gap-5">
              {CHANNELS.map((channel) => (
                <div key={channel.t} className="flex items-start gap-4">
                  <div
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface text-lg"
                  >
                    {channel.icon}
                  </div>
                  <div>
                    <div className="text-[15px] font-semibold">
                      {channel.t}
                    </div>
                    <div className="mt-[2px] text-sm text-muted">
                      {channel.d}
                    </div>
                    <div className="mt-1 font-mono text-[12.5px] text-forest">
                      {channel.v}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-[34px] border-t border-hairline pt-6 text-[13.5px] leading-[1.6] text-caption">
              Arcaevo is a product of Codú Limited, registered in Ireland
              (CRO [TODO: CRO number]) · Dublin, Ireland
              <br />
              Codú Limited is the (interim) data controller for GDPR purposes.
              See our{" "}
              <Link href="/legal/privacy" className="text-forest no-underline">
                privacy policy
              </Link>
              .
            </div>
          </div>

          <ContactForm />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
