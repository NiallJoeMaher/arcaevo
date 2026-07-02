import type { Metadata } from "next";
import { currentMember } from "@/components/account/session";
import { AuthShell } from "@/components/account/ui";
import RedeemForm from "./RedeemForm";

export const metadata: Metadata = {
  title: "Redeem a gift",
  description:
    "A gift code slots into the normal sign-up flow — same account, same consent gate, same Eircode check.",
};

export default async function RedeemPage() {
  const member = await currentMember();
  return (
    <AuthShell>
      <RedeemForm signedIn={Boolean(member)} email={member?.email ?? null} />
    </AuthShell>
  );
}
