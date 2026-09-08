import Foundation
import UniformTypeIdentifiers

@main
struct ShareItemLoaderTests {
  static func main() async throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    let loader = try ShareItemLoader(container: directory, policy: .safeDefault)
    func page(_ url: String) -> NSItemProvider {
      NSItemProvider(item: [NSExtensionJavaScriptPreprocessingResultsKey: ["pageUrl": url, "pageTitle": "Safari article", "readableText": "An article worth keeping."]] as NSDictionary, typeIdentifier: UTType.propertyList.identifier)
    }
    func input(_ providers: [NSItemProvider]) -> NSExtensionItem {
      let value = NSExtensionItem(); value.attachments = providers; return value
    }
    let items = try await loader.load([input([page("https://example.com/article")])])
    precondition(items.count == 1 && items[0].type == "bookmark", "Safari's property-list-only handoff must create one bookmark")
    precondition(items[0].sourceURL == "https://example.com/article" && items[0].sourceTitle == "Safari article", "Keep the original page identity")
    precondition(items[0].pageContext?["readableText"] as? String == "An article worth keeping.", "Keep the saved article content")
    let combined = try await loader.load([input([page("https://example.com/article"), NSItemProvider(item: URL(string: "https://example.com/article")! as NSURL, typeIdentifier: UTType.url.identifier)])])
    precondition(combined.count == 1, "A URL attachment and its preprocessing context must not create duplicates")
    for url in ["file:///private/example", "javascript:alert(1)", "https://user:password@example.com", "https:///", "https://example.com/" + String(repeating: "x", count: 4096)] {
      do { _ = try await loader.load([input([page(url)])]); preconditionFailure("Reject unsafe or malformed fallback URLs") }
      catch FoundkeepItemError.unavailable { }
    }
    var capture = FoundkeepSharePolicy.safeDefault.capture; capture["bookmark"] = false
    let disabled = FoundkeepSharePolicy(capture: capture, fileBytes: 1024, textCharacters: 1000, articleCharacters: 10000, batchItems: 20, uploadTimeout: 15, notice: nil)
    do { _ = try await ShareItemLoader(container: directory, policy: disabled).load([input([page("https://example.com")])]); preconditionFailure("Fallback must respect the bookmark feature policy") }
    catch FoundkeepItemError.disabled { }
    print("Passed 10 native Safari item-loader checks.")
  }
}
