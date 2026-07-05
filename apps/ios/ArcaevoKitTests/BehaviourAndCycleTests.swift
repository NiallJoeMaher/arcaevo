import XCTest

/// §1.5 behaviour-impact model, §4 learned wake time, §3.1 cycle baselines.
final class BehaviourAndCycleTests: XCTestCase {

    // MARK: - Behaviour impacts (own history, n ≥ 3 gate)

    /// Reconstructs the design's own-history coefficients: next-day readiness
    /// delta −11 after Alcohol, −6 after Late meal, +4 after Evening walk, with
    /// untagged control days at 0. Scores are built cumulatively so EACH check-in
    /// day's next-day delta equals its target exactly.
    func testImpacts_minus11_minus6_plus4_withN3Gate() {
        // daysBack → next-day target delta.
        var target: [Int: Int] = [:]
        for o in [18, 14, 10] { target[o] = -11 } // Alcohol ×3
        for o in [16, 12, 8]  { target[o] = -6 }  // Late meal ×3
        for o in [15, 7, 3]   { target[o] = 4 }   // Evening walk ×3
        for o in [11, 9]      { target[o] = -5 }  // Stressed ×2 (must NOT surface)

        // Cumulative scores across offsets 21…0 (older → newer).
        var scoreByOffset: [Int: Int] = [21: 70]
        for o in stride(from: 21, through: 1, by: -1) {
            scoreByOffset[o - 1] = scoreByOffset[o]! + (target[o] ?? 0)
        }
        let scores = scoreByOffset.map { DatedScore(date: Fixture.daysAgo($0.key), score: $0.value) }

        func checkin(_ o: Int, _ tags: [String]) -> FeltCheckin {
            FeltCheckin(date: Fixture.daysAgo(o), feel: 3, tags: tags)
        }
        let checkins =
            [18, 14, 10].map { checkin($0, ["Alcohol"]) } +
            [16, 12, 8].map  { checkin($0, ["Late meal"]) } +
            [15, 7, 3].map   { checkin($0, ["Evening walk"]) } +
            [11, 9].map      { checkin($0, ["Stressed"]) } +
            [20, 19, 17, 13, 6, 5, 4, 2].map { checkin($0, []) } // untagged control

        let impacts = BehaviourImpactModel.compute(checkins: checkins, scores: scores, calendar: Fixture.cal)

        let byTag = Dictionary(uniqueKeysWithValues: impacts.map { ($0.tag, $0) })
        XCTAssertEqual(byTag["Alcohol"]?.delta, -11)
        XCTAssertEqual(byTag["Alcohol"]?.n, 3)
        XCTAssertEqual(byTag["Late meal"]?.delta, -6)
        XCTAssertEqual(byTag["Evening walk"]?.delta, 4)
        XCTAssertNil(byTag["Stressed"], "n = 2 (< 3) → not surfaced")
        // Sorted by |delta| descending.
        XCTAssertEqual(impacts.map(\.tag), ["Alcohol", "Late meal", "Evening walk"])
    }

    func testImpacts_belowGate_returnsNothing() {
        let scores = (0...5).map { DatedScore(date: Fixture.daysAgo($0), score: 70 - $0) }
        let checkins = [Fixture.daysAgo(3), Fixture.daysAgo(2)].map {
            FeltCheckin(date: $0, feel: 3, tags: ["Alcohol"])
        }
        let impacts = BehaviourImpactModel.compute(checkins: checkins, scores: scores, calendar: Fixture.cal)
        XCTAssertFalse(impacts.contains { $0.tag == "Alcohol" }, "only 2 tagged days → gated")
    }

    // MARK: - Learned wake time (§4)

    func testWakeTime_medianMinuteOfDay() {
        func at(_ h: Int, _ m: Int) -> Date {
            Fixture.cal.date(bySettingHour: h, minute: m, second: 0, of: Fixture.now)!
        }
        let learned = WakeTimeModel.learn(sleepEnds: [at(7, 0), at(7, 10), at(7, 5)], calendar: Fixture.cal)
        XCTAssertEqual(learned?.hour, 7)
        XCTAssertEqual(learned?.minute, 5, "median of 420/425/430 minutes = 425 = 07:05")
    }

    func testWakeTime_needsThreeSamples() {
        func at(_ h: Int, _ m: Int) -> Date { Fixture.cal.date(bySettingHour: h, minute: m, second: 0, of: Fixture.now)! }
        XCTAssertNil(WakeTimeModel.learn(sleepEnds: [at(7, 0), at(7, 10)], calendar: Fixture.cal),
                     "< 3 samples → never guess")
    }

    // MARK: - Cycle baselines (§3.1)

    func testCyclePhaseAdjustment_hrv() {
        let (m, s) = (60.0, 10.0)
        assertPhase(.follicular, m, s, expectMu: 60, expectSigma: 10)
        assertPhase(.menstrual, m, s, expectMu: 60 * 0.97, expectSigma: 10 * 1.10)
        assertPhase(.ovulatory, m, s, expectMu: 60 * 1.01, expectSigma: 10)
        assertPhase(.luteal, m, s, expectMu: 60 * 0.93, expectSigma: 10 * 1.20)
    }

    func testCyclePhaseAdjustment_rhrAndTemp() {
        let (rm, rs) = CycleBaselines.phaseAdjusted(mu: 60, sigma: 5, for: .luteal, metric: .restingHeartRate)
        XCTAssertEqual(rm, 60 * 1.03, accuracy: 1e-9)
        XCTAssertEqual(rs, 5 * 1.15, accuracy: 1e-9)
        let (tm, ts) = CycleBaselines.phaseAdjusted(mu: 36.5, sigma: 0.2, for: .luteal, metric: .wristTemp)
        XCTAssertEqual(tm, 36.5 + 0.25, accuracy: 1e-9, "luteal wrist temp rises")
        XCTAssertEqual(ts, 0.2 * 1.10, accuracy: 1e-9)
    }

    func testCyclePhaseFromDays() {
        XCTAssertEqual(CyclePhase.from(daysSinceCycleStart: -1), .follicular)
        XCTAssertEqual(CyclePhase.from(daysSinceCycleStart: 2), .menstrual)
        XCTAssertEqual(CyclePhase.from(daysSinceCycleStart: 8), .follicular)
        XCTAssertEqual(CyclePhase.from(daysSinceCycleStart: 14), .ovulatory)
        XCTAssertEqual(CyclePhase.from(daysSinceCycleStart: 20), .luteal)
    }

    private func assertPhase(_ phase: CyclePhase, _ mu: Double, _ sigma: Double, expectMu: Double, expectSigma: Double) {
        let (m, s) = CycleBaselines.phaseAdjusted(mu: mu, sigma: sigma, for: phase, metric: .hrv)
        XCTAssertEqual(m, expectMu, accuracy: 1e-9, "\(phase) μ")
        XCTAssertEqual(s, expectSigma, accuracy: 1e-9, "\(phase) σ")
    }
}
