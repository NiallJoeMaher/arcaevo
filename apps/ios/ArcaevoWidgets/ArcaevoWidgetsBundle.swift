import WidgetKit
import SwiftUI

// MARK: - Arcaevo iOS widget bundle (Lock Screen + Home Screen)
//
// Every surface reads the App-Group `GlanceSnapshot` the app writes after each
// readiness/energy compute — the sub-10-second glance rule, zero taps. Degraded
// states render honestly (calibration ring, "—" for a sparse night), never a
// fabricated score (§6).
//
// Shipped kinds:
//   • Readiness — accessoryCircular / accessoryRectangular / accessoryInline
//                 (Lock Screen) + systemSmall (Home Screen)
//   • Energy    — accessoryCircular gauge / accessoryRectangular / inline
//   • Next test — accessoryCircular / accessoryRectangular / inline (T−N)
//   • Today     — systemMedium Home Screen (readiness + energy + next test)
//
// NOTE — "HRV/RHR mini" (from the widgets design): the shared GlanceSnapshot
// (owned by Wave 1a) carries only readiness/energy/decision/nextTestDays, not
// raw HRV/RHR series, so a truthful HRV/RHR mini-chart can't be drawn here yet.
// Rather than fabricate a series, the raw-vitals mini is deferred until the
// snapshot schema grows an `hrv`/`rhr` recent-series field (a 1a change). The
// Readiness rectangular already carries the same morning read a member needs.
//
// LIVE ACTIVITIES / ActivityKit: NOT in this pass — see the watch `wworkout`
// screen for the in-app workout-ceiling surface and the TODO there. The
// static/timeline widgets above ship now; the workout Live Activity is a
// documented follow-up.

@main
struct ArcaevoWidgetsBundle: WidgetBundle {
    var body: some Widget {
        ReadinessWidget()
        EnergyWidget()
        NextTestWidget()
        TodayWidget()
    }
}
