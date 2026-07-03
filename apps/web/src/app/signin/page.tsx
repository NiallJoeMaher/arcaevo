import type { Metadata } from "next";
import { AuthShell } from "@/components/account/ui";
import SigninForm from "./SigninForm";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Welcome back. Sign in with your password, or skip it — we'll email you a link.",
  robots: { index: false },
};

export default async function SigninPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; code?: string }>;
}) {
  const { email, code } = await searchParams;
  return (
    <AuthShell>
      <SigninForm initialEmail={email ?? ""} codeFirst={code === "1"} />
    </AuthShell>
  );
}
