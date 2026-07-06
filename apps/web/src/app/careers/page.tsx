import type { Metadata } from "next";
import { routeMetadata } from "@/lib/seo";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import BrandMark from "@/components/BrandMark";

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

/**
 * No roles are open right now (EMPTY_STATES.md, 2026-07-06). Add entries like
 *   { title: "Senior iOS Engineer", meta: "SwiftUI · HealthKit · Dublin/Remote-EU", team: "ENGINEERING" }
 * to re-open the board — the empty state below hides automatically.
 */
const ROLES: { title: string; meta: string; team: string }[] = [];

export default function CareersPage() {
  return (
    <div className="w-full overflow-x-hidden bg-bone font-sans text-ink">
      <SiteNav active="careers" />

      <main>
        {/* HERO */}
        <section className="mx-auto max-w-[820px] px-[22px] md:px-10 pb-10 pt-20">
          <div className="mb-5 font-mono text-xs tracking-[0.14em] text-forest">
            CAREERS · DUBLIN / REMOTE-EU
          </div>
          <h1 className="mb-[22px] mt-0 font-serif text-[clamp(38px,5vw,56px)] max-md:text-[clamp(34px,9.5vw,42px)] font-normal leading-[1.05] tracking-[-0.015em]">
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
        <section className="mx-auto max-w-[1000px] px-[22px] md:px-10 py-8">
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
        <section className="mx-auto max-w-[1000px] px-[22px] md:px-10 pb-10 pt-8">
          <h2
            data-reveal=""
            className="mb-6 mt-0 font-serif text-[32px] font-normal tracking-[-0.01em]"
          >
            Open roles
          </h2>
          {ROLES.length > 0 && (
            <>
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
                      <div className="text-[13.5px] text-muted">
                        {role.meta}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <span className="rounded-pill bg-[rgba(30,92,69,0.1)] px-3 py-[6px] font-mono text-[11px] text-forest">
                        {role.team}
                      </span>
                      <span className="font-semibold text-forest">
                        Apply →
                      </span>
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
            </>
          )}
          {ROLES.length === 0 && (
            <div
              data-reveal=""
              className="rounded-[22px] border-[1.5px] border-dashed border-[rgba(28,38,32,0.18)] bg-surface px-10 py-14 text-center"
            >
              <BrandMark
                width={30}
                className="mx-auto mb-5 text-forest opacity-80"
              />
              <h3 className="mb-3 mt-0 font-serif text-[30px] font-normal leading-[1.1]">
                Nothing open right now.
              </h3>
              <p className="mx-auto mb-[26px] mt-0 max-w-[48ch] text-[15px] leading-[1.6] text-muted">
                We hire slowly and deliberately — a small senior team stays
                small until the product demands otherwise. New roles appear
                here first, usually engineering and clinical.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-[14px]">
                <Link
                  href="/contact"
                  className="rounded-pill bg-forest px-[26px] py-[13px] text-[15px] font-semibold text-white no-underline"
                >
                  Introduce yourself anyway →
                </Link>
                <Link
                  href="/blog"
                  className="text-sm font-semibold text-forest no-underline"
                >
                  We announce roles on the journal first →
                </Link>
              </div>
              <div className="mt-6 font-mono text-[10px] tracking-[0.1em] text-caption">
                EXCEPTIONAL PEOPLE ALWAYS READ · NO CV FORMAT REQUIRED
              </div>
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
