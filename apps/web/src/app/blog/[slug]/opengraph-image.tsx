import { blogIndexMeta, getArticle } from "@/content/articles";
import { ogCard } from "@/lib/og";

export { size, contentType } from "@/lib/og";
export const alt = "Arcaevo Journal article";

/** Per-post card: kicker/category/read-time verbatim from the article. */
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getArticle(slug);
  if (!post) {
    // Unknown slug (page itself 404s): fall back to the Journal index card.
    return ogCard({
      eyebrow: blogIndexMeta.kicker,
      title: blogIndexMeta.title,
    });
  }
  return ogCard({
    eyebrow: `${blogIndexMeta.kicker} · ${post.cat} · ${post.read}`,
    title: post.title,
  });
}
