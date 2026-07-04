import SwiftUI

/// ACCOUNT · Notifications row target — the eight daily-engagement toggles,
/// bound to the shared `NotificationPrefsStore` the onboarding primer writes.
/// Editing here re-schedules the local reminders behind the prefs.
struct NotificationPrefsV3View: View {
    @Environment(AppModel.self) private var model
    @Bindable private var prefs = NotificationPrefsStore.shared

    var body: some View {
        DataV3Screen {
            DataV3BackLink(label: "Account")

            Text("Notifications")
                .font(.arcSerif(25))
                .foregroundStyle(Color.ink)
                .padding(.bottom, 6)

            Text("Results never arrive in a push — you'll be told they're ready, nothing more. Morning readiness surfaces on your wrist at your usual wake, never earlier.")
                .font(.arcSans(12.5))
                .foregroundStyle(Color.arcSecondaryLight)
                .lineSpacing(3)
                .padding(.bottom, 16)

            prefRow("Results & clinician notes", "The reason the app exists", $prefs.results)
            prefRow("Test & fasting reminders", "The night before, and the morning of", $prefs.reminders)
            prefRow("Morning readiness", "On your wrist at your usual wake — never earlier", $prefs.readiness)
            prefRow("Out-of-range vitals", "When overnight signals leave your band — early illness flag", $prefs.vitals)
            prefRow("Monthly Vitality", "The slow score, once a month — never daily", $prefs.monthly)
            prefRow("Weekly focus", "One nudge a week, never streaks", $prefs.weeklyFocus)
            prefRow("Energy dips", "A heads-up before your usual afternoon dip — off by default", $prefs.energyDip)
            prefRow("Lock app with Face ID", "It's health data — on by default", $prefs.faceIDLock)
        }
        // Re-plan whenever any toggle changes so the schedule always matches.
        .onChange(of: prefs.snapshot) { NotificationPlanner.refresh(store: prefs, model: model) }
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
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
            ArcToggle(isOn: binding)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 16)
        .frame(minHeight: 44)
        .dataV3Card(radius: 14, border: Color.arcDarkSurface.opacity(0.1))
        .padding(.bottom, 9)
        .accessibilityElement(children: .combine)
    }
}

#if DEBUG
#Preview("Notifications") {
    NavigationStack { NotificationPrefsV3View() }
        .environment(AppState())
        .environment(AppModel())
}
#endif
