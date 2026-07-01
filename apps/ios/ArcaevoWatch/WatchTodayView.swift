import SwiftUI

/// The whole watch app: one scrollable view — today ring, the latest insight
/// sentence, and the last blood-test status. Never a dashboard on the wrist.
struct WatchTodayView: View {
    @State private var score: Int = 0
    @State private var insight: Insight?
    @State private var lastOrder: TestOrder?

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                ReadinessRing(
                    score: score,
                    size: 88,
                    lineWidth: 9,
                    trackColor: .white.opacity(0.12),
                    labelColor: .white,
                    captionColor: .mutedOnDark
                )
                .padding(.top, 4)

                if let insight {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("FOCUS")
                            .font(.system(size: 9, weight: .medium, design: .monospaced))
                            .kerning(1)
                            .foregroundStyle(Color.mutedOnDark)
                        Text(insight.title)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(.white)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
                    .background(Color.white.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }

                if let order = lastOrder {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("BLOOD TEST")
                            .font(.system(size: 9, weight: .medium, design: .monospaced))
                            .kerning(1)
                            .foregroundStyle(Color.mutedOnDark)
                        Text(order.status.displayName)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(order.status == .resultsReady ? Color.vitalityLight : .white)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
                    .background(Color.vitality.opacity(0.16))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }

                Text("Not a medical device.")
                    .font(.system(size: 9, weight: .medium, design: .monospaced))
                    .foregroundStyle(Color.mutedOnDark)
                    .padding(.bottom, 4)
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle("Arcaevo")
        .task {
            await load()
        }
    }

    /// Try the local API; fall back to seeded demo data so the watch
    /// always demos. Wearable series come from the deterministic demo
    /// provider (v1 keeps HealthKit reads on the phone).
    private func load() async {
        let api = APIClient()

        if let insights = try? await api.insights() {
            insight = insights.max(by: { $0.createdAt < $1.createdAt })
        } else {
            insight = DemoDataProvider.insights().max(by: { $0.createdAt < $1.createdAt })
        }

        if let orders = try? await api.orders() {
            lastOrder = orders.max(by: { $0.orderedAt < $1.orderedAt })
        } else {
            lastOrder = DemoDataProvider.orders().max(by: { $0.orderedAt < $1.orderedAt })
        }

        score = Readiness.score(
            hrv: DemoDataProvider.wearableSeries(metric: .hrv),
            restingHeartRate: DemoDataProvider.wearableSeries(metric: .restingHeartRate),
            sleep: DemoDataProvider.wearableSeries(metric: .sleepHours)
        )
    }
}
