import SwiftUI

/// MEMBER APP · Vitality Age ("Vitality Age" in Prototype.dc.html).
///
/// The slow score (ALGORITHM §3): a banded age vs the calendar age, the
/// monthly-cadence framing ("only moves when it's real"), the RCV-gated driver
/// table (VO₂max doing the lifting, ferritin holding it back — the same marker
/// that caps readiness), and the €69 recheck CTA — the only thing we ever sell,
/// never a supplement.
struct VitalityV3View: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppModel.self) private var model

    @State private var ordering = false
    @State private var ordered = false

    init() {}

    var body: some View {
        ZStack {
            Color.arcDarkSurface.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Mv3BackLink(title: "Today") { dismiss() }
                    Mv3Eyebrow(text: "VITALITY AGE · THE SLOW SCORE")
                        .padding(.bottom, 10)

                    if let score = model.vitalityScore {
                        headline(score)
                        youngerLine(score)
                        historyCard(score)
                        driversCard(score)
                        howScoredCard
                        recheckCTA
                        footnote
                    } else {
                        placeholder
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 4)
                .padding(.bottom, 20)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task { if model.vitalityScore == nil { await model.loadAll() } }
    }

    // MARK: Big number

    private func headline(_ score: VitalityScore) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text("\(score.age)")
                .font(.arcMono(38, weight: .medium))
                .foregroundStyle(Color.arcCream)
            Text("±\(score.band) · calendar \(calendarAge)")
                .font(.arcSans(13))
                .foregroundStyle(Color.arcMutedOnDark)
            Text("−0.8 since Feb")
                .font(.arcMono(12))
                .foregroundStyle(Color.arcBrightGreen)
        }
        .padding(.bottom, 6)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Vitality age \(Mv3.spell(score.age)), plus or minus \(score.band). Calendar age \(Mv3.spell(calendarAge)).")
    }

    private func youngerLine(_ score: VitalityScore) -> some View {
        let diff = calendarAge - score.age
        return Text(diff > 0
            ? "\(Mv3.spell(diff).capitalized) years younger than your passport says."
            : "In step with your calendar age.")
            .font(.arcSerif(22))
            .foregroundStyle(Color.arcCream)
            .lineSpacing(1)
            .padding(.bottom, 14)
    }

    // MARK: Monthly trend (design-static explainer history — the engine holds
    // only the current month, not the monthly series).

    private func historyCard(_ score: VitalityScore) -> some View {
        VStack(spacing: 8) {
            VitalityTrendChart()
                .frame(height: 80)
            HStack {
                Text("FEB 25 · 31.2")
                Spacer()
                Text("FEB 26 · 29.8")
                Spacer()
                Text("JUL 26 · \(String(format: "%.1f", Double(score.age)))")
            }
            .font(.arcMono(9))
            .foregroundStyle(Color.arcMutedOnDark)
        }
        .padding(.horizontal, 14)
        .padding(.top, 14)
        .padding(.bottom, 10)
        .frame(maxWidth: .infinity)
        .background(Mv3.cardFill, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .padding(.bottom, 9)
    }

    // MARK: Drivers (RCV-gated)

    private func driversCard(_ score: VitalityScore) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Mv3Eyebrow(text: "WHAT'S MOVING IT · ONLY REAL CHANGES COUNT", size: 8.5, kerning: 0.8)
                .padding(.top, 12)
                .padding(.bottom, 4)
            ForEach(score.drivers.indices, id: \.self) { i in
                driverRow(score.drivers[i], isLast: i == score.drivers.count - 1)
            }
        }
        .padding(.horizontal, 15)
        .padding(.bottom, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Mv3.cardFill, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
        .padding(.bottom, 9)
    }

    private func driverRow(_ driver: VitalityDriver, isLast: Bool) -> some View {
        VStack(spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Text(driver.label)
                    .font(.arcSans(12.5, weight: .semibold))
                    .foregroundStyle(Color.arcCream)
                Spacer(minLength: 10)
                Text(driverValue(driver))
                    .font(.arcMono(11.5))
                    .foregroundStyle(driver.holdingBack ? Mv3.watchAmber : Color.arcBrightGreen)
                    .multilineTextAlignment(.trailing)
            }
            .padding(.vertical, 10)
            if !isLast {
                Rectangle().fill(Color.white.opacity(0.07)).frame(height: 1)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func driverValue(_ driver: VitalityDriver) -> String {
        let years = driver.years
        let magnitude = String(format: "%.1f", abs(years))
        let signed = "\(years < 0 ? "−" : "+")\(magnitude) yrs"
        return driver.holdingBack ? "\(signed) · holding it back" : signed
    }

    // MARK: How it's scored

    private var howScoredCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Mv3Eyebrow(text: "HOW IT'S SCORED", size: 9, kerning: 0.9)
            Text("Anchored to your blood draws; your Watch moves it between them. A driver only counts when its change is bigger than your own test noise — the same maths as your verdicts. It moves monthly, never daily.")
                .font(.arcSans(12.5))
                .foregroundStyle(Color.arcRailLight)
                .lineSpacing(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 15)
        .padding(.vertical, 13)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Mv3.cardFill, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
        .padding(.bottom, 12)
    }

    // MARK: €69 recheck — the only sell (never a supplement)

    private var recheckCTA: some View {
        Button {
            order()
        } label: {
            Text(ordered ? "Recheck kit ordered · we'll be in touch"
                 : (ordering ? "Ordering…" : "Close the loop — January recheck kit · €69"))
                .font(.arcSans(13.5, weight: .semibold))
                .foregroundStyle(Color.arcDarkSurface)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(ordered ? Color.arcBrightGreen : Color.arcCream, in: Capsule())
        }
        .buttonStyle(.plain)
        .frame(minHeight: 44)
        .disabled(ordering || ordered)
    }

    private func order() {
        guard !ordering, !ordered else { return }
        ordering = true
        let holdingBack = model.vitalityScore?.drivers.first(where: \.holdingBack)
        let markerId = holdingBack?.marker ?? "ferritin"
        let markerName = holdingBack.map { firstWord($0.label) } ?? "Ferritin"
        Task {
            await model.orderRecheck(RecheckOrder(markerId: markerId), markerName: markerName)
            ordering = false
            withAnimation(.easeInOut(duration: 0.25)) { ordered = true }
        }
    }

    private func firstWord(_ label: String) -> String {
        label.components(separatedBy: " ").first ?? label
    }

    private var footnote: some View {
        Text("The recheck is the only thing we'll ever sell you here. Never a supplement.")
            .font(.arcSans(10))
            .foregroundStyle(Color.arcRailDim)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.top, 10)
    }

    private var placeholder: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Your slow score is warming up.")
                .font(.arcSerif(22))
                .foregroundStyle(Color.arcCream)
            Text("Vitality Age appears once your first blood panel is in — it moves monthly, never daily.")
                .font(.arcSans(12.5))
                .foregroundStyle(Color.arcMutedOnDark)
                .lineSpacing(3)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Mv3.cardFill, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    /// Calendar age from the stored DOB (persona default 14/03/1991 → 35),
    /// mirroring AppModel's private computation.
    private var calendarAge: Int {
        let calendar = Calendar.current
        let timestamp = UserDefaults.standard.double(forKey: "arcaevo.aboutYou.dob")
        let dob = timestamp > 0
            ? Date(timeIntervalSince1970: timestamp)
            : (calendar.date(from: DateComponents(year: 1991, month: 3, day: 14)) ?? Date())
        return max(18, calendar.dateComponents([.year], from: dob, to: Date()).year ?? 35)
    }
}

/// The monthly Vitality trend — a static ±2 band with three anchored draws
/// (design explainer chart; the engine holds only the current month).
private struct VitalityTrendChart: View {
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let x: (CGFloat) -> CGFloat = { $0 / 300 * w }
            let y: (CGFloat) -> CGFloat = { $0 / 84 * h }
            ZStack(alignment: .topLeading) {
                Rectangle()
                    .fill(Color.arcPrimaryGreen.opacity(0.1))
                    .frame(width: w, height: y(22))
                    .offset(y: y(34))
                Text("±2 BAND")
                    .font(.arcMono(8))
                    .foregroundStyle(Color.arcRailDim)
                    .offset(x: x(6), y: y(42))
                Path { p in
                    p.move(to: CGPoint(x: x(20), y: y(26)))
                    p.addLine(to: CGPoint(x: x(150), y: y(36)))
                    p.addLine(to: CGPoint(x: x(268), y: y(44)))
                }
                .stroke(Color.arcPrimaryGreen, style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                Circle().stroke(Color.arcHollowGold, lineWidth: 2.5)
                    .frame(width: 10, height: 10)
                    .position(x: x(20), y: y(26))
                Circle().fill(Color.arcPrimaryGreen)
                    .frame(width: 10, height: 10)
                    .position(x: x(150), y: y(36))
                Circle().fill(Color.arcPrimaryGreen)
                    .frame(width: 12, height: 12)
                    .position(x: x(268), y: y(44))
            }
        }
    }
}

#if DEBUG
#Preview("Vitality Age") {
    MemberV3ScreenPreview { NavigationStack { VitalityV3View() } }
}
#endif
