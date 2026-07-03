import SwiftUI

/// Root: the six watch screens as a vertical page stack (crown/swipe),
/// matching the prototype's swipe order. Every hit target ≥ 44pt.
struct WatchRootView: View {
    @Environment(WatchModel.self) private var model
    @Environment(WatchAuthManager.self) private var auth
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            if auth.showsAuthenticatedExperience {
                authenticatedScreens
            } else {
                // No live session → calm "open your iPhone" state. Never a
                // login field on the wrist.
                WatchSetupView()
            }
        }
        .onChange(of: scenePhase) { _, phase in
            // Revalidate the token every time the watch comes to the front —
            // this is the wake-up refresh that keeps the wrist working
            // independently of the phone.
            if phase == .active {
                Task { await auth.refresh() }
            }
        }
    }

    private var authenticatedScreens: some View {
        @Bindable var model = model
        return TabView(selection: $model.screen) {
            WatchFaceEntryView()
                .tag(WatchModel.Screen.face)
            WatchTodayBaselineView()
                .tag(WatchModel.Screen.today)
            WatchGlanceV3View()
                .tag(WatchModel.Screen.glance)
            WatchQuickLogV3View()
                .tag(WatchModel.Screen.quickLog)
            WatchExperimentV3View()
                .tag(WatchModel.Screen.experiment)
            WatchResultReadyV3View()
                .tag(WatchModel.Screen.resultReady)
        }
        .tabViewStyle(.verticalPage)
        .background(Color.black)
        .task { await model.load(auth: auth) }
    }
}

// MARK: Shared ring (baseline score, number centered — per the watch design)

struct WatchBaselineRing: View {
    var score: Int
    var size: CGFloat
    var lineWidth: CGFloat
    var numberSize: CGFloat

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.white.opacity(0.13), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: CGFloat(score) / 100)
                .stroke(
                    Color.arcPrimaryGreen,
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
            Text("\(score)")
                .font(.arcMono(numberSize))
                .foregroundStyle(Color.arcCream)
        }
        .frame(width: size, height: size)
    }
}

#if DEBUG
#Preview("Watch root") {
    WatchRootView()
        .environment(WatchModel())
        .environment(WatchAuthManager())
}
#endif
