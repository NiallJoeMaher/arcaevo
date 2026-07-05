import XCTest

/// §1.3 rules table + decay curve. Blood shifts a bounded, decaying ceiling
/// penalty; hs-CRP additionally widens the band; fully-decayed penalties drop.
final class BiomarkerPenaltyTests: XCTestCase {

    private func penalty(code: String, value: Double, weeksOld: Double = 0) -> BiomarkerPenalty? {
        let r = Fixture.reading(code: code, value: value, measuredAt: Fixture.weeksAgo(weeksOld))
        return BiomarkerPenalty.derive(from: [r], now: Fixture.now).first
    }

    // MARK: - §1.3 rules table (fresh draws → full penalty)

    func testFerritinThresholds() {
        XCTAssertEqual(penalty(code: "ferritin", value: 29)?.penalty, 12) // < 45
        XCTAssertEqual(penalty(code: "ferritin", value: 60)?.penalty, 6)  // < 70
        XCTAssertNil(penalty(code: "ferritin", value: 100))               // ≥ 70
    }

    func testVitaminDThresholds() {
        XCTAssertEqual(penalty(code: "vitamin_d", value: 20)?.penalty, 8) // < 30
        XCTAssertEqual(penalty(code: "vitamin_d", value: 40)?.penalty, 4) // < 50
        XCTAssertNil(penalty(code: "vitamin_d", value: 80))               // ≥ 50
    }

    func testThyroidThresholds() {
        XCTAssertEqual(penalty(code: "tsh", value: 5.0)?.penalty, 10)     // > 4.0
        XCTAssertEqual(penalty(code: "tsh", value: 0.2)?.penalty, 10)     // < 0.4
        XCTAssertNil(penalty(code: "tsh", value: 2.0))                    // in range
        XCTAssertEqual(penalty(code: "free_t3", value: 2.5)?.penalty, 10) // < 3.1
        XCTAssertNil(penalty(code: "free_t3", value: 5.0))                // in range
    }

    func testHsCrpThresholds_widenBand() {
        let high = penalty(code: "hs_crp", value: 4)
        XCTAssertEqual(high?.penalty, 8)       // > 3
        XCTAssertTrue(high?.widensBand ?? false)
        let mild = penalty(code: "hs_crp", value: 2)
        XCTAssertEqual(mild?.penalty, 4)       // > 1.5
        XCTAssertTrue(mild?.widensBand ?? false)
        XCTAssertNil(penalty(code: "hs_crp", value: 0.7)) // ≤ 1.5
    }

    func testTestosteroneThreshold() {
        XCTAssertEqual(penalty(code: "testosterone", value: 8)?.penalty, 8) // < 10
        XCTAssertNil(penalty(code: "testosterone", value: 15))
    }

    func testNoteAlwaysCarriesValueAndDate() {
        let p = penalty(code: "ferritin", value: 29)
        XCTAssertNotNil(p)
        XCTAssertTrue(p!.note.contains("29"), "note surfaces the value")
        XCTAssertTrue(p!.note.contains("tested"), "note surfaces the test date")
    }

    // MARK: - Decay curve (§1.3): full ≤ 6w → linear → 0 by 26w

    func testDecayFactorCurve() {
        let f = { (w: Double) in BiomarkerPenalty.decayFactor(testDate: Fixture.weeksAgo(w), now: Fixture.now) }
        XCTAssertEqual(f(0), 1.0, accuracy: 1e-9, "fresh → full weight")
        XCTAssertEqual(f(6), 1.0, accuracy: 1e-9, "6 weeks still full")
        XCTAssertEqual(f(16), 0.5, accuracy: 1e-9, "~half at 16 weeks")
        XCTAssertEqual(f(26), 0.0, accuracy: 1e-9, "zero by 26 weeks")
        XCTAssertEqual(f(30), 0.0, accuracy: 1e-9, "stays zero beyond")
    }

    /// The decay applied through `derive`: ferritin base 12 → 12 fresh, 6 at
    /// ~16 weeks, dropped entirely by 26+ weeks.
    func testDerive_appliesDecay() {
        XCTAssertEqual(penalty(code: "ferritin", value: 29, weeksOld: 0)?.penalty, 12)
        XCTAssertEqual(penalty(code: "ferritin", value: 29, weeksOld: 16)?.penalty, 6)
        XCTAssertNil(penalty(code: "ferritin", value: 29, weeksOld: 27), "fully decayed → dropped")
    }

    // MARK: - derive semantics

    /// Latest reading per marker wins; results sorted by descending penalty.
    func testDerive_latestPerMarker_sortedByMagnitude() {
        let readings = [
            Fixture.reading(code: "ferritin", value: 60, measuredAt: Fixture.weeksAgo(10)), // older
            Fixture.reading(code: "ferritin", value: 29, measuredAt: Fixture.weeksAgo(1)),  // latest → 12
            Fixture.reading(code: "vitamin_d", value: 40, measuredAt: Fixture.weeksAgo(1)), // → 4
        ]
        let derived = BiomarkerPenalty.derive(from: readings, now: Fixture.now)
        XCTAssertEqual(derived.count, 2)
        XCTAssertEqual(derived.first?.marker, "ferritin")
        XCTAssertEqual(derived.first?.penalty, 12, "latest ferritin (29), not the older 60")
        XCTAssertEqual(derived.last?.marker, "vitamin_d")
        XCTAssertEqual(derived.last?.penalty, 4)
    }
}
