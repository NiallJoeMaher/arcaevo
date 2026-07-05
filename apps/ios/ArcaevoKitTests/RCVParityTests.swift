import XCTest

/// RCV parity guard (iOS side).
///
/// The per-biomarker Reference Change Value (the % a marker must move before a
/// change is "real" vs noise) is owned by the WEB side — the single source of
/// truth is `apps/web/src/lib/biomarker-rules.ts`, served by
/// `GET /api/v1/biomarker-rules`. iOS mirrors those numbers in
/// `BiomarkerRuleLite.defaults` as the offline fallback. These tests fail the
/// build if the hardcoded fallback ever drifts from the canonical web literals,
/// or if the server-merge logic stops preferring the fetched value.
///
/// The literals below MUST equal the web parity test
/// (`apps/web/src/lib/__tests__/biomarker-rules.test.ts`) and
/// docs/RCV_THRESHOLDS.md. Any change is a deliberate clinical decision made in
/// all three places at once.
final class RCVParityTests: XCTestCase {

    /// Canonical RCV % for the markers iOS hardcodes — copied as literals from
    /// the web seed / `docs/RCV_THRESHOLDS.md`. WEB IS CANONICAL.
    private let canonicalRcvPercent: [String: Double] = [
        "apob": 10,
        "hba1c": 6,
        "hs_crp": 85,
        "vitamin_d": 25,
        "ferritin": 30,
    ]

    /// The hardcoded fallback must equal the canonical web thresholds exactly.
    func testDefaults_matchCanonicalWebRcvPercent() {
        for (code, expected) in canonicalRcvPercent {
            guard let rule = BiomarkerRuleLite.defaults.first(where: { $0.code == code }) else {
                return XCTFail("BiomarkerRuleLite.defaults is missing marker \(code)")
            }
            XCTAssertEqual(
                rule.rcvPercent, expected, accuracy: 1e-9,
                "\(code) RCV drifted from the canonical web value \(expected)% — reconcile with apps/web/src/lib/biomarker-rules.ts"
            )
        }
    }

    /// Every default marker's threshold is a positive finite number.
    func testDefaults_rcvPercentPositiveAndFinite() {
        for rule in BiomarkerRuleLite.defaults {
            XCTAssertTrue(rule.rcvPercent.isFinite && rule.rcvPercent > 0, "\(rule.code) RCV must be > 0")
        }
    }

    /// The server merge overrides the RCV threshold by code and preserves the
    /// iOS-only age-offset weights (optimalLow/High, yearsWeight).
    func testMerging_prefersServerRcvAndKeepsWeights() {
        // Pretend the server shipped a NEW ferritin threshold.
        let merged = BiomarkerRuleLite.merging(serverRcvPercent: ["ferritin": 33])
        let ferritin = merged.first { $0.code == "ferritin" }!
        let original = BiomarkerRuleLite.defaults.first { $0.code == "ferritin" }!
        XCTAssertEqual(ferritin.rcvPercent, 33, "server RCV % must win when present")
        XCTAssertEqual(ferritin.optimalLow, original.optimalLow, "age-offset weights are iOS-only and preserved")
        XCTAssertEqual(ferritin.optimalHigh, original.optimalHigh)
        XCTAssertEqual(ferritin.yearsWeight, original.yearsWeight)
    }

    /// FAIL-SAFE: a code the server didn't return keeps its hardcoded value; an
    /// empty payload leaves every threshold at the canonical default.
    func testMerging_missingCodeFallsBackToDefault() {
        let merged = BiomarkerRuleLite.merging(serverRcvPercent: [:])
        for rule in merged {
            let original = BiomarkerRuleLite.defaults.first { $0.code == rule.code }!
            XCTAssertEqual(rule.rcvPercent, original.rcvPercent, "\(rule.code) must keep its default when unmapped")
        }
    }

    /// The endpoint decode maps `code → rcvPercent` (lowercased) for merging.
    func testResponseDecode_buildsRcvMap() throws {
        let json = """
        { "rules": [
            { "code": "apob", "rcvPercent": 10, "unit": "g/L", "direction": "lower_is_better" },
            { "code": "Ferritin", "rcvPercent": 30, "unit": "µg/L", "direction": "higher_is_better" }
        ] }
        """.data(using: .utf8)!
        let response = try JSONDecoder().decode(BiomarkerRulesResponse.self, from: json)
        XCTAssertEqual(response.rcvPercentByCode["apob"], 10)
        XCTAssertEqual(response.rcvPercentByCode["ferritin"], 30, "codes lowercased for a stable match")
    }
}
