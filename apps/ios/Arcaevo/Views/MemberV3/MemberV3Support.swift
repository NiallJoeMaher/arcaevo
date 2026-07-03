import SwiftUI

// MARK: - MemberV3 shared chrome
//
// Everything here is namespaced `Mv3…` so it can't collide with the helpers
// concurrent screen-wave agents are building in sibling dirs. Pixel values
// come straight off Prototype.dc.html (member-app sections).

enum Mv3 {
    /// Extra member-app tints read verbatim off the prototype's inline styles.
    static let watchAmber = Color(hex: 0xE9BC85)   // "3 WATCH" chip / amber sub-lines
    static let actRose = Color(hex: 0xE2A08D)      // "1 ACT" chip text
    static let onGreenInk = Color(hex: 0x04130D)   // text on #34A07C CTAs
    static let bodyOnDark = Color(hex: 0xCFD6CF)   // 12.5px body copy on dark
    static let chatAIText = Color(hex: 0xE8E4DA)   // AI bubble text
    static let amber = Color(hex: 0xD99A4E)        // flagged-bubble border base

    /// rgba(255,255,255,0.06) card fill used across every member screen.
    static let cardFill = Color.white.opacity(0.06)
}

/// Geist Mono uppercase micro-label on dark (the member screens' eyebrows).
struct Mv3Eyebrow: View {
    var text: String
    var size: CGFloat = 10
    var color: Color = .arcMutedOnDark
    var kerning: CGFloat = 1.0 // ≈ 0.1em at 10px

    var body: some View {
        Text(text)
            .font(.arcMono(size, weight: .regular))
            .kerning(kerning)
            .foregroundStyle(color)
    }
}

/// rgba(255,255,255,0.06) rounded card.
struct Mv3CardStyle: ViewModifier {
    var radius: CGFloat = 15
    var hPad: CGFloat = 16
    var vPad: CGFloat = 14

    func body(content: Content) -> some View {
        content
            .padding(.horizontal, hPad)
            .padding(.vertical, vPad)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Mv3.cardFill, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
    }
}

extension View {
    func mv3Card(radius: CGFloat = 15, hPad: CGFloat = 16, vPad: CGFloat = 14) -> some View {
        modifier(Mv3CardStyle(radius: radius, hPad: hPad, vPad: vPad))
    }
}

/// Pill chip per the prototype picker rows. Green accent = biomarker/expt
/// chips; gold accent = wearable-signal chips (self-reported gold family).
struct Mv3Chip: View {
    enum Accent { case green, gold }

    var label: String
    var isOn: Bool
    var accent: Accent = .green
    var font: Font = .arcMono(10, weight: .regular)
    var kerning: CGFloat = 0.5
    var hPad: CGFloat = 13
    var vPad: CGFloat = 7
    var offText: Color = .arcMutedOnDark
    var action: () -> Void

    private var onText: Color { accent == .green ? .arcBrightGreen : .arcHollowGold }
    private var onFill: Color {
        accent == .green ? Color.arcPrimaryGreen.opacity(0.16) : Color.arcHollowGold.opacity(0.14)
    }
    private var onBorder: Color {
        accent == .green ? Color.arcPrimaryGreen.opacity(0.7) : Color.arcHollowGold.opacity(0.7)
    }

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(font)
                .kerning(kerning)
                .lineLimit(1)
                .foregroundStyle(isOn ? onText : offText)
                .padding(.vertical, vPad)
                .padding(.horizontal, hPad)
                .background(isOn ? onFill : .clear, in: Capsule())
                .overlay(Capsule().strokeBorder(isOn ? onBorder : Color.white.opacity(0.16), lineWidth: 1))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .frame(minHeight: 34)
    }
}

/// The member screens' "‹ Results"-style back affordance (nav bar hidden).
struct Mv3BackLink: View {
    var title: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text("‹ \(title)")
                .font(.arcSans(13))
                .foregroundStyle(Color.arcMutedOnDark)
                .frame(minHeight: 44, alignment: .leading) // ≥44px hit target
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// Cream pill CTA on dark (e.g. "Keep the plan — see the experiment").
struct Mv3CreamCTA: View {
    var title: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.arcSans(13.5, weight: .semibold))
                .foregroundStyle(Color.arcDarkSurface)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(Color.arcCream, in: Capsule())
        }
        .buttonStyle(.plain)
    }
}

/// Primary green pill CTA (start experiment).
struct Mv3GreenCTA: View {
    var title: String
    var enabled = true
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.arcSans(14, weight: .bold))
                .foregroundStyle(Mv3.onGreenInk)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.arcPrimaryGreen, in: Capsule())
                .opacity(enabled ? 1 : 0.45)
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }
}

/// Bordered ("ghost") pill on dark, e.g. "Start something else ›".
struct Mv3GhostCTA: View {
    var title: String
    var borderOpacity: Double = 0.2
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.arcSans(13, weight: .semibold))
                .foregroundStyle(Color.arcCream)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .overlay(Capsule().strokeBorder(Color.white.opacity(borderOpacity), lineWidth: 1))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

/// Simple left-aligned wrapping layout for chip rows (flex-wrap equivalent).
struct Mv3Flow: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > maxWidth {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        let width = maxWidth.isFinite ? maxWidth : max(0, x - spacing)
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
            subview.place(at: CGPoint(x: x, y: y), proposal: .unspecified)
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
