import type { Metadata } from "next";
import { routeMetadata } from "@/lib/seo";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = routeMetadata({
  path: "/careers",
  title: "Careers",
  description:
    "Build the layer that makes health data usable. We're a small, senior team in Dublin working at the intersection of clinical rigour and beautiful software — Dublin or remote-EU.",
});

const PERKS = [
  {
    t: "Senior-only team",
    d: "Small, high-trust, low process. Ship real things.",
  },
  {
    t: "Free membership",
    d: "Performance plan for you and a family member.",
  },
  {
    t: "Dublin or remote-EU",
    d: "Office in Dublin 2, async-friendly across the EU.",
  },
  {
    t: "Meaningful equity",
    d: "Early team, real ownership in the outcome.",
  },
];

const ROLES = [
  {
    title: "Senior iOS Engineer",
    meta: "SwiftUI · HealthKit · offline-first · Dublin/Remote-EU",
    team: "ENGINEERING",
  },
  {
    title: "Clinical Data Scientist",
    meta: "Biomarker rules, RCV modelling, fusion signals",
    team: "DATA",
  },
  {
    title: "Registered Clinician (Reviewer)",
    meta: "Part-time · result governance & escalation",
    team: "CLINICAL",
  },
  {
    title: "Product Designer",
    meta: "Calm, editorial product & marketing surfaces",
    team: "DESIGN",
  },
  {
    title: "Operations & Logistics Lead",
    meta: "Kit fulfilment, phlebotomy network, lab liaison",
    team: "OPS",
  },
];

export default function CareersPage() {
  return (
    <div className="w-full overflow-x-hidden bg-bone font-sans text-ink">
      <SiteNav active="careers" />

      <main>
        {/* HERO */}
        <section className="mx-auto max-w-[820px] px-10 pb-10 pt-20">
          <div className="mb-5 font-mono text-xs tracking-[0.14em] text-forest">
            CAREERS · DUBLIN / REMOTE-EU
          </div>
          <h1 className="mb-[22px] mt-0 font-serif text-[clamp(38px,5vw,56px)] font-normal leading-[1.05] tracking-[-0.015em]">
            Build the layer that makes health data usable.
          </h1>
          <p className="m-0 max-w-[56ch] text-lg leading-[1.6] text-muted">
            We&apos;re a small, senior team in Dublin working at the
            intersection of clinical rigour and beautiful software. If
            deterministic rules, honest metrics and calm design excite you,
            we&apos;d love to talk.
          </p>
        </section>

        {/* PERKS */}
        <section className="mx-auto max-w-[1000px] px-10 py-8">
          <div className="grid gap-[14px] sm:grid-cols-2 md:grid-cols-4">
            {PERKS.map((perk) => (
              <div
                key={perk.t}
                data-reveal=""
                className="rounded-card-sm border border-hairline-soft bg-surface p-[18px]"
              >
                <div className="mb-1 text-[14.5px] font-semibold">
                  {perk.t}
                </div>
                <div className="text-[13px] leading-[1.5] text-muted">
                  {perk.d}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ROLES */}
        <section className="mx-auto max-w-[1000px] px-10 pb-10 pt-8">
          <h2
            data-reveal=""
            className="mb-6 mt-0 font-serif text-[32px] font-normal tracking-[-0.01em]"
          >
            Open roles
          </h2>
          <div className="flex flex-col gap-3">
            {ROLES.map((role) => (
              <Link
                key={role.title}
                href="/contact"
                className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-hairline-soft bg-surface px-[26px] py-[22px] text-inherit no-underline"
              >
                <div>
                  <div className="mb-1 text-[17px] font-bold">
                    {role.title}
                  </div>
                  <div className="text-[13.5px] text-muted">{role.meta}</div>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <span className="rounded-pill bg-[rgba(30,92,69,0.1)] px-3 py-[6px] font-mono text-[11px] text-forest">
                    {role.team}
                  </span>
                  <span className="font-semibold text-forest">Apply →</span>
                </div>
              </Link>
            ))}
          </div>
          <p className="mb-0 mt-6 text-sm text-caption">
            Don&apos;t see your role? We&apos;re always glad to meet
            exceptional people —{" "}
            <Link href="/contact" className="text-forest no-underline">
              tell us what you&apos;d build →
            </Link>
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
