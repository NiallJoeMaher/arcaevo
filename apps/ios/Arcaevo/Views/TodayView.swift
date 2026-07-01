import SwiftUI

/// Dashboard: baseline status ring, latest plain-language insight,
/// wearable trend sparklines and the "did it work?" experiment card.
struct TodayView: View {
    @Environment(AppModel.self) private var model
    @State private var selectedMetric: WearableMetric = .hrv

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header

                baselineCard

                if let insight = model.latestInsight {
                    insightCard(insight)
                }

                trendsCard

                if let experiment = model.experimentInsight {
                    experimentCard(experiment)
                }

                DisclaimerFooter()
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
        }
        .background(Color.bone.ignoresSafeArea())
        .navigationTitle("Today")
        .toolbarTitleDisplayMode(.large)
        .refreshable {
            await model.loadAll()
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Kicker(text: greeting)
                Spacer()
                if model.isDemoMode {
                    DemoModeBadge()
                }
            }
        }
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        let name = model.user?.name.components(separatedBy: " ").first ?? "there"
        switch hour {
        case 5..<12: return "Good morning, \(name)"
        case 12..<18: return "Good afternoon, \(name)"
        default: return "Good evening, \(name)"
        }
    }

    // MARK: - Baseline status

    private var baselineCard: some View {
        InkCard {
            HStack(spacing: 20) {
                ReadinessRing(score: model.readinessScore)
                VStack(alignment: .leading, spacing: 6) {
                    Kicker(text: "Baseline status", color: .mutedOnDark)
                    Text(baselineHeadline)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Color.boneWhite)
                    Text(model.isUsingMockHealthData
                         ? "Demo wearable data — connect Apple Health for your own."
                         : "From your last 30 days of Apple Health data.")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.mutedOnDark)
                }
            }
        }
    }

    private var baselineHeadline: String {
        switch model.readinessScore {
        case 80...: return "Trending above your baseline"
        case 60..<80: return "Within your baseline"
        default: return "Below your baseline — go easy"
        }
    }

    // MARK: - Latest insight

    private func insightCard(_ insight: Insight) -> some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 10) {
                Kicker(text: "Latest insight")
                Text(insight.title)
                    .displaySerif(22)
                    .foregroundStyle(Color.ink)
                Text(insight.body)
                    .font(.system(size: 15))
                    .lineSpacing(4)
                    .foregroundStyle(Color.mutedInk)
                Text(insight.createdAt, style: .date)
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundStyle(Color.caption)
            }
        }
    }

    // MARK: - Trends

    private var trendsCard: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 12) {
                Kicker(text: "30-day trends")

                Picker("Metric", selection: $selectedMetric) {
                    ForEach(WearableMetric.allCases, id: \.self) { metric in
                        Text(metric.displayName).tag(metric)
                    }
                }
                .pickerStyle(.segmented)

                let series = model.wearableSeries[selectedMetric] ?? []
                if series.isEmpty {
                    Text("No data yet — connect Apple Health in Settings.")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.caption)
                        .frame(maxWidth: .infinity, minHeight: 90)
                } else {
                    SparklineChart(series: series)
                        .frame(height: 90)

                    HStack {
                        if let latest = series.last {
                            Text("\(latest.value, specifier: "%.1f") \(selectedMetric.unit)")
                                .font(.system(size: 15, weight: .semibold, design: .monospaced))
                                .foregroundStyle(Color.ink)
                        }
                        Spacer()
                        Text("APPLE HEALTH")
                            .font(.system(size: 9, weight: .medium, design: .monospaced))
                            .kerning(1)
                            .foregroundStyle(Color.caption)
                    }
                }
            }
        }
    }

    // MARK: - "Did it work?" experiment

    private func experimentCard(_ insight: Insight) -> some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Kicker(text: "Did it work?")
                    Spacer()
                    if let verdict = insight.verdict {
                        VerdictPill(verdict: verdict)
                    }
                }
                if let action = insight.experimentAction {
                    Text(action)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Color.ink)
                }
                Text(insight.body)
                    .font(.system(size: 14))
                    .lineSpacing(4)
                    .foregroundStyle(Color.mutedInk)
            }
        }
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(Color.vitality.opacity(0.45), lineWidth: 1)
        )
    }
}
