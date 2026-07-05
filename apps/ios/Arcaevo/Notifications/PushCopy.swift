import Foundation

// MARK: - Push copy catalog (Phase 22 · the WHOLE vocabulary)
//
// Source of truth: the `pushgallery` ("Notification copy") screen in
// design_handoff_daily_engagement/designs/Prototype.dc.html — twelve cards,
// one voice, FINAL copy. "Twelve notifications. That's the whole vocabulary."
// Anything not on that screen does not ship — do not invent pushes.
//
// The house rules baked into this copy (ALGORITHM §4 / §5):
//   • Never a blood value in a payload — results say "it's ready", never the
//     number; critical values never push the number at all (a clinician calls
//     first).
//   • No streak guilt, ever. Amber at worst. The calmest state is the default.
//   • A person before any worrying number.
// The strings here are verbatim; `NotificationPlanner` only ever ships these
// canonical titles/bodies, so no dynamic value can leak into a payload.

/// The twelve — and only twelve — push identities Arcaevo can send.
enum PushKey: String, CaseIterable, Codable, Sendable {
    case readiness           // morning readiness (Smart Stack, never buzzes)
    case results             // panel reviewed — value never in payload
    case critical            // clinician-first, a person before the number
    case testNightBefore     // night-before fasting reminder
    case testMorningOf       // morning-of reminder
    case weeklyFocus         // one nudge a week, off by default
    case vitalsOutOfRange    // early-illness flag, no numbers
    case energyDip           // ~30 min before the personal afternoon dip
    case experimentVerdict   // an experiment has a verdict
    case recheckWindow       // the €69 recheck kit — never a supplement
    case sickMode            // rest is the plan, not a failure
    case monthlyVitality     // the slow score, once a month
}

/// One push card, exactly as it reads on the design's notification gallery.
struct PushCard: Identifiable, Hashable, Sendable {
    let key: PushKey
    /// The cadence hint shown on the gallery card (display-only, e.g. "06:45",
    /// "MON 08:10", "1 AUG"). Not the real fire time — the planner computes
    /// that from the member's learned wake time / dip forecast / test dates.
    let when: String
    let title: String
    let body: String
    /// The small mono caption under each gallery card — the trigger + rule.
    let trigger: String

    var id: PushKey { key }
}

enum PushCopy {
    /// Verbatim from the `pushRows` list on the "Notification copy" screen,
    /// in the same order. This IS the whole vocabulary.
    static let all: [PushCard] = [
        PushCard(
            key: .readiness,
            when: "06:45",
            title: "Readiness 62 — go easy",
            body: "HRV below your band. Ceiling 4 of 10 today.",
            trigger: "SMART STACK · SURFACES AT YOUR WAKE, NEVER BUZZES"
        ),
        PushCard(
            key: .results,
            when: "11:20",
            title: "Your July panel is in",
            body: "38 markers, reviewed — and Dr. Nolan has left you a note.",
            trigger: "RESULTS · NEVER A VALUE IN THE PAYLOAD"
        ),
        PushCard(
            key: .critical,
            when: "12:04",
            title: "Dr. Nolan would like a word",
            body: "One value needs a conversation before you read it alone. She'll call between 14:00 and 17:00.",
            trigger: "CRITICAL · A PERSON FIRST, ALWAYS"
        ),
        PushCard(
            key: .testNightBefore,
            when: "21:30",
            title: "Kit day tomorrow",
            body: "Nothing after 22:00 except water. We'll nudge you again at 07:00.",
            trigger: "TESTING · NIGHT-BEFORE FASTING REMINDER"
        ),
        PushCard(
            key: .testMorningOf,
            when: "07:00",
            title: "Fasted and ready",
            body: "Test before breakfast, post before noon. Twenty minutes, start to letterbox.",
            trigger: "TESTING · MORNING-OF REMINDER"
        ),
        PushCard(
            key: .weeklyFocus,
            when: "MON 08:10",
            title: "This week: change nothing",
            body: "The walks are working — ApoB is answering them. Keep the plan.",
            trigger: "WEEKLY FOCUS · ONE PER WEEK, OFF BY DEFAULT"
        ),
        PushCard(
            key: .vitalsOutOfRange,
            when: "07:02",
            title: "Take today gently",
            body: "Your overnight signals sat outside your band. Might be nothing — often it's a cold arriving a day early.",
            trigger: "OUT-OF-RANGE VITALS · EARLY ILLNESS FLAG, NO NUMBERS"
        ),
        PushCard(
            key: .energyDip,
            when: "14:30",
            title: "Your 15:00 dip is due",
            body: "Daylight or ten minutes outside beats a third coffee.",
            trigger: "ENERGY DIP · OPT-IN ONLY"
        ),
        PushCard(
            key: .experimentVerdict,
            when: "18:40",
            title: "Your experiment has a verdict",
            body: "Fourteen weeks of caffeine discipline, measured against your own baseline. It's a good one.",
            trigger: "EXPERIMENTS · VERDICT READY"
        ),
        PushCard(
            key: .recheckWindow,
            when: "09:15",
            title: "Time to close the loop?",
            body: "It's been 22 weeks since ferritin dipped. A recheck would tell us whether the iron worked.",
            trigger: "RECHECK WINDOW · THE €69 KIT — NEVER A SUPPLEMENT"
        ),
        PushCard(
            key: .sickMode,
            when: "08:05",
            title: "Rest day honoured",
            body: "You tagged feeling ill. Experiments paused, nudges silenced — we'll pick it back up when your signals do.",
            trigger: "SICK MODE · REST IS THE PLAN, NOT A FAILURE"
        ),
        PushCard(
            key: .monthlyVitality,
            when: "1 AUG",
            title: "July's Vitality is in",
            body: "0.3 years younger this month. VO₂max did the lifting.",
            trigger: "MONTHLY VITALITY · THE SLOW SCORE"
        ),
    ]

    /// Lookup by key. Every key in `PushKey` has exactly one card.
    static func card(_ key: PushKey) -> PushCard {
        // Safe force: `all` covers every case (asserted in DEBUG below).
        all.first { $0.key == key }!
    }

    // MARK: First-run activation nudge (NOT one of the twelve)
    //
    // Deliberately separate from the twelve-card daily vocabulary: this is a
    // one-time ONBOARDING activation prompt, scheduled once when a member has
    // notifications on but hasn't yet opened their readiness, and cancelled the
    // moment they view their first score. Same calm voice — no streak guilt,
    // never a health value, never a number. See `FirstReadingNudge`.
    enum FirstReading {
        static let title = "Your first reading is ready to unlock"
        static let body = "Open Arcaevo to see where your baseline starts."
    }

    // MARK: Re-engagement copy (NOT one of the twelve)
    //
    // The daily check-in reminder + the escalating re-engagement series for
    // inactive members. Deliberately OUTSIDE the twelve-card daily vocabulary
    // (like `FirstReading`) so that invariant stays intact. Same calm voice —
    // never a health value, never a number, never streak guilt. The escalation
    // BACKS OFF (day 2 → 4 → 7 → stop): warm, low-frequency, never nagging.
    // Keyed to `EngagementNudgeKind` (ArcaevoKit) — see `EngagementNudge`.
    enum Engagement {
        static func card(_ kind: EngagementNudgeKind) -> (title: String, body: String) {
            switch kind {
            case .dailyCheckIn:
                return ("A moment for today",
                        "Open Arcaevo to see where your baseline sits, and log how you feel.")
            case .reengageDay2:
                return ("Your readings are waiting",
                        "Whenever you're ready — a quick look keeps your baseline current.")
            case .reengageDay4:
                return ("Still here when you are",
                        "No rush at all. Your readings and notes are waiting whenever it suits.")
            case .reengageDay7:
                return ("Your baseline is still here",
                        "Whenever you're ready to pick things back up — no catching up required.")
            }
        }
    }

    #if DEBUG
    /// Guards the "whole vocabulary" invariant: 12 cards, one per key, no dupes.
    static let isComplete: Bool =
        all.count == PushKey.allCases.count &&
        Set(all.map(\.key)).count == PushKey.allCases.count
    #endif
}
