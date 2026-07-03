import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// ACCOUNT · "Invite" — `data-screen-label="Invite"`.
/// Referral code (NAME-XX), tap-to-copy, real share sheet, give-a-month /
/// get-a-month copy. No leaderboards, no streaks — just a fair trade.
struct InviteV3View: View {
    var user: User?

    @State private var copied = false

    private var member: User { user ?? (DemoMode.isEnabled ? DemoDataProvider.user() : .anonymous) }

    /// NAME-XX referral code. The demo member maps to the seeded AOIFE-K4
    /// fixture; other members get a stable letter+digit suffix from their
    /// email so the code never changes between launches.
    private var code: String {
        if member.email == "aoife@example.com" { return "AOIFE-K4" }
        let first = member.name.split(separator: " ").first.map(String.init) ?? "MEMBER"
        var hash: UInt32 = 5381
        for byte in member.email.lowercased().utf8 { hash = hash &* 33 &+ UInt32(byte) }
        let letters = Array("ABCDEFGHJKMNPQRSTUVWXYZ")
        let letter = letters[Int(hash % UInt32(letters.count))]
        let digit = (hash / 7) % 10
        return "\(first.uppercased())-\(letter)\(digit)"
    }

    private var inviteURL: URL {
        URL(string: "https://arcaevo.com/join?ref=\(code)") ?? URL(string: "https://arcaevo.com/join")!
    }

    /// One earned month pushes the renewal out — shown as the real date.
    private var adjustedRenewal: String {
        let base = member.membership.renewsAt
        let pushed = Calendar.current.date(byAdding: .month, value: 2, to: base) ?? base
        return DataV3Format.longDate(pushed)
    }

    var body: some View {
        DataV3Screen {
            DataV3BackLink(label: "Account")

            Text("INVITE SOMEONE")
                .font(.arcMono(10, weight: .medium))
                .kerning(1.2)
                .foregroundStyle(Color.arcDeepGreen)
                .padding(.bottom, 12)

            Text("Know someone who'd want this?")
                .font(.arcSerif(26))
                .foregroundStyle(Color.ink)
                .lineSpacing(2)
                .padding(.bottom, 8)

            Text("They get a month free on any plan. When they join, a free month lands on your renewal. That's the whole scheme.")
                .font(.arcSans(13))
                .foregroundStyle(Color.arcSecondaryDark)
                .lineSpacing(4)
                .padding(.bottom, 20)

            // The code card — dashed border, tap to copy.
            Button {
                #if canImport(UIKit)
                UIPasteboard.general.string = code
                #endif
                copied = true
            } label: {
                VStack(spacing: 3) {
                    Text(code)
                        .font(.arcMono(18))
                        .kerning(2.2)
                        .foregroundStyle(Color.ink)
                    Text(copied ? "Copied ✓" : "Your code — tap to copy")
                        .font(.arcSans(11.5))
                        .foregroundStyle(copied ? Color.arcDeepGreen : Color.arcSecondaryLight)
                }
                .frame(maxWidth: .infinity, minHeight: 44)
                .padding(18)
                .background(.white, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 15, style: .continuous)
                        .strokeBorder(
                            Color.arcDarkSurface.opacity(0.25),
                            style: StrokeStyle(lineWidth: 1.5, dash: [5, 4])
                        )
                )
                .contentShape(RoundedRectangle(cornerRadius: 15))
            }
            .buttonStyle(.plain)
            .padding(.bottom, 11)

            // Real share sheet.
            ShareLink(
                item: inviteURL,
                message: Text("A month free of Arcaevo — my code is \(code).")
            ) {
                Text("Share invite link")
                    .font(.arcSans(14, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.arcDeepGreen, in: Capsule())
            }
            .buttonStyle(.plain)
            .padding(.bottom, 11)

            VStack(alignment: .leading, spacing: 2) {
                Text("2 joined so far → 2 free months applied")
                    .font(.arcSans(12.5))
                    .foregroundStyle(Color.arcSecondaryLight)
                Text("Renewal now \(adjustedRenewal)")
                    .font(.arcSans(12.5, weight: .semibold))
                    .foregroundStyle(Color.arcDeepGreen)
            }
            .padding(.vertical, 14)
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .dataV3Card(radius: 15)

            Text("No leaderboards, no streaks — just a fair trade.")
                .font(.arcSans(11.5))
                .foregroundStyle(Color.arcSecondaryLight)
                .frame(maxWidth: .infinity)
                .padding(.top, 24)
        }
    }
}

#if DEBUG
#Preview("Invite someone") {
    NavigationStack { InviteV3View(user: nil) }
        .environment(AppState())
        .environment(AppModel())
}
#endif
