import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentMember } from "@/components/account/session";
import { AuthShell } from "@/components/account/ui";
import { bloodTiersEnabled } from "@/lib/env";
import BookingClient from "./BookingClient";

export const metadata: Metadata = {
  title: "Book your nurse",
  description:
    "Morning slots, fasted. 20 minutes at your home or desk. Free reschedule up to 24h before.",
  robots: { index: false },
};

/** Deterministic mock availability: the next Tue/Wed/Thu, morning slots. */
function nextTueWedThu(from: Date): { iso: string; day: string; month: string }[] {
  const days: Date[] = [];
  const cursor = new Date(from);
  cursor.setDate(cursor.getDate() + 1);
  while (days.length < 3) {
    const dow = cursor.getDay(); // 2=Tue 3=Wed 4=Thu
    if (dow >= 2 && dow <= 4) days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days.map((d) => ({
    iso: d.toISOString().slice(0, 10),
    day: new Intl.DateTimeFormat("en-IE", {
      weekday: "short",
      day: "numeric",
    }).format(d),
    month: new Intl.DateTimeFormat("en-IE", { month: "long" }).format(d),
  }));
}

export default async function BookPage() {
  // Nurse booking is a blood-tier (Performance venous) affordance — not
  // reachable while blood tiers are off (matches the orders-route gate).
  if (!bloodTiersEnabled()) redirect("/pricing");

  const member = await currentMember();
  if (!member) redirect("/signin");

  return (
    <AuthShell>
      <BookingClient days={nextTueWedThu(new Date())} />
    </AuthShell>
  );
}
