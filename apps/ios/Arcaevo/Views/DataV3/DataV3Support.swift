import SwiftUI

// MARK: - Shared chrome for the YOUR DATA + ACCOUNT v3 screens
//
// Pixel spec: design_handoff_ios_watch/designs/Prototype.dc.html — light
// screens sit on cream #F4F1EA with white cards on rgba(28,38,32,0.12)
// hairlines (13–16px radii); dark screens (timeline) sit on #1C2620.
// All helper types here are Data/Account-prefixed to avoid collisions with
// the concurrent V3Shell / MemberV3 agents.

enum ArcDataPalette {
    /// Warning / destructive tone (#B3543A in the prototype).
    static let rust = Color(hex: 0xB3543A)
    /// Low-confidence card fill / border (amber #D99A4E at 8% / 50%).
    static let lowConfidenceFill = Color(hex: 0xD99A4E).opacity(0.08)
    static let lowConfidenceBorder = Color(hex: 0xD99A4E).opacity(0.5)
    /// Positive (green) tint fills used on success cards + selected chips.
    static let greenFill = Color.arcPrimaryGreen.opacity(0.10)
    static let greenFillSoft = Color.arcPrimaryGreen.opacity(0.08)
    static let greenBorder = Color.arcPrimaryGreen.opacity(0.35)
    /// Card hairline on light (rgba(28,38,32,0.12)).
    static let hairline = Color.arcDarkSurface.opacity(0.12)
    /// Stronger hairline for bordered pills (rgba(28,38,32,0.2)).
    static let hairlineStrong = Color.arcDarkSurface.opacity(0.2)
    /// Sub-copy tone inside the dark plan card (#9FB0A6).
    static let planSub = Color(hex: 0x9FB0A6)
}

// MARK: Screen scaffolds

/// Light (cream) full-bleed screen with the prototype's 26px gutters.
struct DataV3Screen<Content: View>: View {
    var topPadding: CGFloat = 14
    @ViewBuilder var content: Content

    var body: some View {
        ZStack {
            Color.arcCream.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) { content }
                    .padding(.horizontal, 26)
                    .padding(.top, topPadding)
                    .padding(.bottom, 28)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
    }
}

/// Dark (#1C2620) full-bleed screen (timeline).
struct DataV3DarkScreen<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        ZStack {
            Color.arcDarkSurface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) { content }
                    .padding(.horizontal, 26)
                    .padding(.top, 14)
                    .padding(.bottom, 26)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
    }
}

/// "‹ Back" affordance (14px, #7C887F) used across the light screens.
struct DataV3BackLink: View {
    var label = "Back"
    var action: (() -> Void)?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Button {
            if let action { action() } else { dismiss() }
        } label: {
            Text("‹ \(label)")
                .font(.arcSans(14))
                .foregroundStyle(Color.arcSecondaryLight)
                .padding(.vertical, 10) // keeps the ≥44pt hit target
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.bottom, 4)
    }
}

// MARK: Card + row helpers

struct DataV3CardStyle: ViewModifier {
    var radius: CGFloat = 14
    var border: Color = ArcDataPalette.hairline
    var borderWidth: CGFloat = 1
    var fill: Color = .white

    func body(content: Content) -> some View {
        content
            .background(fill, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .strokeBorder(border, lineWidth: borderWidth)
            )
    }
}

extension View {
    func dataV3Card(
        radius: CGFloat = 14,
        border: Color = ArcDataPalette.hairline,
        borderWidth: CGFloat = 1,
        fill: Color = .white
    ) -> some View {
        modifier(DataV3CardStyle(radius: radius, border: border, borderWidth: borderWidth, fill: fill))
    }
}

/// Static (non-interactive) prototype toggle — 40×22 with a 19px knob.
/// Used where a consent is required and the "toggle" is really a doorway
/// (e.g. health-processing → account closure).
struct DataV3StaticToggle: View {
    var isOn: Bool

    var body: some View {
        ZStack(alignment: isOn ? .trailing : .leading) {
            Capsule()
                .fill(isOn ? Color.arcPrimaryGreen : Color.arcDarkSurface.opacity(0.18))
                .frame(width: 40, height: 22)
            Circle()
                .fill(.white)
                .frame(width: 19, height: 19)
                .padding(2)
        }
    }
}

// MARK: Formatting

enum DataV3Format {
    private static func formatter(_ format: String) -> DateFormatter {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_IE")
        f.dateFormat = format
        return f
    }

    /// "1 Aug"
    static func dayMonth(_ date: Date) -> String { formatter("d MMM").string(from: date) }
    /// "14 Feb 2026"
    static func shortDate(_ date: Date) -> String { formatter("d MMM yyyy").string(from: date) }
    /// "1 August 2026"
    static func longDate(_ date: Date) -> String { formatter("d MMMM yyyy").string(from: date) }
    /// "2 July, 14:05" style access-log stamp → we only need "d MMMM".
    static func dayLongMonth(_ date: Date) -> String { formatter("d MMMM").string(from: date) }
    /// "yyyy-MM-dd" for API `takenAt`.
    static func isoDay(_ date: Date) -> String { formatter("yyyy-MM-dd").string(from: date) }
    /// Parses "yyyy-MM-dd".
    static func fromISODay(_ string: String) -> Date? {
        formatter("yyyy-MM-dd").date(from: string)
    }

    /// Trims trailing zeros: 41 → "41", 5.1 → "5.1", 1.21 → "1.21".
    static func number(_ value: Double) -> String {
        if value == value.rounded() { return String(Int(value)) }
        return String(value)
    }

    /// "once" / "twice" / "3 times"
    static func timesWord(_ n: Int) -> String {
        switch n {
        case 1: return "once"
        case 2: return "twice"
        default: return "\(n) times"
        }
    }
}

// MARK: - DEBUG preview harness
// Every DataV3 screen is reachable + compilable before the shell wires them.

#if DEBUG
struct DataV3PreviewHarness: View {
    var body: some View {
        NavigationStack {
            List {
                NavigationLink("Add bloodwork") { AddBloodworkV3View() }
                NavigationLink("Confirm reading") { ConfirmReadingV3View() }
                NavigationLink("Type values by hand") { TypeValuesV3View() }
                NavigationLink("Timeline") { DataTimelineV3View() }
                NavigationLink("Share with GP") { GPShareV3View() }
            }
            .navigationTitle("YOUR DATA v3")
        }
        .environment(AppState())
        .environment(AppModel())
    }
}

#Preview("YOUR DATA harness") {
    DataV3PreviewHarness()
}
#endif
