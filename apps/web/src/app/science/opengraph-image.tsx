import { ogCard } from "@/lib/og";

export { size, contentType } from "@/lib/og";
export const alt =
  "Arcaevo science — The logic is deterministic. The AI only narrates.";

export default function Image() {
  return ogCard({
    eyebrow: "SCIENCE & EVIDENCE",
    title: "The logic is deterministic. The AI only narrates.",
  });
}
