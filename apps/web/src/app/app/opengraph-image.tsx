import { ogCard } from "@/lib/og";

export { size, contentType } from "@/lib/og";
export const alt =
  "The Arcaevo app — Your trends, in your pocket and on your wrist.";

export default function Image() {
  return ogCard({
    eyebrow: "THE APP · iOS & APPLE WATCH",
    title: "Your trends, in your pocket and on your wrist.",
  });
}
