import XCTest

/// §2 Energy — the all-day gauge. Morning start scaled by sleep, a blood-
/// modulated ceiling (same §1.3 mechanism), and the forecast afternoon dip.
final class EnergyEngineTests: XCTestCase {

    private func energyDay(
        sleep: SleepNight?,
        wakeHour: Int = 7,
        workouts: [WorkoutSummary] = [],
        learnedDipHour: Int? = nil,
        penalties: [BiomarkerPenalty] = []
    ) -> EnergyDay {
        EnergyEngine.day(
            samples: EnergyInputs(
                sleepLastNight: sleep, wakeHour: wakeHour,
                workoutsToday: workouts, learnedDipHour: learnedDipHour
            ),
            penalties: penalties, now: Fixture.now, calendar: Fixture.cal
        )
    }

    /// The design story: 6.2h short night × ceiling 88 (ferritin −12) → start 68.
    func testMorningStart68_ceiling88() {
        let night = SleepNight(date: Fixture.now, hours: 6.2, deep: 1.1, rem: 1.7, core: 3.4, awakenings: 2)
        let d = energyDay(sleep: night, learnedDipHour: 15, penalties: [Fixture.ferritinPenalty()])
        XCTAssertEqual(d.ceiling, 88, "100 − 12 ferritin penalty")
        XCTAssertEqual(d.start, 68, "round(88 · 6.2/8 · quality) = 68")
        XCTAssertEqual(d.points.first?.value, d.start, "curve opens at the morning start")
    }

    /// Blood modulates the energy ceiling by the same mechanism, same floor 55.
    func testCeilingFloor55() {
        let night = SleepNight(date: Fixture.now, hours: 8, deep: 1.6, rem: 2.0, core: 4.0, awakenings: 1)
        let huge = [
            BiomarkerPenalty(marker: "ferritin", value: 20, unit: "µg/L", testDate: Fixture.now, penalty: 12, note: ""),
            BiomarkerPenalty(marker: "tsh", value: 6, unit: "mIU/L", testDate: Fixture.now, penalty: 10, note: ""),
            BiomarkerPenalty(marker: "vitamin_d", value: 20, unit: "nmol/L", testDate: Fixture.now, penalty: 8, note: ""),
            BiomarkerPenalty(marker: "hs_crp", value: 4, unit: "mg/L", testDate: Fixture.now, penalty: 8, note: "", widensBand: true),
            BiomarkerPenalty(marker: "testosterone", value: 5, unit: "nmol/L", testDate: Fixture.now, penalty: 8, note: ""),
        ]
        XCTAssertEqual(energyDay(sleep: night, penalties: huge).ceiling, 55)
    }

    /// Forecast afternoon dip: learned hour wins; else wake + 8h (07:00 → 15:00).
    func testForecastDip15h() {
        let night = SleepNight(date: Fixture.now, hours: 7, deep: 1.2, rem: 1.6, core: 3.9, awakenings: 1)
        XCTAssertEqual(energyDay(sleep: night, wakeHour: 7, learnedDipHour: 15).forecastDipHour, 15)
        XCTAssertEqual(energyDay(sleep: night, wakeHour: 7, learnedDipHour: nil).forecastDipHour, 15,
                       "no learned dip → wake + 8h = 15:00")
    }

    /// No sleep read AND no learned dip → conservative start, no dip forecast.
    func testNoSleepRead_conservativeStart_noDipForecast() {
        let d = energyDay(sleep: nil, penalties: [])
        XCTAssertNil(d.forecastDipHour, "no dip forecast without a basis")
        XCTAssertEqual(d.start, 70, "no sleep read → 70% of ceiling 100")
    }

    /// The curve dips at the forecast dip hour vs the hour before it.
    func testCurveDipsAtForecastHour() {
        let night = SleepNight(date: Fixture.now, hours: 7, deep: 1.2, rem: 1.6, core: 3.9, awakenings: 1)
        let d = energyDay(sleep: night, wakeHour: 7, learnedDipHour: 15)
        func value(atHour h: Int) -> Int? {
            let t = Fixture.cal.date(byAdding: .hour, value: h, to: Fixture.cal.startOfDay(for: Fixture.now))!
            return d.points.first { Fixture.cal.component(.hour, from: $0.t) == h && $0.t == t }?.value
        }
        guard let atDip = value(atHour: 15), let before = value(atHour: 13) else {
            return XCTFail("expected 13:00 and 15:00 samples")
        }
        XCTAssertLessThan(atDip, before, "energy is lower into the circadian dip")
    }
}
