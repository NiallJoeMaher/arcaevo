import SwiftUI

/// MEMBER APP · Energy ("Energy" in Prototype.dc.html).
///
/// The all-day 0–100 gauge (ALGORITHM §2): a morning start capped by short
/// sleep and the blood-lowered ceiling, a live "now" value, and the forecast
/// afternoon dip with the daylight/movement-over-caffeine nudge. "Same walk,
/// heavier legs — that's this number, not your effort."
struct EnergyV3View: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppModel.self) private var model

    init() {}

    private var now: Date { Date() }

    var body: some View {
        ZStack {
            Color.arcDarkSurface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Mv3BackLink(title: "Today") { dismiss() }
                    Mv3Eyebrow(text: "ENERGY · ALL DAY")
                        .padding(.bottom, 10)

                    headline
                    gaugeCard
                    startCard
                    dipCard
                    footnote
                }
                .padding(.horizontal, 24)
                .padding(.top, 4)
                .padding(.bottom, 20)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task { if model.energyDay == nil { await model.loadAll() } }
    }

    private var day: EnergyDay? { model.energyDay }
    private var nowValue: Int { day?.value(at: now) ?? 54 }
    private var ceiling: Int { day?.ceiling ?? 88 }
    private var start: Int { day?.start ?? 68 }

    // MARK: Big number — "54 of 100 · draining"

    private var headline: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text("\(nowValue)")
                .font(.arcMono(38, weight: .medium))
                .foregroundStyle(Color.arcCream)
            Text("of 100")
                .font(.arcSans(13))
                .foregroundStyle(Color.arcMutedOnDark)
            Text(trendWord)
                .font(.arcMono(12))
                .foregroundStyle(Mv3.watchAmber)
        }
        .padding(.bottom, 12)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Energy \(Mv3.spell(nowValue)) of one hundred, \(trendWord).")
    }

    /// Draining after the day's peak, recharging before it (deterministic).
    private var trendWord: String {
        guard let day, let current = day.value(at: now) else { return "draining" }
        let recent = day.points.last(where: { $0.t <= now.addingTimeInterval(-3600) })?.value
        if let recent { return current < recent ? "draining" : "recharging" }
        return "draining"
    }

    // MARK: The gauge — solid green history, dashed grey forecast

    private var gaugeCard: some View {
        VStack(spacing: 8) {
            EnergyGauge(day: day, now: now)
                .frame(height: 80)
            HStack {
                Text(axisStart)
                Spacer()
                Text("NOW · \(clock(now))")
                Spacer()
                Text("23:00")
            }
            .font(.arcMono(9))
            .foregroundStyle(Color.arcMutedOnDark)
        }
        .padding(.horizontal, 14)
        .padding(.top, 14)
        .padding(.bottom, 10)
        .frame(maxWidth: .infinity)
        .background(Mv3.cardFill, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .padding(.bottom, 9)
    }

    private var axisStart: String {
        guard let first = day?.points.first?.t else { return "06:00" }
        return clock(first)
    }

    // MARK: "WHY IT STARTED AT 68, NOT 100"

    private var startCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Mv3Eyebrow(text: "WHY IT STARTED AT \(start), NOT 100", size: 9, kerning: 0.9)
            Text(startNote)
                .font(.arcSans(12.5))
                .foregroundStyle(Color.arcRailLight)
                .lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 15)
        .padding(.vertical, 13)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Mv3.cardFill, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
        .padding(.bottom, 9)
    }

    /// Wired: short-sleep recharge cap + the real blood ceiling penalty, with
    /// the design's "same walk, heavier legs" framing.
    private var startNote: String {
        var parts: [String] = []
        if let night = model.sleepNights.last, night.hours < 7 {
            let h = String(format: "%.1f", night.hours)
            parts.append("Short sleep (\(h)h) capped the overnight recharge")
        } else {
            parts.append("Your overnight recharge sets this morning's start")
        }
        if let top = model.penalties.first {
            let value = top.value == top.value.rounded() ? String(Int(top.value)) : String(format: "%.1f", top.value)
            parts.append("and low \(top.marker) (\(value) \(top.unit)) lowers your ceiling until it recovers")
        }
        return parts.joined(separator: " — ") + ". Same walk, heavier legs: that's this number, not your effort."
    }

    // MARK: "THE 15:00 DIP · FORECAST"

    @ViewBuilder private var dipCard: some View {
        if let dipHour = day?.forecastDipHour {
            VStack(alignment: .leading, spacing: 6) {
                Mv3Eyebrow(text: "THE \(String(format: "%02d", dipHour)):00 DIP · FORECAST",
                           size: 9, color: Color.arcHollowGold, kerning: 0.9)
                Text("Your usual afternoon dip lands around \(String(format: "%02d", dipHour)):00 today. Daylight or a 10-minute walk beats a third coffee — caffeine after 14:00 cost you 22 minutes of deep sleep in your last experiment.")
                    .font(.arcSans(12.5))
                    .foregroundStyle(Color.arcRailLight)
                    .lineSpacing(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 15)
            .padding(.vertical, 13)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.arcHollowGold.opacity(0.08), in: RoundedRectangle(cornerRadius: 15, style: .continuous))
            .padding(.bottom, 12)
        }
    }

    private var footnote: some View {
        Text("Modelled from HRV, sleep, stress and movement —\nrecalibrated by every blood panel.")
            .font(.arcSans(11.5))
            .foregroundStyle(Color.arcRailDim)
            .multilineTextAlignment(.center)
            .lineSpacing(3)
            .frame(maxWidth: .infinity)
            .padding(.top, 6)
    }

    private func clock(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_IE")
        f.dateFormat = "HH:mm"
        return f.string(from: date)
    }
}

/// The all-day energy curve: solid green up to `now`, dashed grey forecast
/// after, with a peak band and the "now" marker. Y maps 0–100 → chart height.
private struct EnergyGauge: View {
    var day: EnergyDay?
    var now: Date

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height - 12   // leave room for the peak label
            let pts = points(width: w, height: h)
            ZStack(alignment: .topLeading) {
                // Peak band (highest-value stretch).
                if let peak = peakBand(width: w) {
                    Rectangle()
                        .fill(Color.arcPrimaryGreen.opacity(0.08))
                        .frame(width: peak.width, height: h)
                        .offset(x: peak.x)
                }
                // History (solid green).
                curve(pts.filter { !$0.isForecast })
                    .stroke(Color.arcPrimaryGreen, style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
                // Forecast (dashed grey).
                curve(forecastSegment(pts))
                    .stroke(Color.arcMutedOnDark, style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [3, 5]))
                // Now marker.
                if let nowPt = pts.last(where: { !$0.isForecast }) {
                    Circle().fill(Color.arcPrimaryGreen)
                        .frame(width: 10, height: 10)
                        .position(x: nowPt.p.x, y: nowPt.p.y)
                }
                if let peak = peakBand(width: w) {
                    Text("PEAK")
                        .font(.arcMono(8))
                        .foregroundStyle(Color.arcRailDim)
                        .offset(x: peak.x + 2, y: h)
                }
            }
        }
    }

    private struct PlacedPoint { var p: CGPoint; var isForecast: Bool }

    private func points(width: CGFloat, height: CGFloat) -> [PlacedPoint] {
        guard let day, day.points.count > 1 else {
            // Fallback illustrative curve (design shape).
            let sample: [(CGFloat, CGFloat, Bool)] = [
                (0, 30, false), (0.1, 24, false), (0.2, 18, false), (0.3, 14, false),
                (0.4, 12, false), (0.5, 18, false), (0.55, 24, false),
                (0.65, 38, true), (0.75, 44, true), (0.85, 40, true), (0.95, 34, true), (1, 32, true),
            ]
            return sample.map { PlacedPoint(p: CGPoint(x: $0.0 * width, y: $0.1 / 84 * height), isForecast: $0.2) }
        }
        let n = day.points.count
        return day.points.enumerated().map { idx, s in
            let x = CGFloat(idx) / CGFloat(n - 1) * width
            let y = height * (1 - CGFloat(max(0, min(100, s.value))) / 100)
            return PlacedPoint(p: CGPoint(x: x, y: y), isForecast: s.t > now)
        }
    }

    private func curve(_ pts: [PlacedPoint]) -> Path {
        Path { path in
            guard let first = pts.first else { return }
            path.move(to: first.p)
            for pt in pts.dropFirst() { path.addLine(to: pt.p) }
        }
    }

    /// The forecast path starts at the last history point so the line joins.
    private func forecastSegment(_ pts: [PlacedPoint]) -> [PlacedPoint] {
        guard let lastHistoryIdx = pts.lastIndex(where: { !$0.isForecast }) else { return [] }
        return Array(pts[lastHistoryIdx...])
    }

    private func peakBand(width: CGFloat) -> (x: CGFloat, width: CGFloat)? {
        guard let day, day.points.count > 2 else {
            return (x: width * 0.3, width: width * 0.23)
        }
        guard let maxVal = day.points.map(\.value).max() else { return nil }
        let idxs = day.points.enumerated().filter { $0.element.value >= maxVal - 4 }.map(\.offset)
        guard let lo = idxs.min(), let hi = idxs.max(), hi > lo else { return nil }
        let n = CGFloat(day.points.count - 1)
        let x = CGFloat(lo) / n * width
        return (x: x, width: CGFloat(hi - lo) / n * width)
    }
}

#if DEBUG
#Preview("Energy") {
    MemberV3ScreenPreview { NavigationStack { EnergyV3View() } }
}
#endif
