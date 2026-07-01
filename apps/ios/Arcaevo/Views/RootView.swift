import SwiftUI

struct RootView: View {
    @AppStorage("hasOnboarded") private var hasOnboarded = false

    var body: some View {
        if hasOnboarded {
            MainTabView()
        } else {
            OnboardingView {
                hasOnboarded = true
            }
        }
    }
}

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
