import Foundation
import Observation

/// App-wide state. Fetches real data from the API (`/api/v1`) using the
/// signed-in session token. When the DEBUG-only `DemoMode` toggle is ON it
/// falls back to `DemoDataProvider` if the backend is unreachable; with demo
/// OFF (the default) an unreachable/unauthenticated backend leaves the screens
/// empty rather than fabricating data.
///
/// Phase 22: owns the daily-engagement engines (readiness / energy /
/// vitality / behaviour impacts). Engines are pure + deterministic; this
/// model feeds them HealthKit (or mock) series + BiomarkerReadings and writes
/// the `GlanceSnapshot` for widgets after every compute.
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

    // MARK: - Phase 22 engine outputs (recomputed after every load)

    /// Locked-at-wake readiness (ALGORITHM §1). nil until the first compute.
    var readinessResult: ReadinessResult?
    /// Today's energy curve (§2), blood-modulated ceiling.
    var energyDay: EnergyDay?
    /// The monthly slow score (§3). nil when there's nothing honest to show.
    var vitalityScore: VitalityScore?
    /// "Alcohol −11 readiness next day" — own history, n≥3 (§1.5).
    var behaviourImpacts: [BehaviourImpact] = []
    /// Active §1.3 blood penalties (empty when the blood layer is off).
    var penalties: [BiomarkerPenalty] = []
    /// No-bloods / active / stale honesty state for the blood card (§6).
    var bloodLayerState: BloodLayerState = .noBloods
    var workouts: [WorkoutSummary] = []
    var sleepNights: [SleepNight] = []
    var feltCheckins: [FeltCheckin] = []
    /// Cycle phase — non-nil only when cycle-aware baselines are opted in.
    var cyclePhase: CyclePhase?

    /// The "blood layer ON/OFF" toggle (readiness screen) — a real
    /// transparency feature AND the MDR fallback flag (ALGORITHM §5).
    /// Persisted; OFF routes zero penalties into every engine.
    var bloodLayerEnabled: Bool {
        get {
            access(keyPath: \.bloodLayerEnabled)
            return UserDefaults.standard.object(forKey: Self.bloodLayerKey) as? Bool ?? true
        }
        set {
            withMutation(keyPath: \.bloodLayerEnabled) {
                UserDefaults.standard.set(newValue, forKey: Self.bloodLayerKey)
            }
            recomputeEngines()
        }
    }

    static let bloodLayerKey = "arcaevo.bloodLayerEnabled"
    private static let checkinsKey = "arcaevo.feltCheckins.v1"

    @ObservationIgnored private let api = APIClient()
    @ObservationIgnored private let health: HealthDataProviding = HealthProviderFactory.make()

    init() {
        feltCheckins = Self.loadCheckins()
    }

    var latestInsight: Insight? {
        insights.max(by: { $0.createdAt < $1.createdAt })
    }

    var experimentInsight: Insight? {
        insights.first(where: { $0.kind == .experiment })
    }

    var currentOrder: TestOrder? {
        orders.max(by: { $0.orderedAt < $1.orderedAt })
    }

    /// Legacy score used by the v1 dashboard ring — now backed by the real
    /// readiness engine, falling back to the old arithmetic pre-compute.
    var readinessScore: Int {
        readinessResult?.final ?? Readiness.score(
            hrv: wearableSeries[.hrv] ?? [],
            restingHeartRate: wearableSeries[.restingHeartRate] ?? [],
            sleep: wearableSeries[.sleepHours] ?? []
        )
    }

    /// Today's clinician note, when the latest reviewed panel carries one.
    var clinicianNote: ClinicianNote? {
        results.compactMap(\.clinicianNote).first
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

    /// The SEPARATE cycle ask (§3.1 / §7) — fired only from the Data &
    /// privacy cycle-aware toggle, never from the main HealthKit primer.
    @discardableResult
    func requestCycleAccess() async -> Bool {
        let granted = await health.requestCycleAccess()
        if granted {
            cyclePhase = CyclePreferences.isEnabled ? await health.cyclePhase(now: Date()) : nil
            recomputeEngines()
        }
        return granted
    }

    func loadWearables() async {
        // 60 days: the readiness baseline window (ALGORITHM §1.2).
        var series: [WearableMetric: [WearableSignal]] = [:]
        for metric in WearableMetric.allCases {
            series[metric] = await health.dailySeries(for: metric, days: 60)
        }

        // If HealthKit gave us nothing (denied, or empty simulator store),
        // fall back to the seeded deterministic series.
        let isEmpty = series.values.allSatisfy(\.isEmpty)
        if isEmpty && DemoMode.isEnabled {
            // DEBUG/simulator: seed a deterministic series so charts demo.
            for metric in WearableMetric.allCases {
                series[metric] = DemoDataProvider.wearableSeries(metric: metric, days: 60)
            }
        }
        isUsingMockHealthData = (health is MockHealthStore) || (isEmpty && DemoMode.isEnabled)
        wearableSeries = series

        workouts = await health.workouts(days: 14)
        sleepNights = await health.sleepNights(days: 30)
        if workouts.isEmpty && sleepNights.isEmpty && isUsingMockHealthData && DemoMode.isEnabled {
            workouts = DemoDataProvider.workouts()
            sleepNights = DemoDataProvider.sleepNights()
        }
        cyclePhase = CyclePreferences.isEnabled ? await health.cyclePhase(now: Date()) : nil

        recomputeEngines()

        // Best-effort push to the backend; fine if it's down. Only the four
        // v1 metrics ride the sync contract — new metrics stay on-device.
        let signals = WearableMetric.backendSynced.flatMap { series[$0] ?? [] }
        try? await api.syncWearables(signals)
    }

    // MARK: - Engines (pure, deterministic — recompute + snapshot)

    func recomputeEngines(now: Date = Date()) {
        let demo = isDemoMode || (isUsingMockHealthData && DemoMode.isEnabled)
        let calendar = Calendar.current

        // Blood inputs. Demo mode tells the design's recalibration story
        // (ferritin 29 → 71 becomes 62); real mode derives from live results.
        let engineReadings: [BiomarkerReading] = {
            if !results.isEmpty { return results }
            return demo ? DemoDataProvider.recalibrationReadings() : []
        }()
        bloodLayerState = BloodLayerState.from(readings: engineReadings, now: now)
        penalties = bloodLayerEnabled ? BiomarkerPenalty.derive(from: engineReadings, now: now) : []

        // Wearable inputs: crafted demo series reproduce the design numbers;
        // real series come straight from HealthKit.
        let hrvPoints: [DailyPoint]
        let rhrPoints: [DailyPoint]
        if demo {
            hrvPoints = DemoDataProvider.readinessDailyPoints(metric: .hrv)
            rhrPoints = DemoDataProvider.readinessDailyPoints(metric: .restingHeartRate)
        } else {
            hrvPoints = (wearableSeries[.hrv] ?? []).dailyPoints
            rhrPoints = (wearableSeries[.restingHeartRate] ?? []).dailyPoints
        }
        let vitals = demo ? DemoDataProvider.vitalsSnapshot() : VitalsSnapshot(
            respiratoryRate: (wearableSeries[.respiratoryRate] ?? []).dailyPoints,
            spo2: (wearableSeries[.spo2] ?? []).dailyPoints,
            wristTemp: (wearableSeries[.wristTemp] ?? []).dailyPoints
        )

        let todayCheckin = feltCheckins.last(where: { calendar.isDate($0.date, inSameDayAs: now) })

        // Readiness — locked at wake; recomputes only when inputs change.
        readinessResult = ReadinessEngine.compute(
            hrv: hrvPoints,
            rhr: rhrPoints,
            vitals: vitals,
            penalties: penalties,
            felt: todayCheckin,
            cyclePhase: cyclePhase,
            calendar: calendar,
            now: now
        )

        // Energy — blood-modulated ceiling, overnight-recharge start, dip.
        let wakeHour = WakeTimeModel.learn(
            sleepEnds: demo ? DemoDataProvider.sleepEnds() : [],
            calendar: calendar
        )?.hour ?? 7
        let inputs: EnergyInputs
        if demo {
            inputs = DemoDataProvider.energyInputs()
        } else {
            inputs = EnergyInputs(
                sleepLastNight: sleepNights.last(where: { calendar.isDate($0.date, inSameDayAs: now) }),
                wakeHour: wakeHour,
                workoutsToday: workouts.filter { calendar.isDate($0.date, inSameDayAs: now) },
                learnedDipHour: nil
            )
        }
        energyDay = EnergyEngine.day(samples: inputs, penalties: penalties, now: now, calendar: calendar)

        // Vitality — monthly, RCV-gated; honest nil when there's no anchor.
        if demo {
            vitalityScore = DemoDataProvider.vitalityScore()
        } else if !engineReadings.isEmpty {
            let month = calendar.date(from: calendar.dateComponents([.year, .month], from: now)) ?? now
            vitalityScore = VitalityEngine.compute(
                readings: engineReadings,
                rules: BiomarkerRuleLite.defaults,
                wearables: WearableTrends(
                    vo2max: (wearableSeries[.vo2max] ?? []).dailyPoints,
                    rhr: rhrPoints
                ),
                calendarAge: calendarAge(at: now, calendar: calendar),
                month: month
            )
        } else {
            vitalityScore = nil
        }

        // Behaviour impacts — own history only, n≥3.
        let checkins = demo && feltCheckins.isEmpty ? DemoDataProvider.feltCheckins() : feltCheckins
        let scores: [DatedScore] = demo
            ? DemoDataProvider.behaviourDatedScores()
            : ReadinessEngine.dailyScores(hrv: hrvPoints, rhr: rhrPoints, calendar: calendar, days: 30, now: now)
        behaviourImpacts = BehaviourImpactModel.compute(checkins: checkins, scores: scores, calendar: calendar)
        if demo && feltCheckins.isEmpty {
            feltCheckins = checkins
        }

        writeGlanceSnapshot(now: now)
    }

    /// Widget/complication hook — written after EVERY readiness/energy
    /// compute (the extension targets read it; Wave 2c ships them).
    private func writeGlanceSnapshot(now: Date) {
        SnapshotStore.write(GlanceSnapshot(
            readiness: readinessResult,
            energy: energyDay,
            nextTestDays: nextTestDays(now: now),
            now: now
        ))
    }

    /// Days to the next expected draw (the T−12 complication). Demo mirrors
    /// the design; real members get it once a scheduled draw exists.
    private func nextTestDays(now: Date) -> Int? {
        if isDemoMode || (isUsingMockHealthData && DemoMode.isEnabled) { return 12 }
        return nil
    }

    private func calendarAge(at now: Date, calendar: Calendar) -> Int {
        // AboutYou stores the DOB (design persona default 14/03/1991).
        let timestamp = UserDefaults.standard.double(forKey: "arcaevo.aboutYou.dob")
        let dob: Date
        if timestamp > 0 {
            dob = Date(timeIntervalSince1970: timestamp)
        } else {
            dob = calendar.date(from: DateComponents(year: 1991, month: 3, day: 14)) ?? now
        }
        return max(18, calendar.dateComponents([.year], from: dob, to: now).year ?? 34)
    }

    // MARK: - Felt check-in (§1.5 — saved locally, feeds the engines)

    /// Saves today's felt check-in (replacing any earlier one for the same
    /// day) and recomputes — "Feeling ill" flips sick mode immediately.
    func saveCheckin(_ checkin: FeltCheckin) {
        let calendar = Calendar.current
        feltCheckins.removeAll { calendar.isDate($0.date, inSameDayAs: checkin.date) }
        feltCheckins.append(checkin)
        feltCheckins.sort { $0.date < $1.date }
        Self.persistCheckins(feltCheckins)
        recomputeEngines()
    }

    private static func loadCheckins() -> [FeltCheckin] {
        guard let data = UserDefaults.standard.data(forKey: checkinsKey) else { return [] }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return (try? decoder.decode([FeltCheckin].self, from: data)) ?? []
    }

    private static func persistCheckins(_ checkins: [FeltCheckin]) {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        if let data = try? encoder.encode(checkins) {
            UserDefaults.standard.set(data, forKey: checkinsKey)
        }
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

    /// The €69 recheck — the ONLY sell. Maps onto the existing add-on path.
    func orderRecheck(_ recheck: RecheckOrder, markerName: String) async {
        lastOrderError = nil
        let request = recheck.asCreateOrderRequest(markerName: markerName)
        do {
            let order = try await api.createOrder(request)
            orders.insert(order, at: 0)
        } catch {
            if DemoMode.isEnabled {
                orders.insert(DemoDataProvider.createOrder(request), at: 0)
                isDemoMode = true
            } else {
                lastOrderError = "We couldn't place that order. Please try again."
            }
        }
    }
}
