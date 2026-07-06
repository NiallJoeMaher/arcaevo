import { blogIndexMeta } from "@/content/articles";
import { ogCard } from "@/lib/og";

export { size, contentType } from "@/lib/og";
export const alt =
  "The Arcaevo Journal — Clear answers about your health data.";

export default function Image() {
  return ogCard({
    eyebrow: blogIndexMeta.kicker,
    title: blogIndexMeta.title,
  });
}
