import { ogCard } from "@/lib/og";

export { size, contentType } from "@/lib/og";
export const alt = "Arcaevo help centre — How can we help?";

export default function Image() {
  return ogCard({
    eyebrow: "HELP CENTRE",
    title: "How can we help?",
    subtitle:
      "Testing & samples, results & the app, billing & membership, privacy & data.",
  });
}
