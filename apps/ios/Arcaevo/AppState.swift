import Foundation
import Observation

// MARK: - v3 app state machine (Prototype.dc.html logic class = the spec)
//
// Phases:  onboarding(welcome → signup → verify → consent → healthkit →
//          aboutYou → notifications)  →  freeTier | member(plan)
// Plus:    eircode gate state, notification prefs (4 toggles, Face ID ON
//          by default), experiment state, upload-confirm state (low
//          confidence blocks), watch quick-log lives on the watch side.
// Lightweight persistence in UserDefaults so relaunch resumes mid-flow.

/// The 7 onboarding screens, in prototype order.
enum OnboardingStep: String, Codable, CaseIterable {
    case welcome, signup, verify, consent, healthkit, aboutYou, notifications

    var next: OnboardingStep? {
        let all = Self.allCases
        guard let i = all.firstIndex(of: self), i + 1 < all.count else { return nil }
        return all[i + 1]
    }
}

enum AppPhase: Codable, Equatable {
    case onboarding(OnboardingStep)
    case freeTier
    case member(Membership.Tier)

    var isMember: Bool {
        if case .member = self { return true }
        return false
    }
}

/// Member tab bar (Today / Results / Experiments / Account).
enum MainTab: String, Codable, CaseIterable {
    case today, results, experiments, account

    var title: String {
        switch self {
        case .today: return "Today"
        case .results: return "Results"
        case .experiments: return "Experiments"
        case .account: return "Account"
        }
    }

    /// Prototype tab-bar glyphs (Today ☉ · Results ▤ · Experiments ⟳;
    /// Account isn't in the 5-tab prototype bar — ◎ matches its glyph set).
    var glyph: String {
        switch self {
        case .today: return "☉"
        case .results: return "▤"
        case .experiments: return "⟳"
        case .account: return "◎"
        }
    }
}

/// The four notification toggles (prototype `notifs`); Face ID lock is ON
/// by default — "It's health data — on by default".
struct NotificationPrefs: Codable, Equatable {
    var results = true      // "Results & clinician notes"
    var reminders = true    // "Test & fasting reminders"
    var weeklyFocus = false // "Weekly focus" — one nudge a week, never streaks
    var faceIDLock = true   // "Lock app with Face ID"
}

/// Eircode gate (prototype `code`: null / dublin / cork).
enum EircodeGateState: Codable, Equatable {
    case unchecked
    case pass(routingKey: String, county: String?)
    case fail(routingKey: String, county: String?)
}

/// A running "did it work?" experiment (prototype `expSel` + `expStarted`).
struct ActiveExperiment: Codable, Equatable {
    var what: String            // e.g. "Iron-rich breakfasts"
    var duration: String        // "2 weeks" | "4 weeks" | "6 weeks"
    var watchedMarker: String   // e.g. "Ferritin"
    var startedAt: Date
    var daysLogged: Int = 0     // adherence check-ins (phone + watch quick-log)
    var verdict: RCVVerdict?    // nil until the follow-up test decides
}

/// The confirm-reading screen's state: every AI-extracted value must be
/// confirmed; low-confidence reads BLOCK until resolved ("41 or 47?").
struct UploadConfirmState: Codable, Equatable {
    struct PendingValue: Codable, Equatable, Identifiable {
        var code: String
        var name: String
        var unit: String
        var extractedValue: Double
        var lowConfidence: Bool
        var alternatives: [Double]?
        /// The user's answer for a low-confidence read (nil = unresolved).
        var resolvedValue: Double?

        var id: String { code }
        var confirmedValue: Double { resolvedValue ?? extractedValue }
    }

    var uploadId: String
    var sourceName: String
    var documentDate: String // YYYY-MM-DD
    var values: [PendingValue]

    /// True while any low-confidence value is unresolved — confirm is blocked.
    var isBlocked: Bool {
        values.contains { $0.lowConfidence && $0.resolvedValue == nil }
    }

    init(extraction: BloodworkExtraction) {
        uploadId = extraction.uploadId
        sourceName = extraction.sourceName
        documentDate = extraction.documentDate
        values = extraction.values.map {
            PendingValue(
                code: $0.code,
                name: $0.name,
                unit: $0.unit,
                extractedValue: $0.value,
                lowConfidence: $0.lowConfidence,
                alternatives: $0.alternatives,
                resolvedValue: nil
            )
        }
    }
}

// MARK: - AppState

/// v3 state machine + routing. Owns auth/session, onboarding progress,
/// plan, gate state, prefs, experiment and upload-confirm state.
/// `AppModel` (data loading: results/insights/orders/wearables) stays as-is
/// and is consumed by the tab screens.
@MainActor
@Observable
final class AppState {
    // MARK: Routing state

    var phase: AppPhase = .onboarding(.welcome) { didSet { save() } }
    var selectedTab: MainTab = .today

    // MARK: Auth

    /// Email captured on the signup screen (used for verify + waitlist).
    var signupEmail: String = "" { didSet { save() } }
    /// True when the session came from the demo fallback, not a real verify.
    var isDemoSession = false
    /// Signed-in member's display name (from magic-link verify). Used to seed
    /// the watch handoff context; cleared on sign-out.
    var memberName: String?
    var authBusy = false
    var authError: String?
    /// The 202 copy from POST /auth/magic-link, shown on the verify screen.
    var magicLinkMessage: String?

    // MARK: Prototype-spec state

    var plan: Membership.Tier? { didSet { save() } }
    var eircodeGate: EircodeGateState = .unchecked { didSet { save() } }
    var notificationPrefs = NotificationPrefs() { didSet { save() } }
    var researchConsent = false { didSet { save() } }
    /// First-run activation: true once the member has opened their readiness
    /// surface at least once. Persisted — drives the one-time "unlock your first
    /// reading" nudge (scheduled while false, cancelled on view).
    var hasViewedFirstScore = false { didSet { save() } }
    /// Re-engagement bookkeeping (drives `EngagementNudge`). `lastOpenedAt`
    /// resets the escalating inactive-member series; `lastCheckInDay` (start of
    /// day) tells the daily reminder "already seen today → nudge tomorrow, not
    /// now". Both persisted so the schedule survives relaunch.
    var lastOpenedAt: Date? { didSet { save() } }
    var lastCheckInDay: Date? { didSet { save() } }
    var experiment: ActiveExperiment? { didSet { save() } }
    var uploadConfirm: UploadConfirmState? { didSet { save() } }
    var waitlistPosition: Int?
    var waitlistCounty: String?

    @ObservationIgnored let api = APIClient()

    /// Shown when the backend is unreachable in a Release build (no demo
    /// fallback exists there).
    static let offlineMessage = "We couldn't reach Arcaevo. Check your connection and try again."

    init() {
        restore()
        // Let the watch-connectivity manager read the current member name when
        // it needs to (re)push the golden-watch-login token on activation or
        // reachability changes.
        PhoneWatchConnectivity.shared.currentMemberName = { [weak self] in self?.memberName }
    }

    // MARK: - Onboarding flow

    func advanceOnboarding() {
        guard case .onboarding(let step) = phase else { return }
        if let next = step.next {
            phase = .onboarding(next)
        } else {
            completeOnboarding()
        }
    }

    /// Onboarding done → free tier, unless a plan is already active.
    func completeOnboarding() {
        phase = plan.map(AppPhase.member) ?? .freeTier
    }

    // MARK: - First-run activation

    /// Marks the readiness surface as viewed and cancels the one-time
    /// activation nudge. Idempotent — safe to call from every score-surface
    /// appearance.
    func markFirstScoreViewed() {
        guard !hasViewedFirstScore else { return }
        hasViewedFirstScore = true
        FirstReadingNudge.cancel()
    }

    // MARK: - Re-engagement bookkeeping

    /// Record an app open — resets the escalating inactive-member series and
    /// counts as a check-in for today. Called on launch + foreground; the caller
    /// reschedules `EngagementNudge` afterwards.
    func markAppOpened(now: Date = Date()) {
        lastOpenedAt = now
        lastCheckInDay = Calendar.current.startOfDay(for: now)
    }

    /// Record a check-in on a score / check-in surface — the daily reminder
    /// then slides to tomorrow. State only; the schedule is (re)computed on the
    /// next open/foreground (opening already counts as a check-in).
    func markCheckedInToday(now: Date = Date()) {
        lastCheckInDay = Calendar.current.startOfDay(for: now)
    }

    // MARK: - Auth (email + magic link ONLY)

    func requestMagicLink() async {
        authBusy = true
        authError = nil
        defer { authBusy = false }
        do {
            let response = try await api.requestMagicLink(email: signupEmail, purpose: "verify")
            magicLinkMessage = response.message
        } catch let APIClient.APIError.server(_, _, message) {
            // Throttled (60s) etc — show the backend's copy verbatim.
            magicLinkMessage = message
        } catch {
            guard DemoMode.isEnabled else {
                // Release: no demo fallback — surface the failure, stay put.
                authError = Self.offlineMessage
                return
            }
            // DEBUG: backend unreachable → demo mode keeps the flow walkable.
            magicLinkMessage = DemoDataProvider.magicLinkRequested(email: signupEmail).message
            isDemoSession = true
        }
        if case .onboarding(.signup) = phase { phase = .onboarding(.verify) }
    }

    /// Redeems a magic-link token — from the universal link or the arcaevo://
    /// scheme.
    func verifyMagicLink(token: String) async {
        authBusy = true
        authError = nil
        defer { authBusy = false }

        let session: Session
        do {
            session = try await api.verifyMagicLink(token: token)
            isDemoSession = false
        } catch let APIClient.APIError.server(_, _, message) {
            authError = message ?? "That link isn't valid."
            return
        } catch {
            guard DemoMode.isEnabled else {
                // Release: never mint a demo session — route back to sign-in.
                authError = Self.offlineMessage
                return
            }
            // DEBUG: backend unreachable → demo session so the flow still demos.
            session = DemoDataProvider.session()
            isDemoSession = true
        }
        applyVerifiedSession(session)
    }

    /// Redeems the prefetch-safe CODE the human typed on the verify screen —
    /// for when a security appliance ate their universal link before they could
    /// tap it. Uses the email captured at signup to scope the short code.
    func verifyMagicLinkCode(code: String) async {
        authBusy = true
        authError = nil
        defer { authBusy = false }

        let session: Session
        do {
            session = try await api.verifyMagicLinkCode(email: signupEmail, code: code)
            isDemoSession = false
        } catch let APIClient.APIError.server(_, _, message) {
            authError = message ?? "That code isn't valid."
            return
        } catch {
            guard DemoMode.isEnabled else {
                authError = Self.offlineMessage
                return
            }
            session = DemoDataProvider.session()
            isDemoSession = true
        }
        applyVerifiedSession(session)
    }

    /// Shared post-verify handling for both the link and code paths: store the
    /// session, seed the watch handoff, and route onward.
    private func applyVerifiedSession(_ session: Session) {
        SessionStore.store(session.sessionToken)
        memberName = session.member.name
        // Golden watch login: now that the phone is authenticated, mint a
        // device-scoped watch token and hand it to the watch. The watch signs
        // in silently — no login field ever appears on the wrist.
        PhoneWatchConnectivity.shared.syncWatchSession(memberName: session.member.name)
        if case .onboarding = phase {
            phase = .onboarding(session.needsConsent ? .consent : .healthkit)
        }
    }

    #if DEBUG
    /// DEBUG-only: flip the runtime demo flag and re-resolve app state cleanly.
    ///
    /// Turning demo OFF while in a demo session drops to the real
    /// unauthenticated state (onboarding) — the demo session/token is cleared
    /// so no fabricated data leaks into a real session. Turning it ON resets to
    /// the same clean slate so no stale real data lingers before the demo flow.
    /// Callers reload `AppModel` afterwards so the tab screens re-fetch.
    func setDemoMode(_ enabled: Bool) {
        guard enabled != DemoMode.isEnabled else { return }
        DemoMode.isEnabled = enabled
        // Clear any existing session (demo or real) and return to the top of
        // onboarding so demo and real data can never mix.
        signOut()
    }
    #endif

    func signOut() {
        // Revoke + clear the watch token first so the wrist logs out too.
        PhoneWatchConnectivity.shared.signOutWatch()
        SessionStore.clear()
        memberName = nil
        isDemoSession = false
        plan = nil
        phase = .onboarding(.welcome)
        eircodeGate = .unchecked
        experiment = nil
        uploadConfirm = nil
    }

    // MARK: - Universal link / URL scheme entry
    //
    // Handles:  https://arcaevo.com/verify?token=…   (universal link — needs
    //           the associated-domains entitlement, commented in project.yml)
    //           arcaevo://verify?token=…             (custom-scheme fallback)

    func handleIncomingURL(_ url: URL) {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return }
        let isVerifyPath = components.path.hasSuffix("verify") || components.host == "verify"
        guard isVerifyPath,
              let token = components.queryItems?.first(where: { $0.name == "token" })?.value,
              !token.isEmpty
        else { return }
        Task { await verifyMagicLink(token: token) }
    }

    // MARK: - Consent (GDPR Art. 9 — 3 purposes, research OFF by default)

    func submitConsents() async {
        let grants = [
            ConsentGrant(purpose: .healthProcessing, granted: true),
            ConsentGrant(purpose: .clinicianReview, granted: true),
            ConsentGrant(purpose: .research, granted: researchConsent),
        ]
        do {
            _ = try await api.postConsents(grants, surface: "ios")
        } catch {
            // Offline/demo (DEBUG): consent choice is kept locally; the screen
            // never blocks the flow on a network failure. In Release the grant
            // simply isn't recorded server-side yet (retried on next launch);
            // no fabricated state is introduced.
            if DemoMode.isEnabled { isDemoSession = true }
        }
        if case .onboarding(.consent) = phase { phase = .onboarding(.healthkit) }
    }

    // MARK: - Eircode gate + waitlist

    func checkEircode(_ eircode: String) async {
        let result: EligibilityResult
        do {
            result = try await api.checkEligibility(eircode: eircode)
        } catch let APIClient.APIError.server(status, _, message) where status == 422 {
            authError = message
            return
        } catch {
            guard DemoMode.isEnabled else {
                authError = Self.offlineMessage
                return
            }
            result = DemoDataProvider.eligibility(eircode: eircode)
            isDemoSession = true
        }
        let key = result.routingKey ?? String(eircode.prefix(3)).uppercased()
        eircodeGate = result.eligible
            ? .pass(routingKey: key, county: result.county)
            : .fail(routingKey: key, county: result.county)
    }

    func joinWaitlist(eircode: String) async {
        do {
            let joined = try await api.joinWaitlist(email: signupEmail, eircode: eircode)
            waitlistPosition = joined.position
            waitlistCounty = joined.county
        } catch {
            guard DemoMode.isEnabled else {
                authError = Self.offlineMessage
                return
            }
            let demo = DemoDataProvider.waitlistJoined(eircode: eircode)
            waitlistPosition = demo.position
            waitlistCounty = demo.county
            isDemoSession = true
        }
    }

    // MARK: - Checkout (ALWAYS a web link-out — no IAP)

    func checkoutURL(for tier: Membership.Tier) -> URL {
        api.checkoutURL(tier: tier)
    }

    /// Called when the member returns from web checkout (or via the demo
    /// affordance): the plan drives the success screen's "step 1" card.
    func activateMembership(_ tier: Membership.Tier) {
        plan = tier
        phase = .member(tier)
    }

    // MARK: - Experiments (what / duration / watched marker → adherence → verdict)

    func startExperiment(what: String, duration: String, watchedMarker: String) {
        experiment = ActiveExperiment(
            what: what,
            duration: duration,
            watchedMarker: watchedMarker,
            startedAt: Date()
        )
    }

    func logExperimentDay() {
        experiment?.daysLogged += 1
    }

    func concludeExperiment(verdict: RCVVerdict) {
        experiment?.verdict = verdict
    }

    // MARK: - Upload → confirm (low confidence blocks)

    func beginUpload(kind: BloodworkUploadKind, fileName: String?) async {
        let extraction: BloodworkExtraction
        do {
            extraction = try await api.uploadBloodwork(kind: kind, fileName: fileName)
        } catch {
            guard DemoMode.isEnabled else {
                authError = Self.offlineMessage
                return
            }
            extraction = DemoDataProvider.bloodworkExtraction(fileName: fileName)
            isDemoSession = true
        }
        uploadConfirm = UploadConfirmState(extraction: extraction)
    }

    func resolveUploadValue(code: String, value: Double) {
        guard var state = uploadConfirm,
              let index = state.values.firstIndex(where: { $0.code == code })
        else { return }
        state.values[index].resolvedValue = value
        uploadConfirm = state
    }

    /// Blocked while any low-confidence read is unresolved — mirrors the
    /// backend's 422 `unresolved_low_confidence`.
    func confirmUpload() async -> Bool {
        guard let state = uploadConfirm, !state.isBlocked else { return false }
        let values = state.values.map {
            ConfirmedBloodworkValue(code: $0.code, value: $0.confirmedValue)
        }
        do {
            _ = try await api.confirmBloodwork(
                uploadId: state.uploadId,
                values: values,
                takenAt: state.documentDate
            )
        } catch {
            // DEBUG demo: treat as written locally. Release: not persisted
            // server-side, but no fabricated state is introduced.
            if DemoMode.isEnabled { isDemoSession = true }
        }
        uploadConfirm = nil
        return true
    }

    // MARK: - Persistence (lightweight — UserDefaults, resume on relaunch)

    // NOTE: `uploadConfirm` is deliberately NOT persisted. It holds raw,
    // AI-extracted biomarker values (health data) mid-confirmation; keeping
    // it in-memory only means no raw health values are ever written to
    // UserDefaults (which is unencrypted and can land in device backups).
    // On relaunch the user simply re-opens the upload flow.
    private struct Persisted: Codable {
        var phase: AppPhase
        var signupEmail: String
        var plan: Membership.Tier?
        var eircodeGate: EircodeGateState
        var notificationPrefs: NotificationPrefs
        var researchConsent: Bool
        var hasViewedFirstScore: Bool?
        var lastOpenedAt: Date?
        var lastCheckInDay: Date?
        var experiment: ActiveExperiment?
    }

    private static let defaultsKey = "arcaevo.appState.v3"
    @ObservationIgnored private var restoring = false

    private func save() {
        guard !restoring else { return }
        let snapshot = Persisted(
            phase: phase,
            signupEmail: signupEmail,
            plan: plan,
            eircodeGate: eircodeGate,
            notificationPrefs: notificationPrefs,
            researchConsent: researchConsent,
            hasViewedFirstScore: hasViewedFirstScore,
            lastOpenedAt: lastOpenedAt,
            lastCheckInDay: lastCheckInDay,
            experiment: experiment
        )
        if let data = try? JSONEncoder().encode(snapshot) {
            UserDefaults.standard.set(data, forKey: Self.defaultsKey)
        }
    }

    private func restore() {
        guard let data = UserDefaults.standard.data(forKey: Self.defaultsKey),
              let snapshot = try? JSONDecoder().decode(Persisted.self, from: data)
        else { return }
        restoring = true
        phase = snapshot.phase
        signupEmail = snapshot.signupEmail
        plan = snapshot.plan
        eircodeGate = snapshot.eircodeGate
        notificationPrefs = snapshot.notificationPrefs
        researchConsent = snapshot.researchConsent
        hasViewedFirstScore = snapshot.hasViewedFirstScore ?? false
        lastOpenedAt = snapshot.lastOpenedAt
        lastCheckInDay = snapshot.lastCheckInDay
        experiment = snapshot.experiment
        restoring = false
    }
}
