import { ogCard } from "@/lib/og";

export { size, contentType } from "@/lib/og";
export const alt = "Contact Arcaevo — Talk to a human.";

export default function Image() {
  return ogCard({
    eyebrow: "CONTACT",
    title: "Talk to a human.",
    subtitle:
      "Support, press, partnerships or a clinical question — we reply within one working day.",
  });
}
