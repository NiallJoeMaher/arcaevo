import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { consentState } from "@/lib/consents";
import { currentMember } from "@/components/account/session";
import ConsentSection from "./ConsentSection";
import ShareLinksSection from "./ShareLinksSection";

export const metadata: Metadata = {
  title: "Data & privacy",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * W11 · Data & privacy (design §04 + §10 + §15).
 * The same three consent switches from the gate, GP share links with
 * create/revoke, and the honest exit — GDPR erasure and consent withdrawal
 * converge on one flow.
 */
export default async function PrivacyPage() {
  const member = await currentMember();
  if (!member) redirect("/signin");

  const state = await consentState(member._id);
  const granted = (purpose: string) =>
    state.current.find((c) => c.purpose === purpose)?.granted ?? false;

  return (
    <div>
      <h1 className="sr-only">Account — Data &amp; privacy</h1>
      <ConsentSection
        initial={{
          health_processing: granted("health_processing"),
          clinician_review: granted("clinician_review"),
          research: granted("research"),
        }}
      />
      <ShareLinksSection />
    </div>
  );
}
