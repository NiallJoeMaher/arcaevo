import SwiftUI
import UserNotifications

/// ONBOARDING 7/7 — Notifications (light). THIS screen IS the primer: it
/// explains before it asks. Eight toggles ("only the ones worth a buzz")
/// bound to the shared `NotificationPrefsStore`; whole row tappable. The CTA
/// fires the REAL `UNUserNotificationCenter` request only when ≥1 push-backed
/// toggle is on (§7 choreography), then schedules the local reminders behind
/// the prefs and completes onboarding.
struct NotificationsV3View: View {
    @Environment(AppState.self) private var appState
    @Environment(AppModel.self) private var model
    @Bindable private var prefs = NotificationPrefsStore.shared
    @State private var finishing = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text("Only the ones worth a buzz")
                    .font(.arcSerif(28))
                    .lineSpacing(28 * 0.12)
                    .foregroundStyle(Color.ink)
                    .padding(.bottom, 8)

                Text("Results, reminders, morning readiness on your wrist — never streak guilt. Tap to change.")
                    .font(.arcSans(13))
                    .lineSpacing(13 * 0.3)
                    .foregroundStyle(Color.arcSecondaryLight)
                    .padding(.bottom, 22)

                prefRow("Results & clinician notes", "The reason the app exists", $prefs.results)
                prefRow("Test & fasting reminders", "The night before, and the morning of", $prefs.reminders)
                prefRow("Morning readiness", "On your wrist at your usual wake — never earlier", $prefs.readiness)
                prefRow("Out-of-range vitals", "When overnight signals leave your band — early illness flag", $prefs.vitals)
                prefRow("Monthly Vitality", "The slow score, once a month — never daily", $prefs.monthly)
                prefRow("Weekly focus", "One nudge a week, never streaks", $prefs.weeklyFocus)
                prefRow("Energy dips", "A heads-up before your usual afternoon dip — off by default", $prefs.energyDip)
                prefRow("Lock app with Face ID", "It's health data — on by default", $prefs.faceIDLock)

                ArcPillButton(title: "Take me to my data", disabled: finishing, fontSize: 14.5, verticalPadding: 15) {
                    finishing = true
                    Task { await finish() }
                }
                .padding(.top, 12)
            }
            .padding(EdgeInsets(top: 16, leading: 26, bottom: 28, trailing: 26))
        }
        .background(Color.arcCream.ignoresSafeArea())
    }

    private func finish() async {
        // §7: request the system permission only when ≥1 push-backed toggle is
        // on (provisional/quiet auth is an acceptable fallback). Results never
        // carry a value — only "they're ready".
        if prefs.anyPushEnabled {
            _ = try? await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound, .badge])
            NotificationPlanner.refresh(store: prefs, model: model)
        }
        finishing = false
        appState.completeOnboarding()
        // Re-engagement: nudge them to open their first readiness within ~24h
        // (cancelled the moment they view a score). No-op if they didn't grant.
        FirstReadingNudge.scheduleIfNeeded(appState: appState)
        // Start the daily check-in reminder + escalation from tomorrow — they're
        // actively finishing onboarding now, so today already counts as a check-in.
        appState.markCheckedInToday()
        EngagementNudge.refresh(appState: appState, model: model)
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
                        .fixedSize(horizontal: false, vertical: true)
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
            .frame(minHeight: 44)
            .background(.white, in: RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(Color.arcDarkSurface.opacity(0.12), lineWidth: 1)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: isOn.wrappedValue)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isOn.wrappedValue ? [.isSelected] : [])
        .accessibilityHint("Double-tap to \(isOn.wrappedValue ? "turn off" : "turn on")")
        .padding(.bottom, 10)
    }
}
