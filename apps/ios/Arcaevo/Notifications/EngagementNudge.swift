import Foundation
#if canImport(UserNotifications)
import UserNotifications
#endif

// MARK: - Re-engagement scheduling (local, on-device)
//
// The app-layer bridge for the daily check-in reminder + the escalating
// re-engagement series (the founder's #1 stickiness lever). The pure schedule
// lives in `EngagementScheduler` (ArcaevoKit, unit-tested); this file only:
//   1. resolves the personal reminder time (a user-picked time, else the
//      learned wake time, else a sensible morning default),
//   2. maps each `EngagementNudgeKind` to its verbatim `PushCopy.Engagement`
//      string (never a health value), and
//   3. hands the fire dates to `UNUserNotificationCenter` as one-shot local
//      `UNCalendarNotificationTrigger`s.
//
// LOCAL ONLY — no APNs. A local daily reminder fires regardless of app state
// and needs no server, so "you haven't checked in" works offline. We reschedule
// on every launch + foreground: cancel our previous set, replan from the new
// "now", so the daily reminder slides to tomorrow when they check in and the
// escalation resets the moment they open the app. (Server-known events like
// results-ready are a separate, heavier APNs job — see docs/BUILD_STATE.md.)
//
// NOT part of the twelve-card daily vocabulary — see `PushCopy.Engagement`.

enum EngagementNudge {
    /// Namespaced like the planner's identifiers but distinct from the twelve
    /// `PushKey` identities AND the first-reading nudge, so cancelling any one
    /// layer never disturbs the others.
    static func identifier(for kind: EngagementNudgeKind) -> String {
        NotificationPlanner.identifierPrefix + "engage." + kind.rawValue
    }

    static var allIdentifiers: [String] {
        EngagementNudgeKind.allCases.map(identifier(for:))
    }

    #if canImport(UserNotifications)
    /// Recompute + (re)schedule the engagement nudges. Cancels our previous set
    /// first (never touches the twelve-card or first-reading identifiers), then
    /// schedules the fresh plan. No-op when the toggle is off or the member
    /// hasn't granted notification authorization.
    @MainActor
    static func refresh(
        appState: AppState,
        prefs: NotificationPrefsStore = .shared,
        model: AppModel? = nil,
        now: Date = Date(),
        calendar: Calendar = .current,
        quietHours: QuietHours = .default,
        center: UNUserNotificationCenter = .current()
    ) {
        guard prefs.dailyCheckIn else { cancelAll(center: center); return }

        var input = EngagementInputs(now: now, calendar: calendar)
        input.enabled = true
        input.reminderTime = reminderTime(prefs: prefs, model: model)
        input.lastCheckInDay = appState.lastCheckInDay
        input.quietStartHour = quietHours.startHour
        input.quietEndHour = quietHours.endHour

        let planned = EngagementScheduler.plan(input)

        center.getNotificationSettings { settings in
            guard settings.authorizationStatus == .authorized
                    || settings.authorizationStatus == .provisional else { return }
            center.removePendingNotificationRequests(withIdentifiers: allIdentifiers)
            for item in planned {
                let copy = PushCopy.Engagement.card(item.kind)
                let content = UNMutableNotificationContent()
                content.title = copy.title
                content.body = copy.body
                content.sound = nil   // calm — surfaces without a buzz, no guilt
                if #available(iOS 15.0, *) { content.interruptionLevel = .active }
                let comps = calendar.dateComponents(
                    [.year, .month, .day, .hour, .minute], from: item.fireDate
                )
                let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
                center.add(UNNotificationRequest(
                    identifier: identifier(for: item.kind), content: content, trigger: trigger
                ))
            }
        }
    }

    /// Cancel every pending engagement nudge (e.g. the toggle turned off).
    static func cancelAll(center: UNUserNotificationCenter = .current()) {
        center.removePendingNotificationRequests(withIdentifiers: allIdentifiers)
    }
    #else
    @MainActor
    static func refresh(appState: AppState, prefs: NotificationPrefsStore = .shared,
                        model: AppModel? = nil, now: Date = Date()) {}
    static func cancelAll() {}
    #endif

    /// The personal calm time for the reminder: a time the member explicitly
    /// picked, else their learned wake time (§4), else a sensible morning hour.
    @MainActor
    static func reminderTime(prefs: NotificationPrefsStore, model: AppModel?) -> DateComponents {
        if prefs.checkInTimeCustomized {
            return DateComponents(hour: prefs.checkInHour, minute: prefs.checkInMinute)
        }
        if let model, let wake = learnedWakeTime(model: model) {
            return wake
        }
        return DateComponents(hour: prefs.checkInHour, minute: prefs.checkInMinute)
    }

    @MainActor
    private static func learnedWakeTime(model: AppModel) -> DateComponents? {
        let ends = model.isDemoMode ? DemoDataProvider.sleepEnds() : []
        return WakeTimeModel.learn(sleepEnds: ends)
    }
}
