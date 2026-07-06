import { ogCard } from "@/lib/og";

export { size, contentType } from "@/lib/og";
export const alt =
  "About Arcaevo — Health data should belong to you: calm, clear, and yours.";

export default function Image() {
  return ogCard({
    eyebrow: "ABOUT ARCAEVO",
    title: "Health data should belong to you — calm, clear, and yours.",
  });
}
