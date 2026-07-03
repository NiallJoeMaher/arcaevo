import SwiftUI

/// TESTING — Critical value (light).
/// The calm screen: "Dr. Nolan would like a word first." NEVER a red
/// number, never the value itself — a person first, always. The rest of
/// the panel stays readable.
struct CriticalValueV3View: View {
    let tier: Membership.Tier

    @Environment(AppState.self) private var appState
    @State private var choosingTime = false

    var body: some View {
        ZStack {
            Color.bone.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 0) {
                ArcEyebrow(text: "Your results", size: 10, color: .arcDeepGreen)
                    .padding(.top, 16)
                    .padding(.bottom, 14)

                Text("Dr. Nolan would like a word first.")
                    .font(.arcSerif(29))
                    .lineSpacing(29 * 0.12)
                    .foregroundStyle(Color.ink)
                    .padding(.bottom, 12)

                Text("One value on your panel needs a conversation before you read it alone. This is precaution, not panic — it's often a lab artefact or a fasting issue.")
                    .font(.arcSans(13.5))
                    .lineSpacing(13.5 * 0.4)
                    .foregroundStyle(Color.arcSecondaryDark)
                    .padding(.bottom, 20)

                VStack(alignment: .leading, spacing: 4) {
                    Text("She'll call today")
                        .font(.arcSans(14, weight: .bold))
                        .foregroundStyle(Color.ink)
                    Text("Between 14:00–17:00 on 087 ··· ··21. From a Dublin number.")
                        .font(.arcSans(12.5))
                        .lineSpacing(12.5 * 0.3)
                        .foregroundStyle(Color.arcSecondaryLight)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(18)
                .background(.white, in: RoundedRectangle(cornerRadius: 16))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.arcDarkSurface.opacity(0.12), lineWidth: 1)
                )
                .padding(.bottom, 11)

                ArcGhostPill(title: "Choose a better time", fontSize: 13.5, verticalPadding: 13) {
                    choosingTime = true
                }
                .padding(.bottom, 16)

                Button {
                    // The flagged value stays with Dr. Nolan; everything else
                    // is readable now — straight to Results.
                    appState.activateMembership(tier)
                    appState.selectedTab = .results
                } label: {
                    Text("The rest of your panel is ready to read now →")
                        .font(.arcSans(13, weight: .semibold))
                        .foregroundStyle(Color.arcDeepGreen)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Spacer()

                Text("Never a red number in a push notification —\na person first, always.")
                    .font(.arcSans(11.5))
                    .lineSpacing(11.5 * 0.4)
                    .foregroundStyle(Color.arcSecondaryLight)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }
            .padding(EdgeInsets(top: 0, leading: 26, bottom: 28, trailing: 26))
        }
        .alert("Choose a better time", isPresented: $choosingTime) {
            Button("This afternoon (14:00–17:00)", role: .none) {}
            Button("Tomorrow morning (09:00–12:00)", role: .none) {}
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Dr. Nolan will call from a Dublin number at the window you pick.")
        }
    }
}
