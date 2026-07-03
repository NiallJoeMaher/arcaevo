import SwiftUI

/// TESTING — Nurse booking (light, Performance plan).
/// Morning slots only (fasted), day × time grid, confirm → booked state
/// with fasting-reminder note; free reschedule up to 24h before.
struct NurseBookingV3View: View {
    let tier: Membership.Tier

    @Environment(JourneyFlow.self) private var flow
    @State private var day = "Wed 8"
    @State private var slot = "08:15"
    @State private var booked = false

    private static let days = ["Tue 7", "Wed 8", "Thu 9"]
    private static let slots = ["07:30", "08:15", "09:00", "09:45"]

    var body: some View {
        ZStack {
            Color.bone.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 0) {
                ArcBackLink { flow.pop() }
                    .padding(.bottom, 2)

                ArcEyebrow(text: "Performance · Nurse visit", size: 10, color: .arcDeepGreen)
                    .padding(.bottom, 12)

                Text("When should we come?")
                    .font(.arcSerif(27))
                    .lineSpacing(27 * 0.12)
                    .foregroundStyle(Color.ink)
                    .padding(.bottom, 8)

                Text("Morning slots, fasted. 20 minutes at your home or desk — 14 Emmet Road, D08.")
                    .font(.arcSans(13))
                    .lineSpacing(13 * 0.35)
                    .foregroundStyle(Color.arcSecondaryLight)
                    .padding(.bottom, 20)

                HStack(spacing: 9) {
                    ForEach(Self.days, id: \.self) { d in
                        dayCard(d)
                    }
                }
                .padding(.bottom, 12)

                FlexibleWrap(spacing: 8) {
                    ForEach(Self.slots, id: \.self) { t in
                        slotPill(t)
                    }
                }
                .padding(.bottom, 22)

                if booked {
                    VStack(spacing: 3) {
                        Text("✓ Booked — \(day) July, \(slot)")
                            .font(.arcSans(14, weight: .bold))
                            .foregroundStyle(Color.arcDeepGreen)
                        Text("Fasting reminder the night before · nurse's name and photo the morning of")
                            .font(.arcSans(12))
                            .foregroundStyle(Color.arcSecondaryDark)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(16)
                    .background(Color.arcPrimaryGreen.opacity(0.1), in: RoundedRectangle(cornerRadius: 14))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .stroke(Color.arcPrimaryGreen.opacity(0.35), lineWidth: 1)
                    )
                    .padding(.bottom, 11)

                    ArcGhostPill(title: "Follow my sample journey", fontSize: 13.5, verticalPadding: 13) {
                        flow.push(.sampleJourney(tier))
                    }
                } else {
                    ArcPillButton(title: "Confirm — \(day) July, \(slot)", fontSize: 14, verticalPadding: 15) {
                        booked = true
                    }
                }

                Spacer()

                Text("Free reschedule up to 24h before the visit.")
                    .font(.arcSans(11.5))
                    .foregroundStyle(Color.arcSecondaryLight)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }
            .padding(EdgeInsets(top: 14, leading: 26, bottom: 26, trailing: 26))
        }
        .sensoryFeedback(.success, trigger: booked)
        .sensoryFeedback(.selection, trigger: day)
        .sensoryFeedback(.selection, trigger: slot)
    }

    private func dayCard(_ d: String) -> some View {
        let on = day == d
        return Button {
            day = d
            booked = false // picking a new day re-opens the confirm step
        } label: {
            VStack(spacing: 1) {
                Text(d)
                    .font(.arcSans(14, weight: .bold))
                    .foregroundStyle(on ? Color.arcDeepGreen : Color.ink)
                Text("July")
                    .font(.arcSans(11))
                    .foregroundStyle(Color.arcSecondaryLight)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(on ? Color.arcPrimaryGreen.opacity(0.08) : Color.white)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(
                        on ? Color.arcDeepGreen : Color.arcDarkSurface.opacity(0.14),
                        lineWidth: on ? 1.5 : 1
                    )
            )
            .contentShape(RoundedRectangle(cornerRadius: 12))
            .frame(minHeight: 44)
        }
        .buttonStyle(.plain)
    }

    private func slotPill(_ t: String) -> some View {
        let on = slot == t
        return Button {
            slot = t
            booked = false
        } label: {
            Text(t)
                .font(.arcMono(13))
                .foregroundStyle(on ? Color.arcDeepGreen : Color.ink)
                .padding(EdgeInsets(top: 10, leading: 16, bottom: 10, trailing: 16))
                .background(Capsule().fill(on ? Color.arcPrimaryGreen.opacity(0.08) : Color.white))
                .overlay(
                    Capsule().stroke(
                        on ? Color.arcDeepGreen : Color.arcDarkSurface.opacity(0.14),
                        lineWidth: on ? 1.5 : 1
                    )
                )
                .contentShape(Capsule())
                .frame(minHeight: 44)
        }
        .buttonStyle(.plain)
    }
}
