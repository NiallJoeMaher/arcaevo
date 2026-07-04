import Foundation
import Observation
#if canImport(UserNotifications)
import UserNotifications
#endif

// MARK: - Notification layer (Phase 22 · Wave 2b)
//
// Schedules the LOCAL notifications that sit behind the eight prefs, using the
// verbatim `PushCopy` catalog. Design + rules: ALGORITHM.md §4 (the pref table,
// triggers, delivery rules) and the `pushgallery` screen.
//
// House rules enforced here (§4 / §5):
//   • Morning readiness surfaces at the member's LEARNED wake time and never
//     buzzes (passive, no sound) — the watchOS Smart Stack pattern.
//   • Energy dip fires ~30 min before the personal afternoon dip.
//   • Results/critical are clinician-first: the payload NEVER carries a value
//     or a red number — we only ever ship the canonical `PushCopy` strings, so
//     no dynamic value can leak in.
//   • No streak guilt; quiet hours are respected (non-urgent nudges deferred).
//   • No APNs this phase — everything is a local `UNCalendarNotificationTrigger`.

// MARK: 8-toggle preference store

/// The eight notification toggles (design `notifDefs`), persisted to
/// `UserDefaults`. Defaults follow "only the ones worth a buzz": results,
/// reminders, morning readiness, out-of-range vitals and monthly Vitality are
/// ON; weekly focus and energy dips are OFF; Face ID lock is ON.
///
/// Kept self-contained (not on `AppState`) so the daily-engagement toggles ship
/// without touching Wave 1a's model. Both the onboarding primer and the Account
/// screen read/write this single shared instance.
@Observable
final class NotificationPrefsStore {
    static let shared = NotificationPrefsStore()

    var results: Bool { didSet { write("results", results) } }
    var reminders: Bool { didSet { write("reminders", reminders) } }
    var readiness: Bool { didSet { write("readiness", readiness) } }
    var vitals: Bool { didSet { write("vitals", vitals) } }
    var monthly: Bool { didSet { write("monthly", monthly) } }
    var weeklyFocus: Bool { didSet { write("focus", weeklyFocus) } }
    var energyDip: Bool { didSet { write("energy", energyDip) } }
    var faceIDLock: Bool { didSet { write("faceid", faceIDLock) } }

    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private static let keyPrefix = "arcaevo.notify."

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        func load(_ key: String, default fallback: Bool) -> Bool {
            defaults.object(forKey: Self.keyPrefix + key) as? Bool ?? fallback
        }
        // NB: property observers do NOT fire for assignments in init.
        results = load("results", default: true)
        reminders = load("reminders", default: true)
        readiness = load("readiness", default: true)
        vitals = load("vitals", default: true)
        monthly = load("monthly", default: true)
        weeklyFocus = load("focus", default: false)
        energyDip = load("energy", default: false)
        faceIDLock = load("faceid", default: true)
    }

    private func write(_ key: String, _ value: Bool) {
        defaults.set(value, forKey: Self.keyPrefix + key)
    }

    /// Any push-backed toggle on? (Face ID lock is a lock, not a push.)
    var anyPushEnabled: Bool {
        results || reminders || readiness || vitals || monthly || weeklyFocus || energyDip
    }

    /// Immutable snapshot for the pure planner.
    var snapshot: PushPrefs {
        PushPrefs(results: results, reminders: reminders, readiness: readiness,
                  vitals: vitals, monthly: monthly, weeklyFocus: weeklyFocus,
                  energyDip: energyDip, faceIDLock: faceIDLock)
    }
}

/// Value snapshot of the toggles + the pref→push gating (§4 table).
struct PushPrefs: Hashable, Sendable {
    var results = true
    var reminders = true
    var readiness = true
    var vitals = true
    var monthly = true
    var weeklyFocus = false
    var energyDip = false
    var faceIDLock = true

    /// Whether a push identity is permitted. Recheck, sick-mode and critical are
    /// always-on rails (§4 lists recheck/sick as "on" with no toggle; critical is
    /// a person reaching out); experiment verdicts have no opt-out in the 8-set.
    func allows(_ key: PushKey) -> Bool {
        switch key {
        case .readiness:                     return readiness
        case .results:                       return results
        case .critical:                      return true
        case .testNightBefore, .testMorningOf: return reminders
        case .weeklyFocus:                   return weeklyFocus
        case .vitalsOutOfRange:              return vitals
        case .energyDip:                     return energyDip
        case .experimentVerdict:             return true
        case .recheckWindow:                 return true
        case .sickMode:                      return true
        case .monthlyVitality:               return monthly
        }
    }
}

// MARK: Quiet hours

/// A nightly window during which non-urgent nudges are deferred to the morning.
struct QuietHours: Hashable, Sendable {
    var startHour = 22
    var endHour = 7   // 22:00 → 07:00

    static let `default` = QuietHours()

    func contains(_ date: Date, calendar: Calendar) -> Bool {
        let h = calendar.component(.hour, from: date)
        if startHour <= endHour { return h >= startHour && h < endHour }
        return h >= startHour || h < endHour   // wraps midnight
    }

    /// The next instant outside the window (its end, today or tomorrow morning).
    func nextAllowed(after date: Date, calendar: Calendar) -> Date {
        guard contains(date, calendar: calendar) else { return date }
        let h = calendar.component(.hour, from: date)
        var day = date
        // Late-evening side of a midnight-wrapping window → end is tomorrow.
        if startHour > endHour, h >= startHour {
            day = calendar.date(byAdding: .day, value: 1, to: date) ?? date
        }
        return calendar.date(bySettingHour: endHour, minute: 0, second: 0, of: day) ?? date
    }
}

// MARK: Planner inputs / outputs

/// How intrusive a delivered notification is. Kept UI/UN-free so `plan` stays
/// pure; `schedule` maps it to `UNNotificationInterruptionLevel`.
enum PushInterruption: Sendable { case passive, active, timeSensitive }

/// Everything the pure planner needs. Event anchors are optional — `nil` means
/// "no such event pending", so nothing is scheduled for it.
struct PlannerContext {
    var now: Date
    var calendar: Calendar = .current
    var quietHours: QuietHours = .default

    /// Learned usual wake time (`WakeTimeModel.learn`); `nil` → 07:00 default.
    var learnedWakeTime: DateComponents?
    /// Forecast afternoon dip hour (`EnergyDay.forecastDipHour`).
    var forecastDipHour: Int?

    /// Schedule tomorrow's passive morning-readiness surface.
    var scheduleMorningReadiness = false

    // Event anchors.
    var resultsReadyAt: Date?
    var criticalPendingAt: Date?
    var nextTestDate: Date?
    var weeklyFocusAt: Date?
    var vitalsOutOfBandAt: Date?
    var experimentVerdictAt: Date?
    var recheckDueAt: Date?
    var sickModeEnteredAt: Date?
    var monthlyVitalityAt: Date?

    init(now: Date, calendar: Calendar = .current) {
        self.now = now
        self.calendar = calendar
    }
}

/// A concrete local notification to schedule — resolved copy + fire time.
struct PlannedNotification: Identifiable, Hashable, Sendable {
    let key: PushKey
    let identifier: String
    let fireDate: Date
    let title: String
    let body: String
    let interruption: PushInterruption

    var id: String { identifier }
}

// MARK: Planner

enum NotificationPlanner {
    static let identifierPrefix = "arcaevo.push."

    static func identifier(for key: PushKey) -> String { identifierPrefix + key.rawValue }

    /// Pure core: prefs + context → the notifications to schedule. Deterministic
    /// (all date math via `context.calendar`/`now`) and side-effect-free, so it
    /// can be unit-tested without a notification centre.
    static func plan(prefs: PushPrefs, context ctx: PlannerContext) -> [PlannedNotification] {
        var out: [PlannedNotification] = []
        let cal = ctx.calendar

        func add(_ key: PushKey, at rawDate: Date, urgent: Bool = false) {
            guard prefs.allows(key) else { return }
            let fire = urgent ? rawDate : deferPastQuietHours(rawDate, ctx: ctx)
            guard fire > ctx.now else { return }   // never schedule the past
            let card = PushCopy.card(key)
            out.append(PlannedNotification(
                key: key,
                identifier: identifier(for: key),
                fireDate: fire,
                title: card.title,   // verbatim — no value ever interpolated
                body: card.body,
                interruption: interruption(for: key)
            ))
        }

        // Morning readiness — learned wake time, passive (never buzzes, so it is
        // exempt from quiet-hours deferral; wake is by definition outside them).
        if ctx.scheduleMorningReadiness, let wake = nextWake(ctx: ctx) {
            add(.readiness, at: wake, urgent: true)
        }

        // Energy dip — ~30 min before the forecast dip hour, if still ahead today.
        if let dipHour = ctx.forecastDipHour,
           let dip = cal.date(bySettingHour: dipHour, minute: 0, second: 0, of: ctx.now),
           let cue = cal.date(byAdding: .minute, value: -30, to: dip) {
            add(.energyDip, at: cue)
        }

        // Test / fasting reminders — night-before 21:30, morning-of at wake.
        if let testDay = ctx.nextTestDate {
            if let eve = dayBefore(testDay, hour: 21, minute: 30, cal: cal) {
                add(.testNightBefore, at: eve)
            }
            if let morningOf = wakeTime(on: testDay, ctx: ctx, fallbackHour: 7) {
                add(.testMorningOf, at: morningOf)
            }
        }

        // Event-driven cards (fired when their backend events arrive).
        if let d = ctx.resultsReadyAt      { add(.results, at: d) }
        if let d = ctx.criticalPendingAt   { add(.critical, at: d, urgent: true) }
        if let d = ctx.weeklyFocusAt       { add(.weeklyFocus, at: d) }
        if let d = ctx.vitalsOutOfBandAt   { add(.vitalsOutOfRange, at: d) }
        if let d = ctx.experimentVerdictAt { add(.experimentVerdict, at: d) }
        if let d = ctx.recheckDueAt        { add(.recheckWindow, at: d) }
        if let d = ctx.sickModeEnteredAt   { add(.sickMode, at: d, urgent: true) }
        if let d = ctx.monthlyVitalityAt   { add(.monthlyVitality, at: d) }

        return out
    }

    /// The calmest sensible interruption per card — nothing in the daily layer
    /// shouts; only a clinician's call is time-sensitive.
    static func interruption(for key: PushKey) -> PushInterruption {
        switch key {
        case .readiness, .energyDip, .sickMode, .monthlyVitality, .weeklyFocus:
            return .passive
        case .critical:
            return .timeSensitive
        default:
            return .active
        }
    }

    // MARK: Date helpers

    private static func nextWake(ctx: PlannerContext) -> Date? {
        let comps = ctx.learnedWakeTime ?? DateComponents(hour: 7, minute: 0)
        guard let today = ctx.calendar.date(
            bySettingHour: comps.hour ?? 7, minute: comps.minute ?? 0, second: 0, of: ctx.now
        ) else { return nil }
        return today > ctx.now ? today : ctx.calendar.date(byAdding: .day, value: 1, to: today)
    }

    private static func wakeTime(on day: Date, ctx: PlannerContext, fallbackHour: Int) -> Date? {
        let comps = ctx.learnedWakeTime ?? DateComponents(hour: fallbackHour, minute: 0)
        return ctx.calendar.date(
            bySettingHour: comps.hour ?? fallbackHour, minute: comps.minute ?? 0, second: 0, of: day
        )
    }

    private static func dayBefore(_ day: Date, hour: Int, minute: Int, cal: Calendar) -> Date? {
        guard let prev = cal.date(byAdding: .day, value: -1, to: day) else { return nil }
        return cal.date(bySettingHour: hour, minute: minute, second: 0, of: prev)
    }

    /// Push a non-urgent fire time out of the quiet-hours window.
    private static func deferPastQuietHours(_ date: Date, ctx: PlannerContext) -> Date {
        ctx.quietHours.contains(date, calendar: ctx.calendar)
            ? ctx.quietHours.nextAllowed(after: date, calendar: ctx.calendar)
            : date
    }
}

// MARK: Scheduling (UNUserNotificationCenter)

#if canImport(UserNotifications)
extension NotificationPlanner {
    /// Registers the planned local notifications, replacing only OUR pending
    /// set (never touches other identifiers). No APNs — local triggers only.
    static func schedule(
        _ planned: [PlannedNotification],
        center: UNUserNotificationCenter = .current(),
        calendar: Calendar = .current
    ) {
        center.removePendingNotificationRequests(
            withIdentifiers: PushKey.allCases.map(identifier(for:))
        )
        for p in planned {
            let content = UNMutableNotificationContent()
            content.title = p.title
            content.body = p.body
            content.sound = p.interruption == .passive ? nil : .default
            if #available(iOS 15.0, *) {
                switch p.interruption {
                case .passive:       content.interruptionLevel = .passive
                case .active:        content.interruptionLevel = .active
                case .timeSensitive: content.interruptionLevel = .timeSensitive
                }
            }
            let comps = calendar.dateComponents(
                [.year, .month, .day, .hour, .minute], from: p.fireDate
            )
            let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
            center.add(UNNotificationRequest(identifier: p.identifier, content: content, trigger: trigger))
        }
    }

    /// Plan + schedule in one call.
    static func apply(
        prefs: PushPrefs,
        context: PlannerContext,
        center: UNUserNotificationCenter = .current()
    ) {
        schedule(plan(prefs: prefs, context: context), center: center, calendar: context.calendar)
    }

    /// Cancels every Arcaevo push we own (e.g. all toggles turned off).
    static func cancelAll(center: UNUserNotificationCenter = .current()) {
        center.removePendingNotificationRequests(
            withIdentifiers: PushKey.allCases.map(identifier(for:))
        )
    }
}
#endif

// MARK: AppModel bridge

extension NotificationPlanner {
    /// App glue: build a `PlannerContext` from the live engine outputs and
    /// (re)schedule the deterministic, engine-driven reminders — morning
    /// readiness at the learned wake time and the energy-dip cue. Event-driven
    /// cards (results/critical/verdict/recheck/monthly) fire when their backend
    /// events arrive, which this phase does not surface.
    @MainActor
    static func refresh(store: NotificationPrefsStore, model: AppModel, now: Date = Date()) {
        #if canImport(UserNotifications)
        guard store.anyPushEnabled else { cancelAll(); return }
        var ctx = PlannerContext(now: now)
        ctx.learnedWakeTime = learnedWakeTime(model: model)
        ctx.forecastDipHour = model.energyDay?.forecastDipHour
        ctx.scheduleMorningReadiness = store.readiness
        apply(prefs: store.snapshot, context: ctx)
        #endif
    }

    /// Learn the usual wake time from sleep ends (`WakeTimeModel.learn`, ≥3
    /// samples). Demo uses the crafted series; a real build feeds HealthKit
    /// sleep ends once ingested. `nil` → the planner falls back to 07:00.
    @MainActor
    private static func learnedWakeTime(model: AppModel) -> DateComponents? {
        let ends = model.isDemoMode ? DemoDataProvider.sleepEnds() : []
        return WakeTimeModel.learn(sleepEnds: ends)
    }
}
