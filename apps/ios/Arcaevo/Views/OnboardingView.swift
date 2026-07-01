import SwiftUI

/// 3-page intro → Apple Health permission → mock sign-in.
struct OnboardingView: View {
    @Environment(AppModel.self) private var model
    let onComplete: () -> Void

    @State private var page = 0
    @State private var healthRequested = false

    private let pages: [(kicker: String, title: String, body: String)] = [
        (
            "YOUR BASELINE",
            "Read off your own baseline, not a population average.",
            "Arcaevo learns what's normal for you — then tells you, in plain language, when something really moves."
        ),
        (
            "BLOODS + WEARABLE, FUSED",
            "One timeline for blood tests, sleep, HRV and VO₂ max.",
            "Finger-prick blood tests plotted over the Apple Watch signal that explains them. The story, not two disconnected charts."
        ),
        (
            "THE \u{201C}DID IT WORK?\u{201D} LOOP",
            "Log a change. We tell you if it actually worked.",
            "At your next test, deterministic rules decide whether a marker really moved or was within test noise. AI only narrates."
        ),
    ]

    var body: some View {
        VStack(spacing: 0) {
            TabView(selection: $page) {
                ForEach(pages.indices, id: \.self) { index in
                    introPage(pages[index])
                        .tag(index)
                }
                connectPage
                    .tag(pages.count)
            }
            .tabViewStyle(.page(indexDisplayMode: .always))
            .indexViewStyle(.page(backgroundDisplayMode: .always))

            DisclaimerFooter()
        }
        .background(Color.bone.ignoresSafeArea())
    }

    private func introPage(_ content: (kicker: String, title: String, body: String)) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            Spacer()
            Kicker(text: content.kicker)
            Text(content.title)
                .displaySerif(36)
                .foregroundStyle(Color.ink)
                .lineSpacing(2)
            Text(content.body)
                .font(.system(size: 17))
                .lineSpacing(4)
                .foregroundStyle(Color.mutedInk)
            Spacer()
            Button {
                withAnimation { page += 1 }
            } label: {
                Text("Continue")
                    .font(.system(size: 16, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 15)
                    .background(Color.forest)
                    .foregroundStyle(.white)
                    .clipShape(Capsule())
            }
            .padding(.bottom, 48)
        }
        .padding(.horizontal, 28)
    }

    private var connectPage: some View {
        VStack(alignment: .leading, spacing: 20) {
            Spacer()
            Kicker(text: "APPLE WATCH · APPLE HEALTH")
            Text("Connect Apple Health to build your baseline.")
                .displaySerif(34)
                .foregroundStyle(Color.ink)
            Text("Arcaevo reads HRV, resting heart rate, sleep and VO₂ max — nothing else. Your data stays EU-hosted and is never sold. WHOOP, Oura and Garmin are on the roadmap.")
                .font(.system(size: 16))
                .lineSpacing(4)
                .foregroundStyle(Color.mutedInk)
            Spacer()

            Button {
                Task {
                    await model.requestHealthAccess()
                    healthRequested = true
                }
            } label: {
                Label(
                    healthRequested ? "Apple Health connected" : "Connect Apple Health",
                    systemImage: healthRequested ? "checkmark.circle.fill" : "heart.fill"
                )
                .font(.system(size: 16, weight: .semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 15)
                .background(healthRequested ? Color.vitality : Color.forest)
                .foregroundStyle(.white)
                .clipShape(Capsule())
            }

            // Mock sign-in — documented placeholder (docs/MOCKED_APIS.md §4).
            // Production: Sign in with Apple.
            Button {
                onComplete()
            } label: {
                Text("Sign in (demo member)")
                    .font(.system(size: 16, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 15)
                    .background(Color.clear)
                    .foregroundStyle(Color.ink)
                    .overlay(Capsule().strokeBorder(Color.ink.opacity(0.3), lineWidth: 1))
            }
            .padding(.bottom, 48)
        }
        .padding(.horizontal, 28)
    }
}
