import { ogCard } from "@/lib/og";

export { size, contentType } from "@/lib/og";
export const alt = "Arcaevo — The interpretation layer for your health";

/**
 * Home + site-wide default OG card (this segment IS "/", and it cascades to
 * every child route without its own opengraph-image). Wordmark-led brand
 * card; eyebrow/tagline verbatim from the home hero and site footer.
 */
export default function Image() {
  return ogCard({
    brand: true,
    eyebrow: "THE INTERPRETATION LAYER · DUBLIN",
    title: "Arcaevo",
    subtitle:
      "The interpretation layer for your health. Bloods fused with wearables, read off your own baseline.",
  });
}
