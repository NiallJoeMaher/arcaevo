import SwiftUI

/// ONBOARDING 6/7 — About you (light).
/// DOB + sex at birth (sets lab ranges) + "what matters most" — the three
/// answers ranges and baselines depend on. Persisted locally (@AppStorage);
/// the checkout on web collects the canonical copy.
struct AboutYouV3View: View {
    @Environment(AppState.self) private var appState

    @AppStorage("arcaevo.aboutYou.dob") private var dobTimestamp: Double = 0
    @AppStorage("arcaevo.aboutYou.sex") private var sexAtBirth = "Female"
    @AppStorage("arcaevo.aboutYou.focus") private var focus = "Heart health"
    @State private var showDatePicker = false

    private static let focusOptions = ["Heart health", "Energy", "Performance", "Longevity"]

    private var dob: Date {
        get { dobTimestamp == 0 ? Self.defaultDOB : Date(timeIntervalSince1970: dobTimestamp) }
    }

    /// The design persona's DOB — 14 / 03 / 1991.
    private static let defaultDOB: Date = {
        var comps = DateComponents()
        comps.year = 1991; comps.month = 3; comps.day = 14
        return Calendar.current.date(from: comps) ?? .now
    }()

    private var dobLabel: String {
        let f = DateFormatter()
        f.dateFormat = "dd / MM / yyyy"
        return f.string(from: dob)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("A little about you")
                .font(.arcSerif(28))
                .lineSpacing(28 * 0.12)
                .foregroundStyle(Color.ink)
                .padding(.bottom, 8)

            Text("Ranges and baselines depend on these three answers.")
                .font(.arcSans(13))
                .foregroundStyle(Color.arcSecondaryLight)
                .padding(.bottom, 22)

            Text("Date of birth")
                .font(.arcSans(13, weight: .semibold))
                .foregroundStyle(Color.ink)
                .padding(.bottom, 7)

            Button {
                showDatePicker = true
            } label: {
                Text(dobLabel)
                    .font(.arcSans(14))
                    .foregroundStyle(Color.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(EdgeInsets(top: 13, leading: 16, bottom: 13, trailing: 16))
                    .background(.white, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.arcDarkSurface.opacity(0.16), lineWidth: 1)
                    )
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .padding(.bottom, 16)

            (Text("Sex at birth ").font(.arcSans(13, weight: .semibold)).foregroundStyle(Color.ink)
                + Text("· sets lab ranges").font(.arcSans(13)).foregroundStyle(Color.arcSecondaryLight))
                .padding(.bottom, 7)

            HStack(spacing: 9) {
                selectPill("Female", selected: sexAtBirth == "Female") { sexAtBirth = "Female" }
                selectPill("Male", selected: sexAtBirth == "Male") { sexAtBirth = "Male" }
            }
            .padding(.bottom, 16)

            Text("What matters most right now?")
                .font(.arcSans(13, weight: .semibold))
                .foregroundStyle(Color.ink)
                .padding(.bottom, 7)

            FlowChips(options: Self.focusOptions, selected: focus) { focus = $0 }
                .padding(.bottom, 26)

            Spacer()

            ArcPillButton(title: "Continue", fontSize: 14.5, verticalPadding: 15) {
                appState.advanceOnboarding()
            }
        }
        .padding(EdgeInsets(top: 16, leading: 26, bottom: 28, trailing: 26))
        .sensoryFeedback(.selection, trigger: sexAtBirth)
        .sensoryFeedback(.selection, trigger: focus)
        .sheet(isPresented: $showDatePicker) {
            VStack(spacing: 0) {
                DatePicker(
                    "Date of birth",
                    selection: Binding(
                        get: { dob },
                        set: { dobTimestamp = $0.timeIntervalSince1970 }
                    ),
                    in: ...Date.now,
                    displayedComponents: .date
                )
                .datePickerStyle(.wheel)
                .labelsHidden()
                .padding(.top, 18)

                ArcPillButton(title: "Done", fontSize: 14.5, verticalPadding: 15) {
                    showDatePicker = false
                }
                .padding(EdgeInsets(top: 6, leading: 26, bottom: 20, trailing: 26))
            }
            .presentationDetents([.height(320)])
            .presentationBackground(Color.bone)
        }
    }

    private func selectPill(_ label: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.arcSans(13.5, weight: selected ? .semibold : .regular))
                .foregroundStyle(selected ? Color.arcDeepGreen : Color.ink)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(
                    Capsule().fill(selected ? Color.arcPrimaryGreen.opacity(0.08) : .clear)
                )
                .overlay(
                    Capsule().stroke(
                        selected ? Color.arcDeepGreen : Color.arcDarkSurface.opacity(0.16),
                        lineWidth: selected ? 1.5 : 1
                    )
                )
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .frame(minHeight: 44)
    }
}

/// Wrapping single-select chip row (pill chips, radius 100).
struct FlowChips: View {
    var options: [String]
    var selected: String
    var pick: (String) -> Void

    var body: some View {
        FlexibleWrap(spacing: 8) {
            ForEach(options, id: \.self) { option in
                let on = option == selected
                Button {
                    pick(option)
                } label: {
                    Text(option)
                        .font(.arcSans(13, weight: on ? .semibold : .regular))
                        .foregroundStyle(on ? Color.arcDeepGreen : Color.ink)
                        .padding(EdgeInsets(top: 9, leading: 15, bottom: 9, trailing: 15))
                        .background(Capsule().fill(on ? Color.arcPrimaryGreen.opacity(0.08) : .clear))
                        .overlay(
                            Capsule().stroke(
                                on ? Color.arcDeepGreen : Color.arcDarkSurface.opacity(0.16),
                                lineWidth: on ? 1.5 : 1
                            )
                        )
                        .contentShape(Capsule())
                        .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

/// Minimal wrapping layout for chips (Layout protocol, iOS 16+).
struct FlexibleWrap: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: width, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
