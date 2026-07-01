import SwiftUI

/// Readiness-style ring, shared by the iOS dashboard and the watch app.
struct ReadinessRing: View {
    let score: Int
    var size: CGFloat = 96
    var lineWidth: CGFloat = 10
    var trackColor: Color = .white.opacity(0.12)
    var labelColor: Color = .boneWhite
    var captionColor: Color = .mutedOnDark

    var body: some View {
        ZStack {
            Circle()
                .stroke(trackColor, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: CGFloat(score) / 100)
                .stroke(Color.vitality, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 2) {
                Text("\(score)")
                    .font(.system(size: size * 0.3, weight: .medium, design: .monospaced))
                    .foregroundStyle(labelColor)
                Text("TODAY")
                    .font(.system(size: size * 0.09, weight: .medium, design: .monospaced))
                    .kerning(1)
                    .foregroundStyle(captionColor)
            }
        }
        .frame(width: size, height: size)
    }
}
