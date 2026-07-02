"use client";

/**
 * W9 · SUCCESS — WHAT HAPPENS NEXT (design §07).
 *
 * Plan-aware: Essential leads with the kit shipping; Performance replaces
 * step 01 with "Book your nurse visit" — straight into the scheduler (§08);
 * Fusion (nothing ships) leads with uploading past bloodwork, which lives in
 * the app. Guests arriving without a session are greeted from the checkout
 * stash (sessionStorage) — never from anything email-ish.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, primaryBtnCls, secondaryBtnCls } from "@/components/account/ui";

export type WelcomeTier = "essential" | "performance" | "fusion";

interface Stash {
  tier?: string;
  name?: string;
  email?: string;
}

export default function WelcomeClient({
  tier,
  member,
}: {
  tier: WelcomeTier;
  member: { name: string; email: string } | null;
}) {
  const [stash, setStash] = useState<Stash | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("arcaevo:welcome");
      if (raw) setStash(JSON.parse(raw) as Stash);
    } catch {
      /* nothing stashed */
    }
  }, []);

  const name = member?.name ?? stash?.name ?? "";
  const firstName = name.split(" ")[0] ?? "";
  const email = member?.email ?? stash?.email ?? "";

  const steps: { title: string; rest: string; href?: string }[] =
    tier === "performance"
      ? [
          {
            title: "Book your nurse visit.",
            rest: " Morning slots, fasted — 20 minutes at your home or desk.",
            href: "/book",
          },
          {
            title: "Get the app",
            rest: " so your Watch data is already flowing when results land.",
          },
        ]
      : tier === "fusion"
        ? [
            {
              title: "Upload any past bloodwork",
              rest: " in the app — a photo or PDF is enough. You confirm every value before it counts.",
            },
            {
              title: "Get the app",
              rest: " so your Watch data is already flowing when results land.",
            },
          ]
        : [
            {
              title: "Your kit ships today.",
              rest: " Track it from Account or the app — typically 1–2 working days.",
            },
            {
              title: "Get the app",
              rest: " so your Watch data is already flowing when results land.",
            },
            {
              title: "Test on a Tuesday–Thursday morning",
              rest: ", fasted, and post the same day.",
            },
          ];

  return (
    <Card>
      <div className="px-7 pb-7 pt-[30px]">
        <div
          aria-hidden="true"
          className="mb-4 h-[52px] w-[52px] rounded-full bg-[rgba(52,160,124,0.14)] text-center text-[24px] leading-[52px] text-forest"
        >
          ✓
        </div>
        <h1 className="mb-2 font-serif text-[24px] font-normal leading-[1.15]">
          {firstName ? `You're a member, ${firstName}.` : "You're a member."}
        </h1>
        <p className="mb-5 text-[13px] leading-[1.55] text-caption">
          {email ? `Receipt sent to ${email}` : "Receipt sent to your inbox"}
        </p>

        {steps.map((step, i) => (
          <div key={step.title} className="mb-3 flex gap-3">
            <span className="w-5 shrink-0 font-mono text-[11px] leading-[1.5] text-forest">
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="text-[13px] leading-[1.5]">
              {step.href ? (
                <Link href={step.href} className="text-ink no-underline">
                  <strong>{step.title}</strong>
                </Link>
              ) : (
                <strong>{step.title}</strong>
              )}
              {step.rest}
            </p>
          </div>
        ))}

        <div className="mt-5">
          {tier === "performance" ? (
            <>
              <Link href="/book" className={`${primaryBtnCls} mb-[10px] no-underline`}>
                Book your nurse visit
              </Link>
              <Link href="/app" className={`${secondaryBtnCls} no-underline`}>
                Download for iPhone
              </Link>
            </>
          ) : (
            <Link href="/app" className={`${primaryBtnCls} no-underline`}>
              Download for iPhone
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
