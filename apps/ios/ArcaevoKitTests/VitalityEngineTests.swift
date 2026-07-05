import XCTest

/// §3 Vitality Age + the RcvMath port. RCV parity with the web (inclusive
/// boundary, zero-prior guard, JS round parity), RCV-gating (noise doesn't move
/// the number), the ±2 band, and ferritin "+x yrs holding it back".
final class VitalityEngineTests: XCTestCase {

    private var ferritinRule: BiomarkerRuleLite {
        BiomarkerRuleLite.defaults.first { $0.code == "ferritin" }!
    }

    // MARK: - RcvMath web parity

    func testPercentChange_zeroPriorGuard() {
        XCTAssertEqual(RcvMath.percentChange(prior: 0, current: 5), 0, "zero prior → 0, never ∞")
        XCTAssertEqual(RcvMath.percentChange(prior: 100, current: 110), 10, accuracy: 1e-9)
    }

    /// The boundary is INCLUSIVE: |Δ%| == rcv is still "no real change".
    func testRcvVerdict_inclusiveBoundary() {
        XCTAssertEqual(
            RcvMath.computeRcvVerdict(prior: 100, current: 110, rcvPercent: 10, direction: .lowerIsBetter),
            .noRealChange, "|Δ%| = rcv is inclusive → no real change"
        )
        XCTAssertEqual(
            RcvMath.computeRcvVerdict(prior: 100, current: 111, rcvPercent: 10, direction: .lowerIsBetter),
            .worsened, "up beyond rcv, lower-is-better → worsened"
        )
        XCTAssertEqual(
            RcvMath.computeRcvVerdict(prior: 100, current: 89, rcvPercent: 10, direction: .lowerIsBetter),
            .improved, "down beyond rcv, lower-is-better → improved"
        )
    }

    func testRcvVerdict_higherIsBetter() {
        XCTAssertEqual(
            RcvMath.computeRcvVerdict(prior: 100, current: 111, rcvPercent: 10, direction: .higherIsBetter),
            .improved
        )
        XCTAssertEqual(
            RcvMath.computeRcvVerdict(prior: 100, current: 89, rcvPercent: 10, direction: .higherIsBetter),
            .worsened
        )
    }

    func testRcvVerdict_zeroPrior_neverRealChange() {
        XCTAssertEqual(
            RcvMath.computeRcvVerdict(prior: 0, current: 5, rcvPercent: 10, direction: .higherIsBetter),
            .noRealChange, "zero-prior guard → Δ 0% → no real change"
        )
    }

    /// JS `Math.round(n*100)/100` parity — an exact .5 tie rounds toward +∞,
    /// so the NEGATIVE half is the discriminating case (Swift's default
    /// round-half-away-from-zero would give −0.13; JS/round2 give −0.12).
    /// 0.125 is exactly representable, so 0.125·100 = 12.5 is a true tie.
    func testRound2_jsParity() {
        XCTAssertEqual(RcvMath.round2(0.125), 0.13, accuracy: 1e-9, "tie rounds up")
        XCTAssertEqual(RcvMath.round2(-0.125), -0.12, accuracy: 1e-9, "−12.5 → −12 like JS, not −13")
        XCTAssertEqual(RcvMath.round2(-0.005), 0.0, accuracy: 1e-9, "−0.5 → −0 like JS")
    }

    func testBaselineBand_positiveAndNegativeMean() {
        let pos = RcvMath.computeBaselineBand(series: [10, 12, 14], rcvPercent: 10)
        XCTAssertEqual(pos?.low ?? 0, 10.8, accuracy: 1e-9)
        XCTAssertEqual(pos?.high ?? 0, 13.2, accuracy: 1e-9)
        let neg = RcvMath.computeBaselineBand(series: [-10, -12, -14], rcvPercent: 10)
        XCTAssertEqual(neg?.low ?? 0, -13.2, accuracy: 1e-9)
        XCTAssertEqual(neg?.high ?? 0, -10.8, accuracy: 1e-9)
        XCTAssertNil(RcvMath.computeBaselineBand(series: [], rcvPercent: 10))
    }

    func testIsWithinBand_inclusive() {
        let band = BaselineBand(low: 10, high: 20)
        XCTAssertTrue(RcvMath.isWithinBand(value: 10, band: band))
        XCTAssertTrue(RcvMath.isWithinBand(value: 20, band: band))
        XCTAssertFalse(RcvMath.isWithinBand(value: 9.9, band: band))
    }

    // MARK: - Age offset — ferritin holds it back

    func testFerritinAgeOffset_positive() {
        let years = VitalityEngine.ageOffset(value: 29, rule: ferritinRule)
        XCTAssertEqual(years, 0.6044, accuracy: 0.001, "29 vs optimal 45 × 1.7 weight ≈ +0.6 yrs")
        XCTAssertGreaterThan(years, 0, "below optimal, higher-is-better → holds age back")
    }

    func testAgeOffset_insideOptimalRange_isZero() {
        XCTAssertEqual(VitalityEngine.ageOffset(value: 100, rule: ferritinRule), 0)
    }

    // MARK: - Compute: banded, RCV-gated, ferritin driver

    func testCompute_ferritinDriver_holdingBack_band2() {
        let readings = [Fixture.reading(code: "ferritin", value: 29, measuredAt: Fixture.weeksAgo(2), name: "Ferritin", unit: "µg/L")]
        let score = VitalityEngine.compute(
            readings: readings, rules: [ferritinRule],
            wearables: WearableTrends(), calendarAge: 35, month: Fixture.now
        )
        XCTAssertEqual(score.band, 2, "the ±2 band is always shown")
        let ferritin = score.drivers.first { $0.marker == "ferritin" }
        XCTAssertEqual(ferritin?.years, 0.6)
        XCTAssertTrue(ferritin?.holdingBack ?? false)
        XCTAssertEqual(ferritin?.note, "holding it back")
        XCTAssertTrue(ferritin?.label.contains("29") ?? false)
        XCTAssertFalse(score.rcvGated, "single reading → nothing gated")
    }

    /// A sub-threshold change does NOT move the number: the anchor stays at the
    /// last RCV-significant value, and `rcvGated` records the suppression.
    func testCompute_rcvGating_noiseDoesNotMove() {
        let gated = VitalityEngine.compute(
            readings: [
                Fixture.reading(code: "ferritin", value: 29, measuredAt: Fixture.weeksAgo(8), name: "Ferritin", unit: "µg/L"),
                Fixture.reading(code: "ferritin", value: 31, measuredAt: Fixture.weeksAgo(1), name: "Ferritin", unit: "µg/L"),
            ],
            rules: [ferritinRule], wearables: WearableTrends(), calendarAge: 35, month: Fixture.now
        )
        XCTAssertTrue(gated.rcvGated, "31 vs 29 is within RCV noise → suppressed")
        XCTAssertTrue(gated.drivers.first { $0.marker == "ferritin" }?.label.contains("29") ?? false,
                      "the number stays anchored at 29")

        let moved = VitalityEngine.compute(
            readings: [
                Fixture.reading(code: "ferritin", value: 29, measuredAt: Fixture.weeksAgo(8), name: "Ferritin", unit: "µg/L"),
                Fixture.reading(code: "ferritin", value: 40, measuredAt: Fixture.weeksAgo(1), name: "Ferritin", unit: "µg/L"),
            ],
            rules: [ferritinRule], wearables: WearableTrends(), calendarAge: 35, month: Fixture.now
        )
        XCTAssertFalse(moved.rcvGated, "40 vs 29 beats RCV → real move")
        XCTAssertEqual(moved.drivers.first { $0.marker == "ferritin" }?.years, 0.2, "anchor advanced to 40")
    }
}
