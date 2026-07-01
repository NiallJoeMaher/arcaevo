import SwiftUI

@main
struct ArcaevoApp: App {
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .tint(.forest)
                .task {
                    await model.loadAll()
                }
        }
    }
}
