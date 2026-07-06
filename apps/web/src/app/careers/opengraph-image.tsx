import { ogCard } from "@/lib/og";

export { size, contentType } from "@/lib/og";
export const alt =
  "Careers at Arcaevo — Build the layer that makes health data usable.";

export default function Image() {
  return ogCard({
    eyebrow: "CAREERS · DUBLIN / REMOTE-EU",
    title: "Build the layer that makes health data usable.",
  });
}
