import type { Metadata } from "next";
import { AuthShell } from "@/components/account/ui";
import JoinForm from "./JoinForm";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Free. No card, no commitment — Dublin or not. One field to start; the password is optional.",
  robots: { index: false },
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  return (
    <AuthShell>
      <JoinForm initialRef={ref ?? null} />
    </AuthShell>
  );
}
