import Foundation

@MainActor
final class GameStorage {
    private let url: URL
    private(set) var values: [String: String] = [:]

    init(directory: URL = URL.applicationSupportDirectory.appending(path: "DailyPuzzle", directoryHint: .isDirectory)) {
        url = directory.appending(path: "progress.json", directoryHint: .notDirectory)
        if let data = try? Data(contentsOf: url),
           let saved = try? JSONDecoder().decode([String: String].self, from: data) {
            values = saved
        }
    }

    func save(key: String, value: String) throws {
        guard key.hasPrefix("daily-puzzle-"), key.count <= 128, value.utf8.count <= 128_000 else {
            return
        }
        if values[key] == value { return }
        var updated = values
        updated[key] = value
        let data = try JSONEncoder().encode(updated)
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try data.write(to: url, options: .atomic)
        values = updated
    }

    func bridgeScript() throws -> String {
        let snapshot = String(decoding: try JSONEncoder().encode(values), as: UTF8.self)
        return """
        (() => {
          const values = Object.assign(Object.create(null), \(snapshot));
          const bridge = window.webkit.messageHandlers.dailyPuzzle;
          window.DailyPuzzleNative = Object.freeze({
            get: key => values[key] ?? null,
            set: (key, value) => {
              values[key] = value;
              bridge.postMessage({ action: 'store', key, value });
            },
            share: text => bridge.postMessage({ action: 'share', text })
          });
        })();
        """
    }
}
