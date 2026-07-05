import WidgetKit
import SwiftUI

// MARK: - Watch complication timeline provider + Smart Stack relevance
//
// Reads the watch's App-Group snapshot. Morning readiness rises to the top of
// the Smart Stack around the member's wake window, then recedes — the
// TimelineEntryRelevance score is elevated in the morning and low afterward, so
// watchOS surfaces the readiness complication when it matters and gets out of
// the way (the design's "AT YOUR WAKE TIME", the sub-10-second glance).

struct GlanceEntry: TimelineEntry {
    let date: Date
    let glance: GlanceDTO
    var relevance: TimelineEntryRelevance?
}

struct WatchGlanceProvider: TimelineProvider {
    func placeholder(in context: Context) -> GlanceEntry {
        GlanceEntry(date: Date(), glance: GlanceReader.placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (GlanceEntry) -> Void) {
        let glance = context.isPreview ? GlanceReader.placeholder : (GlanceReader.read() ?? GlanceReader.placeholder)
        completion(GlanceEntry(date: Date(), glance: glance))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<GlanceEntry>) -> Void) {
        let now = Date()
        let glance = GlanceReader.read() ?? GlanceReader.placeholder

        // Smart Stack relevance: elevate morning readiness (~06:00–09:00) so it
        // rises to the top of the stack at wake, then recedes for the rest of
        // the day. Never blasts — it's a surfacing hint, not a push.
        let hour = Calendar.current.component(.hour, from: now)
        let morning = (6...9).contains(hour)
        let relevance = TimelineEntryRelevance(score: morning ? 90 : 10)

        let entry = GlanceEntry(date: now, glance: glance, relevance: relevance)
        let next = Calendar.current.date(byAdding: .hour, value: 1, to: now) ?? now.addingTimeInterval(3600)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}
