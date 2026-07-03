import Foundation
import Observation

/// App-wide state. Fetches real data from the API (`/api/v1`) using the
/// signed-in session token. When the DEBUG-only `DemoMode` toggle is ON it
/// falls back to `DemoDataProvider` if the backend is unreachable; with demo
/// OFF (the default) an unreachable/unauthenticated backend leaves the screens
/// empty rather than fabricating data.
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
            if DemoMode.isEnabled {
                // DEBUG: backend unreachable → seeded demo data so it demos.
                user = DemoDataProvider.user()
                results = DemoDataProvider.results()
                insights = DemoDataProvider.insights()
                orders = DemoDataProvider.orders()
                isDemoMode = true
            } else {
                // Release: never show a fabricated member's data. Leave empty;
                // the tab screens render their empty states.
                user = nil
                results = []
                insights = []
                orders = []
                isDemoMode = false
            }
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
        if isEmpty && DemoMode.isEnabled {
            // DEBUG/simulator: seed a deterministic series so charts demo.
            for metric in WearableMetric.allCases {
                series[metric] = DemoDataProvider.wearableSeries(metric: metric, days: 30)
            }
        }
        isUsingMockHealthData = (health is MockHealthStore) || (isEmpty && DemoMode.isEnabled)
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
            if DemoMode.isEnabled {
                // DEBUG: create the order locally so the flow still demos.
                orders.insert(DemoDataProvider.createOrder(request), at: 0)
                isDemoMode = true
            } else {
                lastOrderError = "We couldn't place that order. Please try again."
            }
        }
    }
}
