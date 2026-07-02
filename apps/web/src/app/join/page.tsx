import type { Metadata } from "next";
import { AuthShell } from "@/components/account/ui";
import JoinForm from "./JoinForm";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Free. No card, no commitment — Dublin or not. One field to start; the password is optional.",
  robots: { index: false },
};

export default function JoinPage() {
  return (
    <AuthShell>
      <JoinForm />
    </AuthShell>
  );
}
