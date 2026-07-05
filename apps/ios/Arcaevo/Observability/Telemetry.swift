import Foundation
#if canImport(Sentry)
import Sentry
#endif

// MARK: - Privacy-first crash + error observability (Sentry, DSN-gated)
//
// Arcaevo is a health app: telemetry is crashes + non-PII errors + performance
// ONLY. We never send a HealthKit value, a biomarker, or a member's identity.
//
// Sentry stays completely OFF unless a `SENTRY_DSN` is configured via the
// per-config Info.plist key (same pattern as `ARCAEVO_API_BASE_URL`). Empty or
// unset ⇒ `start()` returns before touching the SDK, so a build with no DSN —
// or even no Sentry package — runs identically and never crashes.
//
// The whole SDK surface is behind `#if canImport(Sentry)` so the app still
// compiles if the Swift Package can't be resolved.

enum Telemetry {

    /// Initialise Sentry at launch — only when a DSN is present. Call as early
    /// as possible (from `ArcaevoApp.init`) so launch crashes are captured.
    static func start() {
        #if canImport(Sentry)
        guard let dsn = configuredDSN() else { return } // no DSN → stays OFF
        SentrySDK.start { options in
            options.dsn = dsn
            options.environment = environment
            options.releaseName = releaseName

            // PRIVACY: never attach IP address, device identifiers, or a user.
            options.sendDefaultPii = false
            options.enableCaptureFailedRequests = false // URLs can carry tokens

            // Crashes + errors + a light performance sample. No PII in either.
            options.attachStacktrace = true
            options.tracesSampleRate = 0.1

            // Belt-and-braces scrubbing on every event AND breadcrumb, on top of
            // Sentry's own default data scrubbers (which we keep enabled).
            options.beforeSend = { event in Telemetry.scrub(event) }
            options.beforeBreadcrumb = { crumb in Telemetry.scrub(crumb) }
        }
        #endif
    }

    /// Reads `SENTRY_DSN` from the Info.plist (per-config build setting). Returns
    /// nil when absent or empty so Sentry never initialises.
    static func configuredDSN() -> String? {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "SENTRY_DSN") as? String else { return nil }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    static var environment: String {
        #if DEBUG
        return "debug"
        #else
        return "release"
        #endif
    }

    static var releaseName: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "0"
        return "arcaevo-ios@\(version)+\(build)"
    }

    #if canImport(Sentry)
    /// Strip anything that could carry PII or a health value before an event
    /// leaves the device. We never intentionally attach either — this is the
    /// safety net for auto-captured context.
    static func scrub(_ event: Event) -> Event? {
        event.user = nil        // no member identity, ever
        event.serverName = nil  // no device host name
        event.extra = nil       // drop any ad-hoc extras
        event.request = nil     // drop request bodies/URLs (could carry a token)
        return event
    }

    /// Scrub breadcrumbs: drop attached data (URLs, params) and redact any
    /// message that looks like it carries an email address.
    static func scrub(_ crumb: Breadcrumb) -> Breadcrumb? {
        crumb.data = nil
        if let message = crumb.message, message.contains("@") {
            crumb.message = "[redacted]"
        }
        return crumb
    }
    #endif
}
