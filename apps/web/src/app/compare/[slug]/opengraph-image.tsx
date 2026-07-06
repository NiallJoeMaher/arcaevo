import { compareIndexMeta, getVersusPage } from "@/content/compare";
import { ogCard } from "@/lib/og";

export { size, contentType } from "@/lib/og";
export const alt = "Arcaevo comparison";

/** Per-versus card: title matches the page's metadata title. */
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getVersusPage(slug);
  if (!page) {
    // Unknown slug (page itself 404s): fall back to the compare index card.
    return ogCard({
      eyebrow: compareIndexMeta.kicker,
      title: compareIndexMeta.title,
    });
  }
  return ogCard({
    eyebrow: compareIndexMeta.kicker,
    title: `Arcaevo vs ${page.name}: which should you choose?`,
  });
}
