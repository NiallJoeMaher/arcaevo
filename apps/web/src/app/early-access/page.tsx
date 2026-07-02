import type { Metadata } from "next";
import { AuthShell } from "@/components/account/ui";
import EarlyAccessForm from "./EarlyAccessForm";

export const metadata: Metadata = {
  title: "Early access",
  description:
    "We're starting in Dublin. Join the early-access list and we'll open your area in order of demand — first booking and founding-member pricing.",
};

export default async function EarlyAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ eircode?: string }>;
}) {
  const { eircode } = await searchParams;
  return (
    <AuthShell>
      <EarlyAccessForm initialEircode={eircode ?? ""} />
    </AuthShell>
  );
}
