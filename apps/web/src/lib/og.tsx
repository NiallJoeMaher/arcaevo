/**
 * Shared Open Graph card builder for the file-convention metadata images
 * (opengraph-image.tsx / twitter-image.tsx) rendered with next/og.
 *
 * Design: brand tokens from the handoff — bone #ECE7DD, ink #1C2620,
 * forest #1E5C45, vitality #34A07C — with the two-stroke brand mark
 * (paths verbatim from src/components/BrandMark.tsx, viewBox 643×495).
 *
 * Fonts: satori (next/og) cannot use system fonts, so "serif"/"sans-serif"
 * fallbacks are silently ignored (the pre-R2 default card asked for Georgia
 * and actually rendered Geist). The brand pair — Instrument Serif Regular for
 * display, Hanken Grotesk Regular for eyebrow/body — is vendored under
 * assets/ (both OFL-licensed, static instances; satori can't render variable
 * fonts) and read from disk. No network fetch at build or request time (the
 * site is privacy-strict; the common Google-hosted fetch inside ImageResponse
 * is out).
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BONE = "#ECE7DD";
const INK = "#1C2620";
const FOREST = "#1E5C45";
const VITALITY = "#34A07C";

/** Brand mark paths — verbatim from src/components/BrandMark.tsx. */
const MARK_PATHS = [
  "M239.5 40.5L135.5 238C169.985 215.919 206.5 210.5 245.5 210.5C284.5 210.5 307.5 220.5 330.5 244.5C353.5 268.5 466 494.5 466 494.5H643L403.5 40.5C382.222 16.3216 365.74 2.81888 323.5 0C280.811 0.0641026 264.041 11.5171 239.5 40.5Z",
  "M121.5 306C75 335 34.893 414.244 0 494.5C87.4362 492.587 130.672 479.973 194 430C215.163 416.437 232.783 396.308 294.5 274.5C200.79 267.004 168 277 121.5 306Z",
];

function Mark({ width }: { width: number }) {
  const height = Math.round((width * 495) / 643);
  return (
    <svg viewBox="0 0 643 495" width={width} height={height} fill="none">
      {MARK_PATHS.map((d) => (
        <path key={d.slice(0, 12)} fill={FOREST} d={d} />
      ))}
    </svg>
  );
}

/** Vendored fonts, read once per process (build-time for these static routes). */
let serif: Promise<Buffer> | null = null;
function instrumentSerif(): Promise<Buffer> {
  serif ??= readFile(
    join(process.cwd(), "assets", "InstrumentSerif-Regular.ttf")
  );
  return serif;
}

let sans: Promise<Buffer> | null = null;
function hankenGrotesk(): Promise<Buffer> {
  sans ??= readFile(join(process.cwd(), "assets", "HankenGrotesk-Regular.ttf"));
  return sans;
}

/** Longer titles step down so nothing clips inside the 1200×630 frame. */
function titleFontSize(title: string): number {
  if (title.length <= 16) return 132;
  if (title.length <= 40) return 86;
  if (title.length <= 62) return 72;
  return 60;
}

export interface OgCardProps {
  /** Mono-caps kicker line, e.g. "MEMBERSHIP & PRICING". */
  eyebrow: string;
  /** The page's real h1/title copy — contractual, never invented. */
  title: string;
  /** Optional supporting line under the title. */
  subtitle?: string;
  /**
   * Site-default/home variant: a large mark alone in the header (no small
   * wordmark) because the title itself is the "Arcaevo" wordmark.
   */
  brand?: boolean;
}

/** Render the shared 1200×630 brand card. */
export async function ogCard({
  eyebrow,
  title,
  subtitle,
  brand = false,
}: OgCardProps): Promise<ImageResponse> {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: BONE,
          padding: "64px 88px 88px",
        }}
      >
        {/* Header: brand mark (+ wordmark, unless the title IS the wordmark) */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Mark width={brand ? 92 : 58} />
          {brand ? null : (
            <div
              style={{
                fontSize: 44,
                fontFamily: "Instrument Serif",
                color: INK,
                letterSpacing: "-0.01em",
              }}
            >
              Arcaevo
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexGrow: 1 }} />

        {/* Eyebrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 30,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 9999,
              backgroundColor: VITALITY,
            }}
          />
          <div
            style={{
              fontSize: 22,
              fontFamily: "Hanken Grotesk",
              letterSpacing: "0.14em",
              color: FOREST,
            }}
          >
            {eyebrow}
          </div>
        </div>

        {/* Title — the page's real h1 copy */}
        <div
          style={{
            fontSize: titleFontSize(title),
            fontFamily: "Instrument Serif",
            color: INK,
            lineHeight: 1.06,
            letterSpacing: "-0.02em",
            maxWidth: 1010,
          }}
        >
          {title}
        </div>

        {subtitle ? (
          <div
            style={{
              fontSize: 29,
              fontFamily: "Hanken Grotesk",
              color: INK,
              opacity: 0.72,
              lineHeight: 1.45,
              maxWidth: 920,
              marginTop: 26,
            }}
          >
            {subtitle}
          </div>
        ) : null}

        {/* Forest baseline bar */}
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: "100%",
            height: 14,
            backgroundColor: FOREST,
          }}
        />
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Instrument Serif",
          data: await instrumentSerif(),
          style: "normal",
          weight: 400,
        },
        {
          name: "Hanken Grotesk",
          data: await hankenGrotesk(),
          style: "normal",
          weight: 400,
        },
      ],
    }
  );
}
