#if DEBUG
import SwiftUI

// MARK: - MemberV3 preview harness (DEBUG only)
//
// The v3 shell (V3Shell.swift — owned by the shell agent) doesn't reference
// these screens yet, so this harness keeps every MemberV3 screen reachable:
// for the compiler, for Xcode previews, and for a quick manual walk-through.
// It is NOT part of the app flow and compiles out of release builds.

struct MemberV3Harness: View {
    @State private var appState = AppState()
    @State private var model = AppModel()

    var body: some View {
        TabView {
            MemberTodayV3View()
                .tabItem { Label("Today", systemImage: "sun.max") }
            MemberResultsV3View()
                .tabItem { Label("Results", systemImage: "chart.bar.doc.horizontal") }
            ExperimentsV3View()
                .tabItem { Label("Experiments", systemImage: "arrow.triangle.2.circlepath") }
            NavigationStack {
                List {
                    NavigationLink("Fusion timeline") { FusionTimelineV3View() }
                    NavigationLink("Marker detail (ApoB)") { MarkerDetailV3View() }
                    NavigationLink("Insights") { InsightsV3View() }
                    NavigationLink("Start experiment") { StartExperimentV3View() }
                    NavigationLink("Verdict — did it work?") { VerdictV3View() }
                    NavigationLink("Ask Arcaevo") { AskArcaevoV3View() }
                }
                .navigationTitle("MemberV3 screens")
            }
            .tabItem { Label("All", systemImage: "square.grid.2x2") }
        }
        .environment(appState)
        .environment(model)
        .task { await model.loadAll() }
    }
}

#Preview("MemberV3 — all screens") {
    MemberV3Harness()
}

#Preview("Dashboard") {
    MemberV3PreviewHost { MemberTodayV3View() }
}

#Preview("Fusion timeline") {
    MemberV3PreviewHost { NavigationStack { FusionTimelineV3View() } }
}

#Preview("Results → marker detail") {
    MemberV3PreviewHost { MemberResultsV3View() }
}

#Preview("Experiments") {
    MemberV3PreviewHost { ExperimentsV3View() }
}

#Preview("Ask Arcaevo") {
    MemberV3PreviewHost { NavigationStack { AskArcaevoV3View() } }
}

/// Wraps a screen with the environment objects the member screens expect.
private struct MemberV3PreviewHost<Content: View>: View {
    @State private var appState = AppState()
    @State private var model = AppModel()
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .environment(appState)
            .environment(model)
            .task { await model.loadAll() }
    }
}
#endif
