import SwiftUI

@main
struct DailyPuzzleApp: App {
    var body: some Scene {
        WindowGroup {
            GameView()
                .background(Color(uiColor: .systemBackground))
        }
    }
}
