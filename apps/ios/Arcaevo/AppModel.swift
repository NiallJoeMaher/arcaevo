import Foundation
import Observation

/// App-wide state. Tries the local API first (`http://localhost:3000/api/v1`,
/// demo bearer token); falls back to `DemoDataProvider` when unreachable so
/// the app always demos.
@MainActor
@Observable
final class AppModel {
    var user: User?
    var results: [BiomarkerReading] = []
    var insights: [Insight] = []
    var orders: [TestOrder] = []
    var wearableSeries: [WearableMetric: [WearableSignal]] = [:]

    var isLoading = false
    /// True when the backend was unreachable and seeded demo data is shown.
    var isDemoMode = false
    /// True once the member accepted the HealthKit prompt (or mock granted).
    var healthAuthorized = false
    /// True when wearable charts come from the seeded mock series.
    var isUsingMockHealthData = false
    var lastOrderError: String?

    @ObservationIgnored private let api = APIClient()
    @ObservationIgnored private let health: HealthDataProviding = HealthProviderFactory.make()

    var latestInsight: Insight? {
        insights.max(by: { $0.createdAt < $1.createdAt })
    }

    var experimentInsight: Insight? {
        insights.first(where: { $0.kind == .experiment })
    }

    var currentOrder: TestOrder? {
        orders.max(by: { $0.orderedAt < $1.orderedAt })
    }

    var readinessScore: Int {
        Readiness.score(
            hrv: wearableSeries[.hrv] ?? [],
            restingHeartRate: wearableSeries[.restingHeartRate] ?? [],
            sleep: wearableSeries[.sleepHours] ?? []
        )
    }

    // MARK: - Loading

    func loadAll() async {
        isLoading = true
        defer { isLoading = false }

        do {
            async let user = api.me()
            async let results = api.results()
            async let insights = api.insights()
            async let orders = api.orders()
            self.user = try await user
            self.results = try await results
            self.insights = try await insights
            self.orders = try await orders
            isDemoMode = false
        } catch {
            // Backend unreachable → seeded demo data so the app always demos.
            user = DemoDataProvider.user()
            results = DemoDataProvider.results()
            insights = DemoDataProvider.insights()
            orders = DemoDataProvider.orders()
            isDemoMode = true
        }

        await loadWearables()
    }

    func requestHealthAccess() async {
        healthAuthorized = await health.requestAuthorization()
        await loadWearables()
    }

    func loadWearables() async {
        var series: [WearableMetric: [WearableSignal]] = [:]
        for metric in WearableMetric.allCases {
            series[metric] = await health.dailySeries(for: metric, days: 30)
        }

        // If HealthKit gave us nothing (denied, or empty simulator store),
        // fall back to the seeded deterministic series.
        let isEmpty = series.values.allSatisfy(\.isEmpty)
        if isEmpty {
            for metric in WearableMetric.allCases {
                series[metric] = DemoDataProvider.wearableSeries(metric: metric, days: 30)
            }
        }
        isUsingMockHealthData = isEmpty || health is MockHealthStore
        wearableSeries = series

        // Best-effort push to the backend; fine if it's down.
        let signals = series.values.flatMap { $0 }
        try? await api.syncWearables(signals)
    }

    // MARK: - Orders

    func orderAddOn(kind: TestOrder.Kind, panel: String) async {
        lastOrderError = nil
        let request = CreateOrderRequest(kind: kind, panel: panel, isAddOn: true)
        do {
            let order = try await api.createOrder(request)
            orders.insert(order, at: 0)
        } catch {
            // Demo fallback: create the order locally so the flow still demos.
            orders.insert(DemoDataProvider.createOrder(request), at: 0)
            isDemoMode = true
        }
    }
}
