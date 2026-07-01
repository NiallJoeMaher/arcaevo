import SwiftUI

/// Current test-kit order with a status timeline, order history, and add-on
/// ordering (calls the mock API; falls back to local demo data).
struct OrdersView: View {
    @Environment(AppModel.self) private var model
    @State private var isOrdering = false
    @State private var confirmationText: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if model.isDemoMode {
                    HStack {
                        Spacer()
                        DemoModeBadge()
                    }
                }

                if let current = model.currentOrder {
                    currentOrderCard(current)
                }

                addOnCard

                if pastOrders.isEmpty == false {
                    VStack(alignment: .leading, spacing: 10) {
                        Kicker(text: "History")
                        ForEach(pastOrders) { order in
                            pastOrderRow(order)
                        }
                    }
                    .padding(.top, 4)
                }

                DisclaimerFooter()
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
        }
        .background(Color.bone.ignoresSafeArea())
        .navigationTitle("Orders")
        .toolbarTitleDisplayMode(.large)
    }

    private var pastOrders: [TestOrder] {
        guard let current = model.currentOrder else { return model.orders }
        return model.orders.filter { $0.id != current.id }
    }

    // MARK: - Current order + timeline

    private func currentOrderCard(_ order: TestOrder) -> some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Kicker(text: order.kind == .venous ? "Venous draw" : "Test kit")
                    Spacer()
                    Text(order.orderedAt, style: .date)
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundStyle(Color.caption)
                }

                Text(order.panel)
                    .displaySerif(24)
                    .foregroundStyle(Color.ink)

                VStack(alignment: .leading, spacing: 0) {
                    ForEach(TestOrder.Status.allCases, id: \.self) { step in
                        TimelineStep(
                            step: step,
                            currentIndex: order.status.stepIndex,
                            isLast: step == TestOrder.Status.allCases.last
                        )
                    }
                }
            }
        }
    }

    // MARK: - Add-ons

    private var addOnCard: some View {
        InkCard {
            VStack(alignment: .leading, spacing: 12) {
                Kicker(text: "Add-on tests", color: .mutedOnDark)
                Text("Need an extra data point between scheduled tests?")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.boneWhite)

                addOnButton(title: "Full panel — €99", panel: "Full baseline panel (add-on)")
                addOnButton(title: "Recheck — €69", panel: "Recheck panel (add-on)")

                if let confirmation = confirmationText {
                    Text(confirmation)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.vitalityLight)
                }
            }
        }
    }

    private func addOnButton(title: String, panel: String) -> some View {
        Button {
            guard !isOrdering else { return }
            isOrdering = true
            Task {
                await model.orderAddOn(kind: .kit, panel: panel)
                confirmationText = "Order placed — you'll see it in the timeline above."
                isOrdering = false
            }
        } label: {
            HStack {
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                Spacer()
                if isOrdering {
                    ProgressView()
                        .tint(Color.ink)
                } else {
                    Image(systemName: "plus.circle.fill")
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color.boneWhite)
            .foregroundStyle(Color.ink)
            .clipShape(Capsule())
        }
        .disabled(isOrdering)
    }

    // MARK: - History rows

    private func pastOrderRow(_ order: TestOrder) -> some View {
        SurfaceCard {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(order.panel)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.ink)
                    Text(order.orderedAt, style: .date)
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundStyle(Color.caption)
                }
                Spacer()
                Text(order.status.displayName.uppercased())
                    .font(.system(size: 10, weight: .semibold, design: .monospaced))
                    .kerning(0.8)
                    .foregroundStyle(order.status == .resultsReady ? Color.vitality : Color.mutedInk)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(
                        (order.status == .resultsReady ? Color.vitality : Color.ink)
                            .opacity(0.1)
                    )
                    .clipShape(Capsule())
            }
        }
    }
}

/// One row of the ordered → shipped → … → results-ready timeline.
private struct TimelineStep: View {
    let step: TestOrder.Status
    let currentIndex: Int
    let isLast: Bool

    private var state: StepState {
        if step.stepIndex < currentIndex { return .done }
        if step.stepIndex == currentIndex { return .current }
        return .upcoming
    }

    private enum StepState {
        case done, current, upcoming
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(spacing: 0) {
                ZStack {
                    Circle()
                        .fill(dotColor)
                        .frame(width: 14, height: 14)
                    if state == .done {
                        Image(systemName: "checkmark")
                            .font(.system(size: 7, weight: .bold))
                            .foregroundStyle(.white)
                    }
                }
                if !isLast {
                    Rectangle()
                        .fill(state == .done ? Color.vitality : Color.ink.opacity(0.12))
                        .frame(width: 2, height: 26)
                }
            }

            Text(step.displayName)
                .font(.system(size: 14, weight: state == .current ? .bold : .regular))
                .foregroundStyle(state == .upcoming ? Color.caption : Color.ink)
                .padding(.top, -1)

            Spacer()

            if state == .current {
                Text("NOW")
                    .font(.system(size: 9, weight: .semibold, design: .monospaced))
                    .kerning(1)
                    .foregroundStyle(Color.forest)
            }
        }
    }

    private var dotColor: Color {
        switch state {
        case .done: return .vitality
        case .current: return .forest
        case .upcoming: return Color.ink.opacity(0.15)
        }
    }
}
