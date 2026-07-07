import Foundation

// iOS-only: the photo upload flow lives in the phone app, and
// UIGraphicsImageRenderer is unavailable on watchOS (which also compiles
// ArcaevoKit). `os(iOS)` also covers Mac Catalyst; watchOS is excluded.
#if os(iOS)
import UIKit

/// Prepares captured photos / picked PDFs as `BloodworkMedia` for the real-OCR
/// upload path (`POST /uploads/bloodwork`).
///
/// The server caps a bloodwork upload's DECODED media at 3 MiB
/// (`MAX_BLOODWORK_MEDIA_DECODED_BYTES` in `apps/web/src/lib/models.ts`) — the
/// base64 body must decode to ≤ 3 MiB or Vercel 413s the whole request before
/// the handler runs. A full-res phone photo (5–10 MB JPEG) blows that, so we
/// downscale + JPEG-recompress client-side to fit UNDER the cap while keeping
/// printed lab digits legible.
///
/// Note the invariant: for a JPEG, `Data.count` (the encoded bytes) IS exactly
/// the number of bytes the server decodes from our base64 — so we size against
/// `Data.count` directly. base64 only affects the wire body, which the server
/// re-derives; its own cap is on the decoded length.
enum BloodworkMediaEncoder {
    /// The server's hard cap on decoded bytes (3 MiB). Kept in sync with
    /// `MAX_BLOODWORK_MEDIA_DECODED_BYTES` on the web side.
    static let maxDecodedBytes = 3 * 1024 * 1024 // 3 MiB

    /// Our client-side TARGET, ~2.7 MiB — comfortably below the hard cap so a
    /// little variance in the encoder never trips the server's refine().
    static let targetDecodedBytes = 2_700_000

    /// Long-edge pixel caps, tried largest-first. ~2000 px keeps printed
    /// four-digit lab values crisp; we only step down for very dense pages.
    private static let longEdgeSteps: [CGFloat] = [2000, 1600, 1200]

    /// JPEG qualities tried at each scale. 0.7 is visually near-lossless for
    /// printed text; we never drop below 0.4 in the main sweep to avoid the
    /// ringing that blurs digits.
    private static let qualitySteps: [CGFloat] = [0.7, 0.55, 0.4]

    /// Downscale + JPEG-compress a captured photo so the decoded size fits under
    /// the server cap. Returns `nil` only if the bytes aren't a decodable image
    /// or can't be brought under the cap (should not happen for a real photo).
    static func encodePhoto(_ imageData: Data) -> BloodworkMedia? {
        guard let image = UIImage(data: imageData) else { return nil }

        for longEdge in longEdgeSteps {
            let scaled = downscale(image, longEdge: longEdge)
            for quality in qualitySteps {
                guard let jpeg = scaled.jpegData(compressionQuality: quality) else { continue }
                if jpeg.count <= targetDecodedBytes {
                    return BloodworkMedia(mime: "image/jpeg", base64: jpeg.base64EncodedString())
                }
            }
        }

        // Last resort for a pathologically large/noisy image: smallest scale +
        // lowest quality, accepted only if it clears the HARD cap.
        let scaled = downscale(image, longEdge: 1000)
        if let jpeg = scaled.jpegData(compressionQuality: 0.35), jpeg.count <= maxDecodedBytes {
            return BloodworkMedia(mime: "image/jpeg", base64: jpeg.base64EncodedString())
        }
        return nil
    }

    /// Redraw `image` so its longest edge is at most `longEdge` PIXELS (scale
    /// pinned to 1 so points == pixels). Images already smaller are returned
    /// unchanged (never upscale — that only inflates bytes and softens text).
    private static func downscale(_ image: UIImage, longEdge: CGFloat) -> UIImage {
        let size = image.size
        let maxSide = max(size.width, size.height)
        guard maxSide > longEdge, maxSide > 0 else { return image }

        let ratio = longEdge / maxSide
        let newSize = CGSize(width: (size.width * ratio).rounded(),
                             height: (size.height * ratio).rounded())

        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1        // pixel dims == point dims — we control resolution
        format.opaque = true    // lab printouts are opaque; skips the alpha channel
        let renderer = UIGraphicsImageRenderer(size: newSize, format: format)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: newSize))
        }
    }
}
#endif
