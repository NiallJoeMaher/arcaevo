import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// v3 typography (design_handoff_ios_watch/README.md):
///  - Display:   Instrument Serif — screen titles 24–40px
///  - Body/UI:   Hanken Grotesk  — 12.5–14px body, 600–700 buttons
///  - Data:      Geist Mono      — 9.5–11px uppercase eyebrows / values
///
/// The TTFs are bundled into both targets (apps/ios/Fonts, OFL-licensed,
/// registered via UIAppFonts). Every helper checks the face actually loaded
/// and falls back to the closest system font, so a missing/corrupt font file
/// degrades gracefully instead of rendering blank.
public enum ArcTypography {
    // PostScript names as verified in the bundled TTFs.
    static let serifRegular = "InstrumentSerif-Regular"
    static let serifItalic = "InstrumentSerif-Italic"
    static let monoRegular = "GeistMono-Regular"
    static let monoMedium = "GeistMono-Medium"

    static func sansName(for weight: Font.Weight) -> String {
        switch weight {
        case .ultraLight, .thin, .light: return "HankenGrotesk-Light"
        case .regular: return "HankenGrotesk-Regular"
        case .medium: return "HankenGrotesk-Medium"
        case .semibold: return "HankenGrotesk-SemiBold"
        case .bold: return "HankenGrotesk-Bold"
        case .heavy, .black: return "HankenGrotesk-ExtraBold"
        default: return "HankenGrotesk-Regular"
        }
    }

    /// Cached "did this face register?" lookups — one CoreText hit per name.
    private static var availability: [String: Bool] = [:]
    private static let lock = NSLock()

    static func isAvailable(_ name: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        if let cached = availability[name] { return cached }
        #if canImport(UIKit)
        let found = UIFont(name: name, size: 12) != nil
        #else
        let found = false
        #endif
        availability[name] = found
        return found
    }

    /// True when all three families registered — surfaced in dev UI so a
    /// bundling regression is loud, not silent.
    public static var allFamiliesLoaded: Bool {
        isAvailable(serifRegular) && isAvailable(sansName(for: .regular)) && isAvailable(monoRegular)
    }
}

extension Font {
    /// Display face — Instrument Serif 400 (screen titles 24–40px,
    /// line-height 1.05–1.15 via .lineSpacing at call sites).
    public static func arcSerif(_ size: CGFloat, italic: Bool = false) -> Font {
        let name = italic ? ArcTypography.serifItalic : ArcTypography.serifRegular
        guard ArcTypography.isAvailable(name) else {
            let base = Font.system(size: size, design: .serif)
            return italic ? base.italic() : base
        }
        return .custom(name, size: size)
    }

    /// Body/UI face — Hanken Grotesk statics 300–800.
    public static func arcSans(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        let name = ArcTypography.sansName(for: weight)
        guard ArcTypography.isAvailable(name) else {
            return .system(size: size, weight: weight)
        }
        return .custom(name, size: size)
    }

    /// Labels/data face — Geist Mono 400/500 (uppercase eyebrows, values).
    public static func arcMono(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        let wantsMedium: Bool
        switch weight {
        case .regular, .light, .thin, .ultraLight: wantsMedium = false
        default: wantsMedium = true
        }
        let name = wantsMedium ? ArcTypography.monoMedium : ArcTypography.monoRegular
        guard ArcTypography.isAvailable(name) else {
            return .system(size: size, weight: weight, design: .monospaced)
        }
        return .custom(name, size: size)
    }
}
