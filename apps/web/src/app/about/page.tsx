import type { Metadata } from "next";
import { routeMetadata } from "@/lib/seo";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = routeMetadata({
  path: "/about",
  title: "About",
  description:
    "Health data should belong to you — calm, clear, and yours. Arcaevo started in Dublin with a simple frustration: testing companies were brilliant at collecting biomarkers and useless at telling you what to do with them.",
});

const VALUES = [
  {
    t: "Your data, full stop",
    d: "EU-hosted, encrypted, and never sold or shared for advertising. Export or delete everything in one tap — no email, no wait.",
  },
  {
    t: "Honest over impressive",
    d: "We’d rather tell you a change was just noise than sell you a dashboard that celebrates it. Reference Change Value keeps us honest.",
  },
  {
    t: "Clinical humility",
    d: "We optimise wellness for healthy people. When something looks medical, we say so and point you to your GP — we don’t play doctor.",
  },
];

const STATS = [
  { n: "80", l: "markers on the deepest panel" },
  { n: "5–7", l: "days to clinician-reviewed results" },
  { n: "100%", l: "EU data residency" },
  { n: "0", l: "data ever sold" },
];

const TEAM = [
  { name: "Founder & CEO", role: "Product & company" },
  {
    name: "Medical Director",
    role: "Registered clinician · result governance",
  },
  { name: "Head of Data", role: "Fusion & rules engine" },
];

export default function AboutPage() {
  return (
    <div className="w-full overflow-x-hidden bg-bone font-sans text-ink">
      <SiteNav active="about" />

      <main>
        {/* HERO */}
        <section className="mx-auto max-w-[820px] px-10 pb-10 pt-20">
          <div className="mb-5 font-mono text-xs tracking-[0.14em] text-forest">
            ABOUT ARCAEVO
          </div>
          <h1 className="mb-6 mt-0 font-serif text-[clamp(38px,5vw,56px)] font-normal leading-[1.05] tracking-[-0.015em]">
            Health data should belong to you — calm, clear, and yours.
          </h1>
          <p className="mb-5 mt-0 text-[19px] leading-[1.6] text-muted">
            Arcaevo started in Dublin with a simple frustration: testing
            companies were brilliant at collecting biomarkers and useless at
            telling you what to do with them. You&apos;d get a PDF, a wall of
            numbers, and a shrug.
          </p>
          <p className="m-0 text-[17px] leading-[1.65] text-muted">
            We built the interpretation layer that was missing — the part that
            reads your bloods against your own baseline, fuses them with your
            Apple Watch, and hands you a short, honest list of what to change.
            Then proves whether it worked. No selling your data. No
            fear-mongering. No PDF you can&apos;t read.
          </p>
        </section>

        {/* VALUES */}
        <section className="mx-auto max-w-[1100px] px-10 py-12">
          <div className="grid gap-[18px] md:grid-cols-3">
            {VALUES.map((value) => (
              <div
                key={value.t}
                data-reveal=""
                className="rounded-[18px] border border-hairline-soft bg-surface p-[26px]"
              >
                <h2 className="mb-[10px] mt-0 text-lg font-bold tracking-[-0.01em]">
                  {value.t}
                </h2>
                <p className="m-0 text-[14.5px] leading-[1.6] text-muted">
                  {value.d}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* STATS */}
        <section className="bg-ink px-10 py-16 text-bone-white">
          <div className="mx-auto grid max-w-[1000px] grid-cols-2 gap-6 text-center md:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.l}>
                <div className="font-serif text-[46px] leading-none text-vitality-light">
                  {stat.n}
                </div>
                <div className="mt-[10px] text-[13.5px] text-muted-dark">
                  {stat.l}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* TEAM */}
        <section className="mx-auto max-w-[1000px] px-10 py-[72px]">
          <h2
            data-reveal=""
            className="mb-8 mt-0 font-serif text-[34px] font-normal tracking-[-0.01em]"
          >
            The team
          </h2>
          <div className="grid gap-[22px] md:grid-cols-3">
            {TEAM.map((member) => (
              <div key={member.name}>
                <div
                  aria-hidden="true"
                  className="mb-[14px] aspect-square w-full rounded-[18px] bg-[linear-gradient(135deg,#5FB592,#1E5C45)]"
                />
                <div className="text-base font-bold">{member.name}</div>
                <div className="mt-[2px] text-[13.5px] text-caption">
                  {member.role}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="px-10 pb-[90px]">
          <div className="mx-auto max-w-[900px] rounded-card-xl border border-hairline-soft bg-surface px-10 py-[52px] text-center">
            <h2 className="mb-3 mt-0 font-serif text-[32px] font-normal">
              Want to build this with us?
            </h2>
            <p className="mb-6 mt-0 text-base text-muted">
              We&apos;re a small team in Dublin, hiring across engineering,
              clinical and design.
            </p>
            <div className="flex flex-wrap justify-center gap-[14px]">
              <Link
                href="/careers"
                className="inline-block rounded-pill bg-forest px-7 py-[14px] font-semibold text-white no-underline"
              >
                See open roles
              </Link>
              <Link
                href="/contact"
                className="inline-block rounded-pill border border-ink px-7 py-[14px] font-semibold text-ink no-underline"
              >
                Get in touch
              </Link>
            </div>
            <p className="mx-auto mt-8 mb-0 max-w-[600px] text-[13px] leading-[1.6] text-caption">
              Arcaevo is a product of Codú Limited, a company registered in
              Ireland. Wellness and optimisation, not medical diagnosis.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
