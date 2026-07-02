import { ImageResponse } from "next/og";

export const alt = "Arcaevo — The interpretation layer for your health";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

/**
 * Default site-wide OG card. Brand tokens from the design handoff:
 * bone #ECE7DD, ink #1C2620, forest #1E5C45, vitality #34A07C.
 * System/default fonts only (no remote font fetches).
 */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          backgroundColor: "#ECE7DD",
          padding: "80px 96px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 44,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 9999,
              backgroundColor: "#34A07C",
            }}
          />
          <div
            style={{
              fontSize: 24,
              letterSpacing: "0.14em",
              color: "#1E5C45",
            }}
          >
            THE INTERPRETATION LAYER · DUBLIN
          </div>
        </div>
        <div
          style={{
            fontSize: 148,
            fontFamily: "Georgia, 'Times New Roman', serif",
            color: "#1C2620",
            lineHeight: 1,
            letterSpacing: "-0.02em",
            marginBottom: 40,
          }}
        >
          Arcaevo
        </div>
        <div
          style={{
            fontSize: 34,
            color: "#1C2620",
            opacity: 0.72,
            lineHeight: 1.4,
            maxWidth: 900,
          }}
        >
          The interpretation layer for your health. Bloods fused with
          wearables, read off your own baseline.
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: "100%",
            height: 14,
            backgroundColor: "#1E5C45",
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
