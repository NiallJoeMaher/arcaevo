import type { Metadata } from "next";
import { AuthShell } from "@/components/account/ui";
import GiftForm from "./GiftForm";

export const metadata: Metadata = {
  title: "Gift Essential",
  description:
    "Give someone a year of knowing. A full Essential year — two tests, the app, everything. Their year starts when they activate.",
};

export default function GiftPage() {
  return (
    <AuthShell>
      <GiftForm />
    </AuthShell>
  );
}
