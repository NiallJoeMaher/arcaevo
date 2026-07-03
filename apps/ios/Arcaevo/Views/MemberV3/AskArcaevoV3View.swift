import SwiftUI

/// MEMBER APP · ask Arcaevo ("Ask Arcaevo" in Prototype.dc.html).
/// Chat grounded in the member's own data: message list, suggested prompt
/// chips, composer. Replies come from `Mv3Narrator` — a deterministic local
/// mock (// MOCK: AI chat, see MemberV3Demo.swift). The AI narrates, never
/// diagnoses; flagged values route to the clinician (amber-bordered bubble).
struct AskArcaevoV3View: View {
    @Environment(\.dismiss) private var dismiss

    @State private var messages: [Mv3ChatMessage] = []
    @State private var askedKeys: Set<String> = []
    @State private var draft = ""
    @State private var sendTick = 0

    init() {}

    private var remainingPrompts: [Mv3ChatQA] {
        MemberV3Demo.chatQA.filter { !askedKeys.contains($0.key) }
    }

    var body: some View {
        ZStack {
            Color.arcDarkSurface.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Mv3BackLink(title: "Today") { dismiss() }
                    Spacer()
                }
                Mv3Eyebrow(text: "ASK ARCAEVO · GROUNDED IN YOUR DATA")
                    .padding(.bottom, 10)

                messageList

                promptChips

                composer

                Text("Narrates your numbers — never diagnoses. Flagged values go to a clinician, not a chatbot.")
                    .font(.arcSans(9.5))
                    .foregroundStyle(Color.arcRailDim)
                    .frame(maxWidth: .infinity)
                    .multilineTextAlignment(.center)
                    .padding(.top, 8)
            }
            .padding(.horizontal, 24)
            .padding(.top, 8)
            .padding(.bottom, 14)
        }
        .toolbar(.hidden, for: .navigationBar)
        .sensoryFeedback(.impact(weight: .light), trigger: sendTick)
    }

    // MARK: Messages (empty state → bubbles)

    private var messageList: some View {
        ScrollViewReader { scroll in
            ScrollView {
                VStack(alignment: .leading, spacing: 9) {
                    if messages.isEmpty {
                        VStack(spacing: 8) {
                            Text("Ask about your own numbers.")
                                .font(.arcSerif(24))
                                .foregroundStyle(Color.arcCream)
                                .multilineTextAlignment(.center)
                            Text("Answers come from your results and your Watch. The AI writes the words — your data does the maths.")
                                .font(.arcSans(12.5))
                                .lineSpacing(4)
                                .foregroundStyle(Color.arcMutedOnDark)
                                .multilineTextAlignment(.center)
                        }
                        .padding(.horizontal, 12)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 80)
                    } else {
                        ForEach(messages) { message in
                            bubble(message)
                                .id(message.id)
                        }
                    }
                }
                .frame(maxWidth: .infinity)
            }
            .onChange(of: messages) { _, newValue in
                if let last = newValue.last {
                    withAnimation(.easeOut(duration: 0.2)) {
                        scroll.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func bubble(_ message: Mv3ChatMessage) -> some View {
        HStack {
            if message.isUser { Spacer(minLength: 40) }
            Text(message.text)
                .font(.arcSans(12.5))
                .lineSpacing(4)
                .foregroundStyle(message.isUser ? .white : Mv3.chatAIText)
                .padding(.horizontal, 14)
                .padding(.vertical, 11)
                .background(
                    message.isUser ? Color.arcDeepGreen : Mv3.cardFill,
                    in: RoundedRectangle(cornerRadius: 16, style: .continuous)
                )
                .overlay {
                    if message.flagged {
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .strokeBorder(Mv3.amber.opacity(0.5), lineWidth: 1)
                    }
                }
            if !message.isUser { Spacer(minLength: 40) }
        }
        .frame(maxWidth: .infinity, alignment: message.isUser ? .trailing : .leading)
    }

    // MARK: Suggested prompts (the designed questions, minus ones asked)

    @ViewBuilder
    private var promptChips: some View {
        if !remainingPrompts.isEmpty {
            Mv3Flow(spacing: 7) {
                ForEach(remainingPrompts) { qa in
                    Button {
                        ask(qa.question)
                        askedKeys.insert(qa.key)
                    } label: {
                        Text(qa.question)
                            .font(.arcSans(11.5))
                            .foregroundStyle(Color.arcRailLight)
                            .padding(.vertical, 8)
                            .padding(.horizontal, 13)
                            .overlay(Capsule().strokeBorder(Color.white.opacity(0.2), lineWidth: 1))
                            .contentShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 10)
        }
    }

    // MARK: Composer

    private var composer: some View {
        HStack(spacing: 9) {
            TextField("", text: $draft, prompt: Text("Ask about your data…").foregroundStyle(Color.arcRailDim))
                .font(.arcSans(13))
                .foregroundStyle(Color.arcCream)
                .textInputAutocapitalization(.sentences)
                .submitLabel(.send)
                .onSubmit(sendDraft)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .overlay(Capsule().strokeBorder(Color.white.opacity(0.15), lineWidth: 1))
            Button(action: sendDraft) {
                Text("↑")
                    .font(.arcSans(16, weight: .semibold))
                    .foregroundStyle(Mv3.onGreenInk)
                    .frame(width: 42, height: 42)
                    .background(Color.arcPrimaryGreen, in: Circle())
                    .opacity(draft.trimmingCharacters(in: .whitespaces).isEmpty ? 0.45 : 1)
            }
            .buttonStyle(.plain)
            .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
        }
    }

    private func sendDraft() {
        let question = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty else { return }
        draft = ""
        ask(question)
    }

    /// Append the member's question and the mock narrator's grounded answer.
    private func ask(_ question: String) {
        messages.append(Mv3ChatMessage(text: question, isUser: true, flagged: false))
        // MOCK: AI chat — deterministic local narrator (no model called).
        let reply = Mv3Narrator.answer(to: question)
        messages.append(Mv3ChatMessage(text: reply.text, isUser: false, flagged: reply.flagged))
        sendTick += 1
    }
}
