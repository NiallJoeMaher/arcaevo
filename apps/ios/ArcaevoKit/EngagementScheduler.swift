import Foundation

// MARK: - Re-engagement scheduler (ALGORITHM §4 — "only the ones worth a buzz")
//
// Pure, deterministic date logic for the daily check-in reminder and the
// escalating re-engagement series for inactive members — the founder's #1
// stickiness concern. Kept in ArcaevoKit (no UserNotifications, no UIKit) so
// the whole schedule is unit-tested here; the app layer only maps each kind to
// its verbatim `PushCopy` string and hands the fire dates to
// `UNUserNotificationCenter`.
//
// House rules (§4 / §5) this respects by construction:
//   • No streak guilt, ever — the escalation BACKS OFF (day 2 → 4 → 7 → stop),
//     it never nags daily or shames a lapse.
//   • Calm personal timing — everything fires at the member's learned/chosen
//     morning time, deferred out of quiet hours.
//   • These are NOT part of the fixed twelve-card push vocabulary (like the
//     first-reading nudge) — they carry no health value, ever.

/// The re-engagement identities scheduled outside the twelve-card vocabulary.
enum EngagementNudgeKind: String, CaseIterable, Sendable {
    /// Daily "come log how you feel / see your baseline" nudge at the personal
    /// time — cancelled + rescheduled to tomorrow the moment they check in.
    case dailyCheckIn
    /// Escalating re-engagement for a member who hasn't opened the app.
    case reengageDay2
    case reengageDay4
    case reengageDay7
}

/// A concrete engagement notification to schedule — kind + fire time.
struct EngagementNudgePlan: Hashable, Sendable {
    var kind: EngagementNudgeKind
    var fireDate: Date
}

/// Everything the pure planner needs. Deterministic — all date math flows
/// through `calendar`/`now`, so the schedule is fully unit-testable.
struct EngagementInputs {
    var now: Date
    var calendar: Calendar = .current

    /// The daily-check-in toggle. When off, the whole engagement layer is
    /// silent (no daily reminder, no escalation).
    var enabled: Bool = true

    /// The personal calm time (learned wake time or a user-picked time). Only
    /// hour/minute are read; defaults to a sensible morning hour.
    var reminderTime: DateComponents = DateComponents(hour: 8, minute: 0)

    /// Start-of-day of the member's last check-in — opened the app or viewed a
    /// score. Drives "already checked in today → remind tomorrow, not now".
    var lastCheckInDay: Date?

    /// Nightly quiet-hours window; morning times sit outside it, but we defer to
    /// the morning if a computed time ever lands inside it (belt-and-braces).
    var quietStartHour: Int = 22
    var quietEndHour: Int = 7

    init(now: Date, calendar: Calendar = .current) {
        self.now = now
        self.calendar = calendar
    }
}

enum EngagementScheduler {
    /// Escalation offsets (days from today) + the cap. Day 2 → 4 → 7, then
    /// silence: we never keep nudging an inactive member (calm, no guilt).
    static let escalationOffsets: [(kind: EngagementNudgeKind, days: Int)] = [
        (.reengageDay2, 2), (.reengageDay4, 4), (.reengageDay7, 7),
    ]

    /// Pure core: inputs → the engagement notifications to schedule. Every open
    /// cancels the previous set and calls this fresh, so the daily reminder
    /// slides forward and the escalation resets from the new "now".
    static func plan(_ input: EngagementInputs) -> [EngagementNudgePlan] {
        guard input.enabled else { return [] }
        var out: [EngagementNudgePlan] = []

        // Daily check-in reminder — the next personal-time slot, moved to
        // tomorrow if they've already checked in today.
        if let daily = dailyFireDate(input) {
            out.append(EngagementNudgePlan(kind: .dailyCheckIn, fireDate: daily))
        }

        // Escalating re-engagement — anchored to today at the same calm time.
        // Day +1 belongs to the daily reminder, so these start at day +2: at
        // most one nudge lands on any given day (no double-fire).
        let cal = input.calendar
        let today = cal.startOfDay(for: input.now)
        for step in escalationOffsets {
            guard let day = cal.date(byAdding: .day, value: step.days, to: today),
                  let raw = setTime(input.reminderTime, on: day, calendar: cal)
            else { continue }
            let fire = deferPastQuietHours(raw, input)
            if fire > input.now {
                out.append(EngagementNudgePlan(kind: step.kind, fireDate: fire))
            }
        }
        return out
    }

    /// The next daily-reminder fire time: today at the personal time if it's
    /// still ahead and they haven't checked in yet, otherwise tomorrow.
    static func dailyFireDate(_ input: EngagementInputs) -> Date? {
        let cal = input.calendar
        let today = cal.startOfDay(for: input.now)
        guard let todayAt = setTime(input.reminderTime, on: today, calendar: cal) else { return nil }

        let checkedInToday = input.lastCheckInDay
            .map { cal.isDate($0, inSameDayAs: input.now) } ?? false

        let base: Date
        if checkedInToday || todayAt <= input.now {
            base = cal.date(byAdding: .day, value: 1, to: todayAt) ?? todayAt
        } else {
            base = todayAt
        }
        let fire = deferPastQuietHours(base, input)
        return fire > input.now ? fire : nil
    }

    // MARK: Date helpers

    private static func setTime(_ time: DateComponents, on day: Date, calendar: Calendar) -> Date? {
        calendar.date(bySettingHour: time.hour ?? 8, minute: time.minute ?? 0, second: 0, of: day)
    }

    /// True when `date` falls inside the nightly quiet-hours window.
    static func inQuietHours(_ date: Date, _ input: EngagementInputs) -> Bool {
        let h = input.calendar.component(.hour, from: date)
        let start = input.quietStartHour, end = input.quietEndHour
        if start <= end { return h >= start && h < end }
        return h >= start || h < end   // wraps midnight (e.g. 22:00 → 07:00)
    }

    /// Push a time that lands in quiet hours out to the window's end (quiet-hour
    /// morning). Morning reminders normally pass through untouched.
    private static func deferPastQuietHours(_ date: Date, _ input: EngagementInputs) -> Date {
        guard inQuietHours(date, input) else { return date }
        let cal = input.calendar
        let h = cal.component(.hour, from: date)
        var day = date
        // Late-evening side of a midnight-wrapping window → the end is tomorrow.
        if input.quietStartHour > input.quietEndHour, h >= input.quietStartHour {
            day = cal.date(byAdding: .day, value: 1, to: date) ?? date
        }
        return cal.date(bySettingHour: input.quietEndHour, minute: 0, second: 0, of: day) ?? date
    }
}
