import SwiftUI

/// Shown when the watch has no live session (`.signedOut`, or `.unknown` with
/// no token in Release). NO email/password field, no web OAuth
/// (ASWebAuthenticationSession doesn't exist on watchOS) — the product is
/// email + magic-link only, so the wrist's fallback is simply: finish on the
/// phone, and the watch signs in on its own. One line of copy + the orb.
struct WatchSetupView: View {
    var body: some View {
        VStack(spacing: 12) {
            Spacer(minLength: 0)

            orb

            Text("Finish setup on your iPhone")
                .font(.arcSerif(19))
                .foregroundStyle(Color.arcCream)
                .multilineTextAlignment(.center)

            Text("Open Arcaevo on your iPhone to sign in. Your watch connects on its own.")
                .font(.arcSans(11))
                .foregroundStyle(Color.arcMutedOnDark)
                .multilineTextAlignment(.center)
                .lineSpacing(2)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
    }

    /// The brand mark: the real logo chip inside a faint halo ring.
    private var orb: some View {
        ZStack {
            Circle()
                .stroke(Color.arcPrimaryGreen.opacity(0.22), lineWidth: 1)
                .frame(width: 50, height: 50)
            // Real brand chip (cream circle + green "A"), sized to the former
            // 34px orb core; reads cleanly on the black setup background.
            Image("BrandMark")
                .resizable()
                .scaledToFit()
                .frame(width: 34, height: 34)
        }
        .frame(height: 56)
    }
}

#if DEBUG
#Preview("Watch setup") {
    WatchSetupView()
}
#endif
