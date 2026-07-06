import { ogCard } from "@/lib/og";

export { size, contentType } from "@/lib/og";
export const alt =
  "How Arcaevo works — From a drop of blood to a two-line plan.";

export default function Image() {
  return ogCard({
    eyebrow: "HOW IT WORKS",
    title: "From a drop of blood to a two-line plan.",
  });
}
