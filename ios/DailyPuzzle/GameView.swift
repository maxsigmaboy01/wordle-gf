import OSLog
import SwiftUI
import WebKit

struct GameView: UIViewControllerRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIViewController(context: Context) -> GameViewController {
        let controller = GameViewController()
        context.coordinator.controller = controller
        controller.load(using: context.coordinator)
        return controller
    }

    func updateUIViewController(_ controller: GameViewController, context: Context) {}

    static func dismantleUIViewController(_ controller: GameViewController, coordinator: Coordinator) {
        controller.detachBridge()
    }

    @MainActor
    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        let storage = GameStorage()
        weak var controller: GameViewController?
        private let logger = Logger(subsystem: "com.maxsigmaboy01.dailypuzzle", category: "Storage")

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.frameInfo.isMainFrame, message.frameInfo.request.url?.isFileURL == true,
                  let body = message.body as? [String: String] else { return }
            switch body["action"] {
            case "store":
                guard let key = body["key"], let value = body["value"] else { return }
                do {
                    try storage.save(key: key, value: value)
                } catch {
                    logger.error("Could not persist puzzle progress: \(error.localizedDescription, privacy: .public)")
                }
            case "share":
                if let text = body["text"], text.count <= 200 {
                    controller?.share(text)
                }
            default:
                break
            }
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void) {
            let isGame = navigationAction.request.url == Bundle.main.url(forResource: "game", withExtension: "html")
            decisionHandler(isGame ? .allow : .cancel)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            controller?.showError()
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            controller?.showError()
        }
    }
}

final class GameViewController: UIViewController {
    private var webView: WKWebView?

    func load(using coordinator: GameView.Coordinator) {
        view.backgroundColor = .systemBackground
        guard let game = Bundle.main.url(forResource: "game", withExtension: "html"),
              let bridge = try? coordinator.storage.bridgeScript() else {
            showError()
            return
        }

        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(coordinator, name: "dailyPuzzle")
        configuration.userContentController.addUserScript(
            WKUserScript(source: bridge, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        self.webView = webView
        webView.loadFileURL(game, allowingReadAccessTo: game)
    }

    func detachBridge() {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "dailyPuzzle")
    }

    func share(_ text: String) {
        guard presentedViewController == nil else { return }
        let sheet = UIActivityViewController(activityItems: [text], applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = view
        sheet.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY, width: 1, height: 1)
        present(sheet, animated: true)
    }

    func showError() {
        webView?.isHidden = true
        let label = UILabel()
        label.text = "Couldn’t open Daily Puzzle."
        label.font = .preferredFont(forTextStyle: .headline)
        label.adjustsFontForContentSizeCategory = true
        label.numberOfLines = 0
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            label.widthAnchor.constraint(lessThanOrEqualTo: view.widthAnchor, multiplier: 0.86)
        ])
    }
}
