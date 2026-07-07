import XCTest
#if canImport(UIKit)
import UIKit
#endif

/// Task 7 — sending real photo/PDF bytes for bloodwork OCR.
///
/// Covers (1) the client-side compression that MUST bring a full-res phone
/// photo under the server's 3 MiB decoded cap while staying a decodable JPEG,
/// and (2) the additive/nullable response fields the confirm flow now tolerates
/// (documentDate null on the real-OCR path, unreadableCount, manualEntryRequired).
final class BloodworkUploadTests: XCTestCase {

    // MARK: - Response decoding (must match apps/web route.ts wire shape)

    private func decode(_ json: String) throws -> BloodworkExtraction {
        try APIClient.decoder.decode(BloodworkExtraction.self, from: Data(json.utf8))
    }

    func testRealOcrPathDecodesWithNullDocumentDate() throws {
        // The real-OCR 201: documentDate is null (member sets it at confirm),
        // plus the additive unreadableCount. A non-optional decode would throw.
        let json = #"""
        {
          "uploadId": "upload_abc",
          "sourceName": "results.pdf",
          "documentDate": null,
          "markersFound": 2,
          "values": [
            { "code": "apob", "name": "ApoB", "unit": "g/L", "value": 1.2, "confidence": 0.97, "alternatives": null, "lowConfidence": false },
            { "code": "hs_crp", "name": "hs-CRP", "unit": "mg/L", "value": 1.1, "confidence": 0.9, "alternatives": null, "lowConfidence": false }
          ],
          "flagged": [],
          "unreadableCount": 3
        }
        """#
        let ext = try decode(json)
        XCTAssertNil(ext.documentDate)
        XCTAssertEqual(ext.unreadableCount, 3)
        XCTAssertFalse(ext.isManualEntryRequired)
        XCTAssertEqual(ext.values.count, 2)
    }

    func testManualEntryRequiredResponseDecodesAndFlags() throws {
        // The honest manual-entry 200: no uploadId, empty values → the app must
        // route to type-by-hand rather than an empty confirm screen.
        let json = #"""
        {
          "manualEntryRequired": true,
          "markersFound": 0,
          "values": [],
          "flagged": [],
          "message": "We couldn't reliably read this document.",
          "unreadableCount": 5
        }
        """#
        let ext = try decode(json)
        XCTAssertTrue(ext.isManualEntryRequired)
        XCTAssertNil(ext.uploadId)
        XCTAssertEqual(ext.unreadableCount, 5)
    }

    func testMockPathWithDocumentDateStillDecodes() throws {
        // Dev/e2e mock path is unchanged: documentDate present, no unreadableCount.
        let json = #"""
        {
          "uploadId": "upload_1",
          "sourceName": "GP results",
          "documentDate": "2025-02-14",
          "markersFound": 1,
          "values": [
            { "code": "ferritin", "name": "Ferritin", "unit": "µg/L", "value": 41, "confidence": 0.52, "alternatives": [41, 47], "lowConfidence": true }
          ],
          "flagged": [
            { "code": "ferritin", "question": "Low confidence — was this 41 or 47?", "alternatives": [41, 47] }
          ]
        }
        """#
        let ext = try decode(json)
        XCTAssertEqual(ext.documentDate, "2025-02-14")
        XCTAssertNil(ext.unreadableCount)
        XCTAssertFalse(ext.isManualEntryRequired)
    }

    // MARK: - Draw date → takenAt (member's choice, not upload day)

    private func gregorian(_ tz: String = "Europe/Dublin") -> Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: tz)!
        return cal
    }

    private func day(_ y: Int, _ m: Int, _ d: Int, _ cal: Calendar) -> Date {
        DateComponents(calendar: cal, timeZone: cal.timeZone, year: y, month: m, day: d).date!
    }

    func testTakenAtUsesSelectedDateNotToday() {
        let cal = gregorian()
        // A report drawn months ago must stamp its OWN date, not the upload day.
        let selected = day(2025, 2, 14, cal)
        let now = day(2026, 7, 7, cal)
        XCTAssertEqual(
            BloodworkDrawDate.takenAt(from: selected, now: now, calendar: cal),
            "2025-02-14"
        )
    }

    func testTakenAtClampsFutureDrawToToday() {
        let cal = gregorian()
        let future = day(2030, 1, 1, cal)
        let now = day(2026, 7, 7, cal)
        // A draw can't be in the future — clamp (belt-and-braces with the picker).
        XCTAssertEqual(
            BloodworkDrawDate.takenAt(from: future, now: now, calendar: cal),
            "2026-07-07"
        )
    }

    func testTakenAtFormatMatchesServerContract() {
        let cal = gregorian()
        let d = day(2026, 12, 3, cal)
        // Zero-padded YYYY-MM-DD, exactly what the confirm route expects.
        XCTAssertEqual(BloodworkDrawDate.takenAt(from: d, now: d, calendar: cal), "2026-12-03")
    }

    // MARK: - Photo compression (fit the server cap; stay a decodable JPEG)

    #if canImport(UIKit)
    /// A big, textured synthetic "photo" — full-res phone dimensions with noise
    /// so it doesn't trivially compress to nothing (mirrors a real camera JPEG).
    private func syntheticPhoto(width: Int, height: Int) -> Data {
        let size = CGSize(width: width, height: height)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let image = UIGraphicsImageRenderer(size: size, format: format).image { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(origin: .zero, size: size))
            // Fine high-frequency detail so the encoder can't cheat the size test.
            for y in stride(from: 0, to: height, by: 3) {
                for x in stride(from: 0, to: width, by: 3) {
                    let gray = CGFloat((x * 7 + y * 13) % 255) / 255.0
                    UIColor(white: gray, alpha: 1).setFill()
                    ctx.fill(CGRect(x: x, y: y, width: 2, height: 2))
                }
            }
        }
        // High-quality JPEG to emulate a straight-from-camera capture.
        return image.jpegData(compressionQuality: 1.0)!
    }

    func testEncodePhotoFitsUnderServerCap() throws {
        let big = syntheticPhoto(width: 4032, height: 3024) // 12 MP phone photo
        let media = try XCTUnwrap(BloodworkMediaEncoder.encodePhoto(big))

        XCTAssertEqual(media.mime, "image/jpeg")

        // The base64 must be well-formed and decode to ≤ the server's cap.
        let decoded = try XCTUnwrap(Data(base64Encoded: media.base64))
        XCTAssertLessThanOrEqual(decoded.count, BloodworkMediaEncoder.maxDecodedBytes)
        // And it must still be a real, decodable image (digits legible ⇒ not empty).
        XCTAssertNotNil(UIImage(data: decoded))
    }

    func testEncodePhotoDownscalesLongEdge() throws {
        let big = syntheticPhoto(width: 4032, height: 3024)
        let media = try XCTUnwrap(BloodworkMediaEncoder.encodePhoto(big))
        let decoded = try XCTUnwrap(Data(base64Encoded: media.base64))
        let out = try XCTUnwrap(UIImage(data: decoded))
        // Long edge capped for legibility/size (≤ 2000 px per the encoder).
        XCTAssertLessThanOrEqual(max(out.size.width, out.size.height), 2000)
    }

    func testEncodePhotoRejectsNonImageBytes() {
        XCTAssertNil(BloodworkMediaEncoder.encodePhoto(Data("not an image".utf8)))
    }
    #endif
}
