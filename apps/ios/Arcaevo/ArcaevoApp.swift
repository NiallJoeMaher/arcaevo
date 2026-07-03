import SwiftUI

@main
struct ArcaevoApp: App {
    @State private var model = AppModel()
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .environment(appState)
                .tint(.forest)
                .task {
                    await model.loadAll()
                }
                // Magic-link entry points:
                //  - https://arcaevo.com/verify?token=…  (universal link —
                //    requires the associated-domains entitlement, commented
                //    in project.yml until a real team/AASA exists)
                //  - arcaevo://verify?token=…            (custom scheme, live now)
                .onOpenURL { url in
                    appState.handleIncomingURL(url)
                }
        }
    }
}
