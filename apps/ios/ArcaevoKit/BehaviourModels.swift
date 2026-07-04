import Foundation

// MARK: - Behaviour-impact model (ALGORITHM §1.5 — own history, never a
// population average)

/// Regresses logged check-in tags against next-day readiness deltas to
/// produce the personal behaviour-impact table ("Alcohol −11 readiness next
/// day", "Evening walk +4"). Deterministic; surfaces a tag only when the
/// member has ≥ 3 of their own tagged days behind it.
enum BehaviourImpactModel {

    static let minSamples = 3

    static func compute(
        checkins: [FeltCheckin],
        scores: [DatedScore],
        calendar: Calendar = .current
    ) -> [BehaviourImpact] {
        // Score per day, and the next-day delta for every check-in day where
        // both today's and tomorrow's scores exist.
        var scoreByDay: [Date: Int] = [:]
        for score in scores {
            scoreByDay[calendar.startOfDay(for: score.date)] = score.score
        }

        struct DayDelta {
            var tags: Set<String>
            var delta: Double
        }
        var deltas: [DayDelta] = []
        for checkin in checkins {
            let day = calendar.startOfDay(for: checkin.date)
            guard
                let today = scoreByDay[day],
                let nextDay = calendar.date(byAdding: .day, value: 1, to: day),
                let tomorrow = scoreByDay[nextDay]
            else { continue }
            deltas.append(DayDelta(tags: Set(checkin.tags), delta: Double(tomorrow - today)))
        }
        guard !deltas.isEmpty else { return [] }

        // Control: the member's own untagged days.
        let control = deltas.filter { $0.tags.isEmpty }.map(\.delta)
        let controlMean = control.isEmpty ? 0 : control.reduce(0, +) / Double(control.count)

        var impacts: [BehaviourImpact] = []
        let allTags = Set(deltas.flatMap(\.tags))
        for tag in allTags {
            let tagged = deltas.filter { $0.tags.contains(tag) }.map(\.delta)
            guard tagged.count >= minSamples else { continue }
            let mean = tagged.reduce(0, +) / Double(tagged.count)
            let delta = ((mean - controlMean) * 10).rounded() / 10
            impacts.append(BehaviourImpact(tag: tag, delta: delta, n: tagged.count))
        }
        return impacts.sorted {
            abs($0.delta) != abs($1.delta) ? abs($0.delta) > abs($1.delta) : $0.tag < $1.tag
        }
    }
}

// MARK: - Learned wake time (ALGORITHM §4 — morning readiness fires at the
// user's learned wake, never a 6am blast)

enum WakeTimeModel {

    static let minSamples = 3

    /// Learns the usual wake time as the median minute-of-day of recent sleep
    /// ends. nil until there are ≥ 3 overnight reads — never guess.
    static func learn(sleepEnds: [Date], calendar: Calendar = .current) -> DateComponents? {
        guard sleepEnds.count >= minSamples else { return nil }
        let minutes = sleepEnds.map { date -> Int in
            let comps = calendar.dateComponents([.hour, .minute], from: date)
            return (comps.hour ?? 0) * 60 + (comps.minute ?? 0)
        }.sorted()
        let median = minutes[minutes.count / 2]
        return DateComponents(hour: median / 60, minute: median % 60)
    }
}
