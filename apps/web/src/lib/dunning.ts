/**
 * Dunning state machine — pure functions (design_handoff_v2 §14 X2).
 *
 * Timeline after a failed renewal charge:
 *   day 0  → email E9 + quiet in-app banner; FULL access
 *   day 3  → automatic retry #1; banner persists, no pushes, no red
 *   day 10 → automatic retry #2
 *   day 14 → READ-ONLY pause: history visible, no new tests/insights.
 *            Nothing is ever deleted; updating the card resumes instantly.
 *
 * Stage progression is driven by Stripe `invoice.payment_failed` webhook
 * events (each failed charge/retry advances one stage) and by elapsed time
 * (dunningStageForElapsedDays) so a missed webhook can't strand a member in
 * full access forever. `invoice.paid` resolves dunning entirely.
 */
import type { DunningStage } from "@/lib/models";

/** Days after the first failure at which each stage begins. */
export const DUNNING_SCHEDULE_DAYS: Record<
  Exclude<DunningStage, "none">,
  number
> = {
  day0: 0,
  day3: 3,
  day10: 10,
  paused: 14,
};

const ORDER: DunningStage[] = ["none", "day0", "day3", "day10", "paused"];

/** Next stage after another failed charge (forward-only, clamps at paused). */
export function nextDunningStage(current: DunningStage): DunningStage {
  const i = ORDER.indexOf(current);
  return ORDER[Math.min(i + 1, ORDER.length - 1)];
}

/** Stage implied by elapsed whole days since the first failed charge. */
export function dunningStageForElapsedDays(days: number): DunningStage {
  if (days < 0) return "none";
  if (days >= DUNNING_SCHEDULE_DAYS.paused) return "paused";
  if (days >= DUNNING_SCHEDULE_DAYS.day10) return "day10";
  if (days >= DUNNING_SCHEDULE_DAYS.day3) return "day3";
  return "day0";
}

/** Convenience over Dates. */
export function dunningStageAt(firstFailedAt: Date, now: Date): DunningStage {
  const days = Math.floor(
    (now.getTime() - firstFailedAt.getTime()) / (24 * 60 * 60 * 1000)
  );
  return dunningStageForElapsedDays(days);
}

/** Read-only pause — history visible, no new tests or insights. */
export function isReadOnly(stage: DunningStage): boolean {
  return stage === "paused";
}

/** Whether the quiet in-app banner shows (any active dunning stage). */
export function isDunningActive(stage: DunningStage): boolean {
  return stage !== "none";
}

/** Successful payment (or card update → instant charge) resolves everything.
 * Unused tests carry over; membership returns to full access immediately. */
export function resolveDunning(): {
  dunningStage: DunningStage;
  dunningStartedAt: null;
} {
  return { dunningStage: "none", dunningStartedAt: null };
}

/** The date the membership pauses if nothing changes (for E9's footer). */
export function pauseDate(firstFailedAt: Date): Date {
  return new Date(
    firstFailedAt.getTime() + DUNNING_SCHEDULE_DAYS.paused * 24 * 60 * 60 * 1000
  );
}
