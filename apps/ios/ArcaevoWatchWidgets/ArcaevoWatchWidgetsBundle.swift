import WidgetKit
import SwiftUI

// MARK: - Arcaevo watch accessory complication bundle
//
// The real WidgetKit complication Phase 17 deferred (it needed this extension
// target). Reads the watch's App-Group `GlanceSnapshot` the watch app writes
// after each compute. Families span circular / corner / rectangular / inline so
// the member can put readiness, energy or the next-test countdown on ANY face —
// the gap Apple leaves (no shipped readiness / Body-Battery score).
//
// Smart Stack: WatchGlanceProvider elevates morning-readiness relevance at the
// wake window so it rises to the top of the stack, then recedes (§4).
//
// Degraded states render honestly (calibration ring, "—" for a sparse night),
// amber at worst — never a red number on the wrist.

@main
struct ArcaevoWatchWidgetsBundle: WidgetBundle {
    var body: some Widget {
        WatchReadinessComplication()
        WatchEnergyComplication()
        WatchNextTestComplication()
    }
}
