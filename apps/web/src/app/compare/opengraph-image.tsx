import { compareIndexMeta } from "@/content/compare";
import { ogCard } from "@/lib/og";

export { size, contentType } from "@/lib/og";
export const alt = "Arcaevo vs the rest of at-home health testing.";

export default function Image() {
  return ogCard({
    eyebrow: compareIndexMeta.kicker,
    title: compareIndexMeta.title,
  });
}
