import WidgetKit
import SwiftUI

// MARK: - Shared timeline provider (reads the App-Group snapshot)
//
// One provider backs every Arcaevo widget kind. The app refreshes the
// snapshot after each compute and calls WidgetCenter.reloadAllTimelines; we
// also self-refresh hourly so a stale glance never lingers past the day.

struct GlanceEntry: TimelineEntry {
    let date: Date
    let glance: GlanceDTO
    var relevance: TimelineEntryRelevance?
}

struct GlanceProvider: TimelineProvider {
    func placeholder(in context: Context) -> GlanceEntry {
        GlanceEntry(date: Date(), glance: GlanceReader.placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (GlanceEntry) -> Void) {
        let glance = context.isPreview ? GlanceReader.placeholder : (GlanceReader.read() ?? GlanceReader.placeholder)
        completion(GlanceEntry(date: Date(), glance: glance))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<GlanceEntry>) -> Void) {
        let glance = GlanceReader.read() ?? GlanceReader.placeholder
        let entry = GlanceEntry(date: Date(), glance: glance)
        // Refresh at the next hour boundary — the app also nudges us after each
        // compute via WidgetCenter, this is just the safety net.
        let next = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date().addingTimeInterval(3600)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}
