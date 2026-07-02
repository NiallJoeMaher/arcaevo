import type { Metadata } from "next";
import { AuthShell } from "@/components/account/ui";
import VerifyClient from "./VerifyClient";

export const metadata: Metadata = {
  title: "Check your inbox",
  description: "Confirm your email to continue. Links are valid for 30 minutes.",
  robots: { index: false },
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; reset?: string; email?: string }>;
}) {
  const { token, reset, email } = await searchParams;
  return (
    <AuthShell>
      <VerifyClient
        token={token ?? null}
        reset={reset === "1"}
        email={email ?? null}
      />
    </AuthShell>
  );
}
