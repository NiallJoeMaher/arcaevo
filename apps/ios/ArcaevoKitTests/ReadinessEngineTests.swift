import XCTest

/// The flagship §1 readiness engine — the canonical 71→62 ferritin story, the
/// floor-55 guarantee, decision thresholds, band widening, cycle adjustment,
/// and the §6 degraded states. Pure deterministic maths.
final class ReadinessEngineTests: XCTestCase {

    private func compute(
        hrv: [DailyPoint],
        rhr: [DailyPoint],
        penalties: [BiomarkerPenalty] = [],
        vitals: VitalsSnapshot? = nil,
        felt: FeltCheckin? = nil,
        cyclePhase: CyclePhase? = nil
    ) -> ReadinessResult {
        ReadinessEngine.compute(
            hrv: hrv, rhr: rhr, vitals: vitals, penalties: penalties,
            felt: felt, cyclePhase: cyclePhase,
            calendar: Fixture.cal, now: Fixture.now
        )
    }

    // MARK: - The canonical story

    /// Blood layer OFF → the pure wearable-only number.
    func testBloodLayerOff_71_trainAsPlanned_exertion7() {
        let (hrv, rhr) = Fixture.core71Inputs()
        let r = compute(hrv: hrv, rhr: rhr, penalties: [])
        XCTAssertEqual(r.core, 71)
        XCTAssertEqual(r.ceiling, 100)
        XCTAssertEqual(r.final, 71)
        XCTAssertEqual(r.band, 3)
        XCTAssertEqual(r.decision, .trainAsPlanned)
        XCTAssertEqual(r.exertionCeiling, 7)
        XCTAssertEqual(r.state, .ok)
    }

    /// Blood layer ON, ferritin 29 (−12 ceiling): the design's 71 → 62 with the
    /// ±9 band, "Go easy today.", exertion 4/10.
    func testFerritin29_recalibrates_71_to_62_band9_goEasy_exertion4() {
        let (hrv, rhr) = Fixture.core71Inputs()
        let r = compute(hrv: hrv, rhr: rhr, penalties: [Fixture.ferritinPenalty()])
        XCTAssertEqual(r.core, 71, "wearable-only core unchanged by blood")
        XCTAssertEqual(r.ceiling, 88, "100 − 12 ferritin penalty")
        XCTAssertEqual(r.final, 62, "round(71·88/100) = 62")
        XCTAssertEqual(r.band, 9, "3 + round(12/2) = 9 — the ferritin-only ±9")
        XCTAssertEqual(r.decision, .goEasy)
        XCTAssertEqual(r.exertionCeiling, 4, "4/10 vs 7/10 wearable-only")
        XCTAssertEqual(r.decision.headline, "Go easy today.")
    }

    // MARK: - Floor 55

    /// Blood can NEVER drag readiness below 55, even under maximally stacked
    /// (non-band-widening) penalties. core 71 → floored final 55, still goEasy.
    func testFloor55_underMaxStackedPenalties() {
        let (hrv, rhr) = Fixture.core71Inputs()
        let penalties = [
            BiomarkerPenalty(marker: "ferritin", value: 20, unit: "µg/L", testDate: Fixture.now, penalty: 12, note: ""),
            BiomarkerPenalty(marker: "vitamin_d", value: 20, unit: "nmol/L", testDate: Fixture.now, penalty: 8, note: ""),
            BiomarkerPenalty(marker: "tsh", value: 6, unit: "mIU/L", testDate: Fixture.now, penalty: 10, note: ""),
            BiomarkerPenalty(marker: "free_t3", value: 2, unit: "pmol/L", testDate: Fixture.now, penalty: 10, note: ""),
            BiomarkerPenalty(marker: "testosterone", value: 5, unit: "nmol/L", testDate: Fixture.now, penalty: 8, note: ""),
        ]
        let r = compute(hrv: hrv, rhr: rhr, penalties: penalties)
        XCTAssertEqual(r.ceiling, 55, "100 − 48 = 52 → floored to 55")
        XCTAssertEqual(r.final, 55, "blood never reads alarmist — floor holds")
        XCTAssertEqual(r.decision, .goEasy)
    }

    /// The floor guards the BLOOD reduction only: a wearable core already below
    /// 55 stays itself (final = min(core, …)) — blood can't lift it either.
    func testWearableCoreBelow55_isNotFloored() {
        let (hrv, rhr) = Fixture.weightedInputs(-0.5) // core = 25
        let bare = compute(hrv: hrv, rhr: rhr, penalties: [])
        XCTAssertEqual(bare.core, 25)
        XCTAssertEqual(bare.final, 25)
        let withBlood = compute(hrv: hrv, rhr: rhr, penalties: [Fixture.ferritinPenalty()])
        XCTAssertEqual(withBlood.final, 25, "final = min(core, max(55, scaled)) = 25")
    }

    // MARK: - Decision thresholds

    func testDecisionThresholds() {
        func decision(_ w: Double) -> (Int, ReadinessDecision) {
            let (hrv, rhr) = Fixture.weightedInputs(w)
            let r = compute(hrv: hrv, rhr: rhr)
            return (r.final, r.decision)
        }
        // trainHard ≥ 85
        XCTAssertEqual(decision(0.72).1, .trainHard)   // core 86
        XCTAssertEqual(decision(0.70).1, .trainHard)   // core 85 (boundary)
        XCTAssertEqual(decision(0.68).1, .trainAsPlanned) // core 84
        // trainAsPlanned 68–84
        XCTAssertEqual(decision(0.36).1, .trainAsPlanned) // core 68 (boundary)
        XCTAssertEqual(decision(0.34).1, .goEasy)         // core 67
        // goEasy 55–67
        XCTAssertEqual(decision(0.10).1, .goEasy)         // core 55 (boundary)
        XCTAssertEqual(decision(0.08).1, .rest)           // core 54
        // rest < 55
        XCTAssertEqual(decision(0.00).1, .rest)           // core 50
    }

    func testExertionCeilingMapping() {
        XCTAssertEqual(ReadinessDecision.trainHard.exertionCeiling, 9)
        XCTAssertEqual(ReadinessDecision.trainAsPlanned.exertionCeiling, 7)
        XCTAssertEqual(ReadinessDecision.goEasy.exertionCeiling, 4)
        XCTAssertEqual(ReadinessDecision.rest.exertionCeiling, 1)
    }

    func testDecisionSoftenedStep() {
        XCTAssertEqual(ReadinessDecision.trainHard.softened, .trainAsPlanned)
        XCTAssertEqual(ReadinessDecision.trainAsPlanned.softened, .goEasy)
        XCTAssertEqual(ReadinessDecision.goEasy.softened, .rest)
        XCTAssertEqual(ReadinessDecision.rest.softened, .rest)
    }

    // MARK: - Band widening on elevated hs-CRP

    /// hs-CRP > 3 widens the band (+2) AND softens the decision one step.
    func testHsCrp_widensBand_and_softensDecision() {
        let (hrv, rhr) = Fixture.core71Inputs()
        let crp = BiomarkerPenalty(
            marker: "hs_crp", value: 4, unit: "mg/L", testDate: Fixture.now,
            penalty: 8, note: "Inflammation lowers recovery", widensBand: true
        )
        let r = compute(hrv: hrv, rhr: rhr, penalties: [crp])
        XCTAssertEqual(r.ceiling, 92)
        // band = 3 + round(8/2) + 2 (widen) = 9
        XCTAssertEqual(r.band, 9)
        // final = round(71·92/100) = 65 → goEasy, then softened by inflammation
        XCTAssertEqual(r.final, 65)
        XCTAssertEqual(r.decision, .goEasy.softened)
        XCTAssertEqual(r.decision, .rest)
    }

    // MARK: - Cycle-phase adjustment (luteal doesn't false-alarm)

    /// The SAME raw overnight (HRV dipped to 46.5, RHR steady 60): without cycle
    /// awareness the dip reads as "run down" (core 29 → rest); in the luteal
    /// phase the dip is EXPECTED, so the score holds up (core 56 → goEasy).
    func testLuteal_expectedDip_doesNotFalseAlarm() {
        var hrv = Fixture.series(mu: 50, sigma: 5, count: 30)
        var rhr = Fixture.series(mu: 60, sigma: 5, count: 30)
        hrv.append(DailyPoint(date: Fixture.now, value: 46.5))
        rhr.append(DailyPoint(date: Fixture.now, value: 60))

        let noCycle = compute(hrv: hrv, rhr: rhr)
        XCTAssertEqual(noCycle.final, 29)
        XCTAssertEqual(noCycle.decision, .rest)

        let luteal = compute(hrv: hrv, rhr: rhr, cyclePhase: .luteal)
        XCTAssertEqual(luteal.final, 56)
        XCTAssertEqual(luteal.decision, .goEasy)
        XCTAssertGreaterThan(luteal.final, noCycle.final, "luteal must not false-alarm")
        XCTAssertTrue(
            luteal.contributions.contains { $0.label.lowercased().contains("luteal") },
            "cycle-phase contribution is surfaced"
        )
    }

    // MARK: - §6 degraded states

    /// < 28 days of overnight HRV/RHR and NO bloods → calibrating(of: 28),
    /// score never presented as confident.
    func testCalibrating_under28Days_noBloods() {
        let hrv = Fixture.series(mu: 50, sigma: 5, count: 20)
        let rhr = Fixture.series(mu: 60, sigma: 5, count: 20)
        let r = compute(hrv: hrv, rhr: rhr, penalties: [])
        XCTAssertEqual(r.state.key, "calibrating")
        XCTAssertFalse(r.state.showsScore, "no number while calibrating")
        guard case let .calibrating(_, of) = r.state else { return XCTFail("expected calibrating") }
        XCTAssertEqual(of, 28)
    }

    /// Historical bloods shorten the statistical window to 14 days.
    func testCalibrating_withBloods_shortenedTo14() {
        let hrv = Fixture.series(mu: 50, sigma: 5, count: 10)
        let rhr = Fixture.series(mu: 60, sigma: 5, count: 10)
        let r = compute(hrv: hrv, rhr: rhr, penalties: [Fixture.ferritinPenalty()])
        guard case let .calibrating(_, of) = r.state else { return XCTFail("expected calibrating") }
        XCTAssertEqual(of, 14, "bloods on file → 14-day calibration")
        XCTAssertFalse(r.state.showsScore)
    }

    /// No overnight read in the last 36h → sparseNight (never interpolated).
    func testSparseNight_noOvernightRead() {
        // 30 balanced days, but the most recent is 2 days old (> 36h).
        let hrv = Fixture.series(mu: 50, sigma: 5, count: 30, startOffset: 2)
        let rhr = Fixture.series(mu: 60, sigma: 5, count: 30, startOffset: 2)
        let r = compute(hrv: hrv, rhr: rhr)
        XCTAssertEqual(r.state.key, "sparseNight")
        XCTAssertFalse(r.state.showsScore)
    }

    /// "Feeling ill" tag → sick mode: the plan drops to rest regardless of a
    /// high underlying score.
    func testSickMode_overridesHighScore() {
        let (hrv, rhr) = Fixture.core71Inputs()
        let felt = FeltCheckin(date: Fixture.now, feel: 3, tags: [FeltCheckin.sickTag])
        XCTAssertTrue(felt.sick)
        let r = compute(hrv: hrv, rhr: rhr, felt: felt)
        XCTAssertEqual(r.state, .sick)
        XCTAssertEqual(r.decision, .rest)
        XCTAssertEqual(r.exertionCeiling, 1)
        XCTAssertTrue(r.state.showsScore, "sick still shows the number")
    }

    // MARK: - §6 blood-layer honesty states

    func testBloodLayerState_noBloods() {
        XCTAssertEqual(BloodLayerState.from(readings: [], now: Fixture.now), .noBloods)
    }

    func testBloodLayerState_active_vs_stale() {
        let fresh = [Fixture.reading(code: "ferritin", value: 29, measuredAt: Fixture.weeksAgo(2))]
        XCTAssertEqual(
            BloodLayerState.from(readings: fresh, now: Fixture.now),
            .active(latestDraw: Fixture.weeksAgo(2))
        )
        let old = [Fixture.reading(code: "ferritin", value: 29, measuredAt: Fixture.weeksAgo(27))]
        XCTAssertEqual(
            BloodLayerState.from(readings: old, now: Fixture.now),
            .stale(latestDraw: Fixture.weeksAgo(27))
        )
    }

    /// Stale blood (> 26 weeks): penalties fully decay away, so readiness runs
    /// wearable-only again — the 62 relaxes back to 71.
    func testStaleBlood_penaltiesDecayed_readinessReturnsToCore() {
        let (hrv, rhr) = Fixture.core71Inputs()
        let stale = BiomarkerPenalty.derive(
            from: [Fixture.reading(code: "ferritin", value: 29, measuredAt: Fixture.weeksAgo(27))],
            now: Fixture.now
        )
        XCTAssertTrue(stale.isEmpty, "27-week-old ferritin fully decayed → dropped")
        let r = compute(hrv: hrv, rhr: rhr, penalties: stale)
        XCTAssertEqual(r.final, 71)
        XCTAssertEqual(r.ceiling, 100)
    }
}
