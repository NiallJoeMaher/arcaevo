import SwiftUI

/// ACCOUNT · Notifications row target — the four prototype toggles
/// (results / reminders / weekly focus / Face ID lock), bound to the same
/// persisted `NotificationPrefs` the onboarding screen writes.
struct NotificationPrefsV3View: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        @Bindable var appState = appState
        DataV3Screen {
            DataV3BackLink(label: "Account")

            Text("Notifications")
                .font(.arcSerif(25))
                .foregroundStyle(Color.ink)
                .padding(.bottom, 6)

            Text("Results never arrive in a push — you'll be told they're ready, nothing more.")
                .font(.arcSans(12.5))
                .foregroundStyle(Color.arcSecondaryLight)
                .lineSpacing(3)
                .padding(.bottom, 16)

            prefRow(
                "Results & clinician notes",
                "The reason the app exists",
                $appState.notificationPrefs.results
            )
            prefRow(
                "Test & fasting reminders",
                "The night before, and the morning of",
                $appState.notificationPrefs.reminders
            )
            prefRow(
                "Weekly focus",
                "One nudge a week, never streaks",
                $appState.notificationPrefs.weeklyFocus
            )
            prefRow(
                "Lock app with Face ID",
                "It's health data — on by default",
                $appState.notificationPrefs.faceIDLock
            )
        }
    }

    private func prefRow(_ title: String, _ sub: String, _ binding: Binding<Bool>) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.arcSans(13, weight: .bold))
                    .foregroundStyle(Color.ink)
                Text(sub)
                    .font(.arcSans(11))
                    .foregroundStyle(Color.arcSecondaryLight)
            }
            Spacer()
            ArcToggle(isOn: binding)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 16)
        .frame(minHeight: 44)
        .dataV3Card(radius: 14, border: Color.arcDarkSurface.opacity(0.1))
        .padding(.bottom, 9)
    }
}

#if DEBUG
#Preview("Notifications") {
    NavigationStack { NotificationPrefsV3View() }
        .environment(AppState())
        .environment(AppModel())
}
#endif
