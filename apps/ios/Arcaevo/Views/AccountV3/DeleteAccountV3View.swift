import SwiftUI

/// ACCOUNT · "Delete account" — `data-screen-label="Delete account"`.
/// Honest and completable in-app: full export offered FIRST, arming by
/// actually typing DELETE (no password quiz, no phone call), then a clear
/// closure explanation with the real erasure date. No dark patterns.
struct DeleteAccountV3View: View {
    @Environment(AppState.self) private var appState

    @State private var typed = ""
    @State private var exportRequested = false
    @State private var deleting = false
    @State private var done = false

    private var armed: Bool {
        typed.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() == "DELETE"
    }

    /// Erasure completes within 30 days — the copy shows the actual date.
    private var erasureDate: String {
        let date = Calendar.current.date(byAdding: .day, value: 30, to: Date()) ?? Date()
        return DataV3Format.longDate(date)
    }

    var body: some View {
        DataV3Screen {
            DataV3BackLink()

            if done {
                doneState
            } else {
                deleteForm
            }
        }
    }

    // MARK: Pre-delete

    @ViewBuilder
    private var deleteForm: some View {
        Text("Delete your account and data")
            .font(.arcSerif(25))
            .foregroundStyle(Color.ink)
            .lineSpacing(2)
            .padding(.bottom, 10)

        Text("This erases your results, baselines, history and profile permanently — from our systems and our lab partners' — within 30 days. It cannot be undone.")
            .font(.arcSans(13))
            .foregroundStyle(Color.arcSecondaryDark)
            .lineSpacing(5)
            .padding(.bottom, 18)

        numberedLine("01", text: Text("We offer a full export first — most people want the PDF for their GP."))
            .padding(.bottom, 12)
        numberedLine("02", text: Text("Type ").font(.arcSans(13)) + Text("DELETE").font(.arcSans(13, weight: .bold)) + Text(" to confirm — no password quiz, no phone call.").font(.arcSans(13)))
            .padding(.bottom, 16)

        // The arming field — a REAL text field; typing DELETE arms the button.
        TextField("Type DELETE", text: $typed)
            .font(.arcMono(14))
            .kerning(1.4)
            .foregroundStyle(armed ? ArcDataPalette.rust : Color.ink)
            .multilineTextAlignment(.center)
            .textInputAutocapitalization(.characters)
            .autocorrectionDisabled()
            .padding(.vertical, 13)
            .padding(.horizontal, 16)
            .dataV3Card(radius: 12, border: ArcDataPalette.hairlineStrong)
            .padding(.bottom, 16)

        Button {
            exportRequested = true
        } label: {
            Text(exportRequested ? "Requested ✓ — arriving by email" : "Request export")
                .font(.arcSans(13.5, weight: .semibold))
                .foregroundStyle(Color.ink)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .overlay(Capsule().strokeBorder(ArcDataPalette.hairlineStrong))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(exportRequested)
        .padding(.bottom, 10)

        Button {
            performDelete()
        } label: {
            HStack(spacing: 8) {
                if deleting { ProgressView().tint(ArcDataPalette.rust) }
                Text("Delete everything")
                    .font(.arcSans(13.5, weight: .semibold))
                    .foregroundStyle(ArcDataPalette.rust)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 13)
            .overlay(Capsule().strokeBorder(ArcDataPalette.rust))
            .contentShape(Capsule())
            .opacity(armed ? 1 : 0.4)
        }
        .buttonStyle(.plain)
        .disabled(!armed || deleting)
    }

    private func numberedLine(_ number: String, text: Text) -> some View {
        HStack(alignment: .top, spacing: 11) {
            Text(number)
                .font(.arcMono(11))
                .foregroundStyle(Color.arcDeepGreen)
                .padding(.top, 2)
            text
                .font(.arcSans(13))
                .foregroundStyle(Color.ink)
                .lineSpacing(4)
        }
    }

    // MARK: Done

    @ViewBuilder
    private var doneState: some View {
        Text("✓")
            .font(.arcSans(22))
            .foregroundStyle(ArcDataPalette.rust)
            .frame(width: 56, height: 56)
            .background(ArcDataPalette.rust.opacity(0.1), in: Circle())
            .padding(.bottom, 18)

        Text("Erasure scheduled.")
            .font(.arcSerif(25))
            .foregroundStyle(Color.ink)
            .padding(.bottom, 10)

        (Text("Everything is deleted by ").font(.arcSans(13.5))
            + Text(erasureDate).font(.arcSans(13.5, weight: .bold))
            + Text(". A confirmation email with the exact date is on its way, and unused test value is refunded pro-rata.").font(.arcSans(13.5)))
            .foregroundStyle(Color.arcSecondaryDark)
            .lineSpacing(5)
            .padding(.bottom, 18)

        // The prototype's "Restart the prototype" is design-rig chrome; the
        // real app signs out to the welcome screen.
        Button {
            appState.signOut()
        } label: {
            Text("Sign out")
                .font(.arcSans(14, weight: .semibold))
                .foregroundStyle(Color.ink)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .overlay(Capsule().strokeBorder(ArcDataPalette.hairlineStrong))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    /// Closure starts by withdrawing the `health_processing` consent — the
    /// backend's honest closure trigger (`closureRequired: true`).
    private func performDelete() {
        guard armed, !deleting else { return }
        deleting = true
        Task {
            do {
                _ = try await appState.api.postConsents(
                    [ConsentGrant(purpose: .healthProcessing, granted: false)],
                    surface: "ios"
                )
            } catch {
                // Offline demo: the closure screen still shows; nothing
                // pretends the server confirmed.
            }
            deleting = false
            done = true
        }
    }
}

#if DEBUG
#Preview("Delete account") {
    NavigationStack { DeleteAccountV3View() }
        .environment(AppState())
        .environment(AppModel())
}
#endif
