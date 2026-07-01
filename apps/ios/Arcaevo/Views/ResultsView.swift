import SwiftUI

/// Biomarker readings grouped by panel, each with the value, the member's
/// personal baseline band, and the RCV verdict.
struct ResultsView: View {
    @Environment(AppModel.self) private var model

    private var panels: [(name: String, readings: [BiomarkerReading])] {
        let grouped = Dictionary(grouping: model.results, by: \.panel)
        return grouped
            .map { (name: $0.key, readings: $0.value.sorted { $0.name < $1.name }) }
            .sorted { $0.name < $1.name }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    if let latest = model.results.map(\.measuredAt).max() {
                        Kicker(text: "Latest draw")
                        Text(latest, style: .date)
                            .font(.system(size: 12, weight: .medium, design: .monospaced))
                            .foregroundStyle(Color.mutedInk)
                    }
                    Spacer()
                    if model.isDemoMode {
                        DemoModeBadge()
                    }
                }

                Text("Verdicts compare each marker to your own baseline band, and only call a change real when it beats test noise (RCV).")
                    .font(.system(size: 13))
                    .lineSpacing(3)
                    .foregroundStyle(Color.caption)

                ForEach(panels, id: \.name) { panel in
                    VStack(alignment: .leading, spacing: 10) {
                        Kicker(text: panel.name)
                        VStack(spacing: 10) {
                            ForEach(panel.readings) { reading in
                                ReadingRow(reading: reading)
                            }
                        }
                    }
                    .padding(.top, 6)
                }

                DisclaimerFooter()
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
        }
        .background(Color.bone.ignoresSafeArea())
        .navigationTitle("Results")
        .toolbarTitleDisplayMode(.large)
    }
}

private struct ReadingRow: View {
    let reading: BiomarkerReading

    var body: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline) {
                    Text(reading.name)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.ink)
                    Spacer()
                    VerdictPill(verdict: reading.rcvVerdict)
                }

                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(formatted(reading.value))
                        .font(.system(size: 26, weight: .medium, design: .monospaced))
                        .foregroundStyle(reading.rcvVerdict == .worsened ? Color.amber : Color.ink)
                    Text(reading.unit)
                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                        .foregroundStyle(Color.caption)
                }

                BaselineBandBar(reading: reading)

                Text("Your baseline \(formatted(reading.baselineBand.low))–\(formatted(reading.baselineBand.high)) \(reading.unit)")
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundStyle(Color.caption)
            }
        }
    }

    private func formatted(_ value: Double) -> String {
        abs(value) >= 10 ? String(format: "%.0f", value) : String(format: "%.2f", value)
    }
}

/// Horizontal band showing the personal baseline range with the current
/// value marked on it.
private struct BaselineBandBar: View {
    let reading: BiomarkerReading

    var body: some View {
        GeometryReader { geo in
            let width = geo.size.width

            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color.ink.opacity(0.08))
                    .frame(height: 6)

                // Personal baseline band
                Capsule()
                    .fill(Color.vitalityTint)
                    .frame(
                        width: max(x(reading.baselineBand.high, in: width) - x(reading.baselineBand.low, in: width), 6),
                        height: 6
                    )
                    .offset(x: x(reading.baselineBand.low, in: width))

                // Current value marker
                Circle()
                    .fill(reading.isWithinBaseline ? Color.vitality : Color.amber)
                    .frame(width: 12, height: 12)
                    .offset(x: x(reading.value, in: width) - 6, y: 0)
            }
            .frame(height: 12)
        }
        .frame(height: 12)
    }

    private func x(_ value: Double, in width: CGFloat) -> CGFloat {
        let span = displayRange
        let fraction = (value - span.lowerBound) / (span.upperBound - span.lowerBound)
        return CGFloat(min(max(fraction, 0), 1)) * width
    }

    private var displayRange: ClosedRange<Double> {
        let band = reading.baselineBand
        let pad = (band.high - band.low) * 0.9 + 0.0001
        let low = min(band.low - pad, reading.value - pad * 0.3)
        let high = max(band.high + pad, reading.value + pad * 0.3)
        return low...high
    }
}
