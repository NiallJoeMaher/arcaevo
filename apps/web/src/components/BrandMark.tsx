/**
 * The Arcaevo mark — the two-stroke "A" arc (design_handoff_motion_haptics,
 * logo rules in MOTION.md). Single colour via currentColor: Forest #1E5C45 on
 * light surfaces, #7FD3AE on dark. viewBox is 643×495 (~1.3:1) — never
 * stretch, never redraw, never animate (the mark is the one permanently
 * still element on every page). Minimum rendered width 16px.
 */
export default function BrandMark({
  width = 22,
  className = "",
}: {
  width?: number;
  className?: string;
}) {
  const height = Math.round((width * 495) / 643);
  return (
    <svg
      viewBox="0 0 643 495"
      width={width}
      height={height}
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        fill="currentColor"
        d="M239.5 40.5L135.5 238C169.985 215.919 206.5 210.5 245.5 210.5C284.5 210.5 307.5 220.5 330.5 244.5C353.5 268.5 466 494.5 466 494.5H643L403.5 40.5C382.222 16.3216 365.74 2.81888 323.5 0C280.811 0.0641026 264.041 11.5171 239.5 40.5Z"
      />
      <path
        fill="currentColor"
        d="M121.5 306C75 335 34.893 414.244 0 494.5C87.4362 492.587 130.672 479.973 194 430C215.163 416.437 232.783 396.308 294.5 274.5C200.79 267.004 168 277 121.5 306Z"
      />
    </svg>
  );
}
