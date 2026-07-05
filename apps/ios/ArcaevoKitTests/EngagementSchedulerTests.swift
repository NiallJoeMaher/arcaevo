import XCTest

/// §4 re-engagement scheduler — the daily check-in reminder + the escalating
/// inactive-member series ("only the ones worth a buzz — never streak guilt").
/// Pure date logic, driven with an explicit `now` + UTC calendar.
final class EngagementSchedulerTests: XCTestCase {

    private let cal = Fixture.cal
    private let now = Fixture.now   // 2024-07-03 12:00:00 UTC

    private func inputs(
        reminderHour: Int = 8,
        reminderMinute: Int = 0,
        checkedInToday: Bool = false,
        enabled: Bool = true
    ) -> EngagementInputs {
        var i = EngagementInputs(now: now, calendar: cal)
        i.enabled = enabled
        i.reminderTime = DateComponents(hour: reminderHour, minute: reminderMinute)
        i.lastCheckInDay = checkedInToday ? cal.startOfDay(for: now) : nil
        return i
    }

    private func fire(_ plans: [EngagementNudgePlan], _ kind: EngagementNudgeKind) -> Date? {
        plans.first { $0.kind == kind }?.fireDate
    }

    // MARK: Daily check-in reminder

    /// Checked in today → the daily reminder slides to tomorrow at the time.
    func testDaily_checkedInToday_firesTomorrow() {
        let plans = EngagementScheduler.plan(inputs(checkedInToday: true))
        let daily = try? XCTUnwrap(fire(plans, .dailyCheckIn))
        let comps = cal.dateComponents([.year, .month, .day, .hour, .minute], from: daily!)
        XCTAssertEqual(comps.day, 4)      // 2024-07-04
        XCTAssertEqual(comps.hour, 8)
        XCTAssertEqual(comps.minute, 0)
    }

    /// Not yet checked in and the time is still ahead today → fires today.
    func testDaily_notCheckedIn_timeAhead_firesToday() {
        let daily = fire(EngagementScheduler.plan(inputs(reminderHour: 14)), .dailyCheckIn)
        let comps = cal.dateComponents([.day, .hour], from: daily!)
        XCTAssertEqual(comps.day, 3)      // still 2024-07-03
        XCTAssertEqual(comps.hour, 14)
    }

    /// Not checked in but the time has passed today → tomorrow.
    func testDaily_notCheckedIn_timePassed_firesTomorrow() {
        let daily = fire(EngagementScheduler.plan(inputs(reminderHour: 8)), .dailyCheckIn)
        XCTAssertEqual(cal.component(.day, from: daily!), 4)
    }

    // MARK: Escalation

    /// The escalating series lands on day +2 / +4 / +7 at the personal time.
    func testEscalation_day2_4_7_atReminderTime() {
        let plans = EngagementScheduler.plan(inputs(checkedInToday: true))
        XCTAssertEqual(cal.component(.day, from: fire(plans, .reengageDay2)!), 5)   // +2
        XCTAssertEqual(cal.component(.day, from: fire(plans, .reengageDay4)!), 7)   // +4
        XCTAssertEqual(cal.component(.day, from: fire(plans, .reengageDay7)!), 10)  // +7
        for kind in [EngagementNudgeKind.reengageDay2, .reengageDay4, .reengageDay7] {
            XCTAssertEqual(cal.component(.hour, from: fire(plans, kind)!), 8)
        }
    }

    /// Never nag forever: nothing is scheduled beyond day +7.
    func testEscalation_cappedAtDay7() {
        let plans = EngagementScheduler.plan(inputs(checkedInToday: true))
        let horizon = cal.date(byAdding: .day, value: 7, to: cal.startOfDay(for: now))!
        for p in plans {
            XCTAssertLessThanOrEqual(p.fireDate, cal.date(byAdding: .hour, value: 12, to: horizon)!)
        }
    }

    // MARK: Coherence

    /// At most one nudge lands on any calendar day — no double-fire.
    func testNoTwoNudgesOnSameDay() {
        let plans = EngagementScheduler.plan(inputs(checkedInToday: true))
        let days = plans.map { cal.startOfDay(for: $0.fireDate) }
        XCTAssertEqual(Set(days).count, days.count, "two nudges collided on one day")
    }

    /// Toggle off → the whole engagement layer is silent.
    func testDisabled_schedulesNothing() {
        XCTAssertTrue(EngagementScheduler.plan(inputs(enabled: false)).isEmpty)
    }

    // MARK: Quiet hours

    /// A time inside the nightly quiet window is deferred to the morning.
    func testQuietHours_eveningTimeDeferredToMorning() {
        let daily = fire(EngagementScheduler.plan(inputs(reminderHour: 23, checkedInToday: true)), .dailyCheckIn)
        XCTAssertEqual(cal.component(.hour, from: daily!), 7, "23:00 → deferred to quiet-hours end 07:00")
    }
}
