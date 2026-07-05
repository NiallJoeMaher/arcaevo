import Foundation
#if canImport(UserNotifications)
import UserNotifications
#endif

// MARK: - First-run re-engagement nudge (local, one-time)
//
// The design wants people to generate their first score. If a member has
// onboarded + granted notifications but hasn't opened their readiness surface,
// we schedule ONE kind, non-alarming local nudge ~24h out ("Your first reading
// is ready to unlock…"). It's cancelled the moment they view a score
// (`AppState.markFirstScoreViewed`). No APNs — a local UNCalendarNotification
// trigger only; quiet hours + the notification prefs are honoured; never a
// health value in the payload.
//
// NOT part of the twelve-card daily vocabulary — a one-time onboarding prompt.

enum FirstReadingNudge {
    /// Own identifier, namespaced like the planner's but distinct from the
    /// twelve `PushKey` identities so it never collides with them.
    static let identifier = NotificationPlanner.identifierPrefix + "firstReading"

    /// How long after onboarding to wait before nudging.
    static let delay: TimeInterval = 24 * 3600

    #if canImport(UserNotifications)
    /// Schedule the nudge if warranted. No-op when: the member has already
    /// viewed a score, is still onboarding, has no push prefs on, hasn't granted
    /// system authorization, or a nudge is already pending (so we anchor the
    /// fire time to the FIRST schedule and never keep pushing it out).
    @MainActor
    static func scheduleIfNeeded(
        appState: AppState,
        prefs: NotificationPrefsStore = .shared,
        now: Date = Date(),
        quietHours: QuietHours = .default,
        calendar: Calendar = .current,
        center: UNUserNotificationCenter = .current()
    ) {
        guard !appState.hasViewedFirstScore else { cancel(center: center); return }
        // Only once onboarding is complete (they've seen the value pitch) and
        // at least one push-backed toggle is on.
        if case .onboarding = appState.phase { return }
        guard prefs.anyPushEnabled else { return }

        // Compute the fire time now (deferred past quiet hours) so it's stable.
        var fire = now.addingTimeInterval(delay)
        if quietHours.contains(fire, calendar: calendar) {
            fire = quietHours.nextAllowed(after: fire, calendar: calendar)
        }

        center.getNotificationSettings { settings in
            guard settings.authorizationStatus == .authorized
                    || settings.authorizationStatus == .provisional else { return }
            center.getPendingNotificationRequests { requests in
                // Already scheduled → leave the original fire time in place.
                guard !requests.contains(where: { $0.identifier == identifier }) else { return }

                let content = UNMutableNotificationContent()
                content.title = PushCopy.FirstReading.title
                content.body = PushCopy.FirstReading.body
                content.sound = nil // kind, non-alarming — surfaces without a buzz
                if #available(iOS 15.0, *) {
                    content.interruptionLevel = .active
                }

                let comps = calendar.dateComponents(
                    [.year, .month, .day, .hour, .minute], from: fire
                )
                let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
                center.add(UNNotificationRequest(identifier: identifier, content: content, trigger: trigger))
            }
        }
    }

    /// Cancel any pending activation nudge (called once a score is viewed).
    static func cancel(center: UNUserNotificationCenter = .current()) {
        center.removePendingNotificationRequests(withIdentifiers: [identifier])
    }
    #else
    @MainActor
    static func scheduleIfNeeded(appState: AppState) {}
    static func cancel() {}
    #endif
}
