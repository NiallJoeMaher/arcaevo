import SwiftUI
import UserNotifications

/// ONBOARDING 7/7 — Notifications (light).
/// Four toggles (Face ID lock ON by default — "It's health data"), whole
/// row tappable. The CTA fires the REAL UNUserNotificationCenter request
/// when any push-backed toggle is on, then completes onboarding.
struct NotificationsV3View: View {
    @Environment(AppState.self) private var appState
    @State private var finishing = false

    var body: some View {
        @Bindable var appState = appState
        VStack(alignment: .leading, spacing: 0) {
            Text("Only the ones worth a buzz")
                .font(.arcSerif(28))
                .lineSpacing(28 * 0.12)
                .foregroundStyle(Color.ink)
                .padding(.bottom, 8)

            Text("We send results, kit reminders and weekly focus — never streak guilt. Tap to change.")
                .font(.arcSans(13))
                .lineSpacing(13 * 0.3)
                .foregroundStyle(Color.arcSecondaryLight)
                .padding(.bottom, 22)

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

            Spacer()

            ArcPillButton(title: "Take me to my data", disabled: finishing, fontSize: 14.5, verticalPadding: 15) {
                finishing = true
                Task {
                    let prefs = appState.notificationPrefs
                    if prefs.results || prefs.reminders || prefs.weeklyFocus {
                        // Real permission request — results never carry values,
                        // only "they're ready".
                        _ = try? await UNUserNotificationCenter.current()
                            .requestAuthorization(options: [.alert, .sound, .badge])
                    }
                    finishing = false
                    appState.completeOnboarding()
                }
            }
        }
        .padding(EdgeInsets(top: 16, leading: 26, bottom: 28, trailing: 26))
    }

    private func prefRow(_ title: String, _ sub: String, _ isOn: Binding<Bool>) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) { isOn.wrappedValue.toggle() }
        } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.arcSans(13.5, weight: .semibold))
                        .foregroundStyle(Color.ink)
                    Text(sub)
                        .font(.arcSans(11))
                        .foregroundStyle(Color.arcSecondaryLight)
                }
                Spacer()
                ZStack(alignment: isOn.wrappedValue ? .trailing : .leading) {
                    Capsule()
                        .fill(isOn.wrappedValue ? Color.arcPrimaryGreen : Color.arcDarkSurface.opacity(0.18))
                        .frame(width: 40, height: 23)
                    Circle()
                        .fill(.white)
                        .frame(width: 19, height: 19)
                        .padding(2)
                }
            }
            .padding(EdgeInsets(top: 15, leading: 16, bottom: 15, trailing: 16))
            .background(.white, in: RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(Color.arcDarkSurface.opacity(0.12), lineWidth: 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: isOn.wrappedValue)
        .padding(.bottom, 10)
    }
}
