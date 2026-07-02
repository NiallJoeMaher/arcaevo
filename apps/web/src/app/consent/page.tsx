import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentMember } from "@/components/account/session";
import { AuthShell } from "@/components/account/ui";
import ConsentForm from "./ConsentForm";

export const metadata: Metadata = {
  title: "Your health data, on your terms",
  description:
    "Before Arcaevo can read a blood result or a night's sleep, we need your explicit permission.",
  robots: { index: false },
};

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ next }, member] = await Promise.all([
    searchParams,
    currentMember(),
  ]);
  if (!member) redirect("/signin");

  return (
    <AuthShell width={420}>
      <ConsentForm next={next === "checkout" ? "/checkout" : "/account"} />
    </AuthShell>
  );
}
