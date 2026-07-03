import SwiftUI

/// v3 root router: onboarding flow → free tier | member shell.
/// Routing is owned by `AppState` (the prototype's logic class, ported);
/// `AppModel` keeps owning data loading for the tab screens.
struct RootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        switch appState.phase {
        case .onboarding:
            OnboardingFlowView()
        case .freeTier:
            FreeHomeView()
        case .member:
            MemberShellView()
        }
    }
}

/// Legacy v1 tab bar — superseded by `MemberShellView` (v3). Kept compiling
/// so the old screens stay reachable for reference until the Phase 16
/// screen wave replaces them.
struct MainTabView: View {
    var body: some View {
        TabView {
            NavigationStack { TodayView() }
                .tabItem { Label("Today", systemImage: "sun.max") }

            NavigationStack { ResultsView() }
                .tabItem { Label("Results", systemImage: "drop") }

            NavigationStack { OrdersView() }
                .tabItem { Label("Orders", systemImage: "shippingbox") }

            NavigationStack { SettingsView() }
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
    }
}
