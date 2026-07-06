import { ogCard } from "@/lib/og";

export { size, contentType } from "@/lib/og";
export const alt = "Arcaevo pricing — One annual membership. Tests included.";

export default function Image() {
  return ogCard({
    eyebrow: "MEMBERSHIP & PRICING",
    title: "One annual membership. Tests included.",
    subtitle: "Fusion €119/yr · Essential €329/yr · Performance €399/yr.",
  });
}
