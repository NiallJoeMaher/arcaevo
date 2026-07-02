"use client";

/**
 * A2 · BOOK YOUR NURSE — PERFORMANCE (design §08).
 *
 * Morning slots only (fasted draw), 20 minutes at home or desk.
 *
 * TODO(booking API): there is no /api/v1 endpoint for phlebotomy booking yet
 * — TestOrder.bookingStatus ("unbooked" → "nurse_booked") is only written by
 * the seed/admin today. When a booking endpoint lands, POST the selected
 * slot to the member's open venous order here. Until then this confirms
 * locally so the designed flow is walkable end-to-end.
 */
import { useState } from "react";
import Link from "next/link";
import { Card, primaryBtnCls } from "@/components/account/ui";

const SLOT_TIMES = ["07:30", "08:15", "09:00", "09:45"] as const;

export default function BookingClient({
  days,
}: {
  days: { iso: string; day: string; month: string }[];
}) {
  const [dayIdx, setDayIdx] = useState(1);
  const [time, setTime] = useState<string>("08:15");
  const [confirmed, setConfirmed] = useState(false);

  const selected = days[dayIdx];
  const slotLabel = `${selected.day} ${selected.month}, ${time}`;

  if (confirmed) {
    return (
      <Card>
        <div className="p-7" aria-live="polite">
          <div
            aria-hidden="true"
            className="mb-4 h-[52px] w-[52px] rounded-full bg-[rgba(52,160,124,0.14)] text-center text-[24px] leading-[52px] text-forest"
          >
            ✓
          </div>
          <h1 className="mb-[6px] font-serif text-[23px] font-normal leading-[1.15]">
            Booked — {slotLabel}
          </h1>
          <p className="mb-[18px] text-[12.5px] leading-[1.6] text-caption">
            Free reschedule up to 24h before · fasting reminder the night prior
          </p>
          <Link href="/account" className={`${primaryBtnCls} no-underline`}>
            Back to Account
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-7">
        <h1 className="mb-[6px] font-serif text-[23px] font-normal leading-[1.15]">
          When should we come?
        </h1>
        <p className="mb-[18px] text-[12.5px] text-caption">
          Morning slots, fasted. 20 minutes at your home or desk.
        </p>

        <fieldset className="mb-[10px] border-0 p-0">
          <legend className="sr-only">Choose a day</legend>
          <div className="grid grid-cols-3 gap-2">
            {days.map((d, i) => (
              <button
                key={d.iso}
                type="button"
                onClick={() => setDayIdx(i)}
                aria-pressed={i === dayIdx}
                className={
                  i === dayIdx
                    ? "cursor-pointer rounded-[10px] border-[1.5px] border-forest bg-[rgba(52,160,124,0.08)] px-[6px] py-[10px] text-center text-[12px]"
                    : "cursor-pointer rounded-[10px] border border-[rgba(28,38,32,0.14)] px-[6px] py-[10px] text-center text-[12px]"
                }
              >
                <span className="block font-bold">{d.day}</span>
                <span
                  className={
                    i === dayIdx
                      ? "block text-[11px] font-semibold text-forest"
                      : "block text-[11px] text-caption"
                  }
                >
                  {d.month}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mb-[18px] border-0 p-0">
          <legend className="sr-only">Choose a time</legend>
          <div className="flex flex-wrap gap-2">
            {SLOT_TIMES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTime(t)}
                aria-pressed={t === time}
                className={
                  t === time
                    ? "cursor-pointer rounded-pill border-[1.5px] border-forest bg-[rgba(52,160,124,0.08)] px-[14px] py-2 font-mono text-[12px] font-medium text-forest"
                    : "cursor-pointer rounded-pill border border-[rgba(28,38,32,0.14)] px-[14px] py-2 font-mono text-[12px]"
                }
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>

        <button
          type="button"
          onClick={() => setConfirmed(true)}
          className={`${primaryBtnCls} mb-[10px]`}
        >
          Confirm — {slotLabel}
        </button>
        <p className="text-center text-[11.5px] text-caption">
          Free reschedule up to 24h before · fasting reminder the night prior
        </p>
      </div>
    </Card>
  );
}
