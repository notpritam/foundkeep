import Foundation
import Security

enum FoundkeepUploadError: LocalizedError {
  case signedOut
  case storage
  case server
  var errorDescription: String? {
    switch self { case .signedOut: return "Open Foundkeep once to connect this iPhone."; case .storage: return "Foundkeep could not keep a safe local copy."; case .server: return "Saved for upload when Foundkeep is online." }
  }
}

struct FoundkeepSaveResult { let uploaded: Int; let queued: Int }

final class ShareUploader {
  private let manager = FileManager.default
  private let container: URL
  private let queue: URL
  private let policy = FoundkeepSharePolicy.current

  init() throws {
    guard let container = manager.containerURL(forSecurityApplicationGroupIdentifier: "group.app.foundkeep.ios") else { throw FoundkeepUploadError.storage }
    self.container = container
    queue = container.appendingPathComponent("queue", isDirectory: true)
    try manager.createDirectory(at: queue, withIntermediateDirectories: true)
  }

  var isConnected: Bool { (try? token()) != nil }

  func save(_ items: [FoundkeepShareItem], note: String) async throws -> FoundkeepSaveResult {
    guard let token = try token() else { throw FoundkeepUploadError.signedOut }
    let batchId = UUID().uuidString
    var uploaded = 0
    for item in items {
      let recordURL = try enqueue(item, batchId: batchId, note: note)
      do { try await submit(recordURL, token: token); uploaded += 1 } catch { }
    }
    return FoundkeepSaveResult(uploaded: uploaded, queued: items.count - uploaded)
  }

  private func enqueue(_ item: FoundkeepShareItem, batchId: String, note: String) throws -> URL {
    let metadata = captureMetadata(item, batchId: batchId, note: note)
    if item.payloadPath != nil {
      let header = try JSONSerialization.data(withJSONObject: metadata)
      guard header.count <= 16 * 1024 else { throw FoundkeepUploadError.storage }
    }
    var record: [String: Any] = [
      "id": UUID().uuidString, "clientId": item.clientId, "batchId": batchId,
      "metadata": metadata,
      "attempts": 0, "nextAttemptAt": 0, "createdAt": Date().timeIntervalSince1970 * 1000,
    ]
    if let payloadPath = item.payloadPath { record["payloadPath"] = payloadPath }
    let data = try JSONSerialization.data(withJSONObject: record)
    let url = queue.appendingPathComponent("\(item.clientId).json")
    try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    return url
  }

  private func submit(_ recordURL: URL, token: String) async throws {
    let data = try Data(contentsOf: recordURL)
    guard let record = try JSONSerialization.jsonObject(with: data) as? [String: Any], let metadata = record["metadata"] as? [String: Any] else { throw FoundkeepUploadError.storage }
    let metadataData = try JSONSerialization.data(withJSONObject: metadata)
    var request: URLRequest
    if let path = record["payloadPath"] as? String {
      let payloadURL = container.appendingPathComponent(path)
      let size = (try manager.attributesOfItem(atPath: payloadURL.path)[.size] as? NSNumber)?.intValue ?? 0
      request = URLRequest(url: URL(string: "https://foundkeep.app/api/mobile/captures/file")!)
      request.httpMethod = "POST"
      request.setValue(base64URL(metadataData), forHTTPHeaderField: "X-Foundkeep-Capture")
      request.setValue(metadata["declaredMime"] as? String ?? "application/octet-stream", forHTTPHeaderField: "Content-Type")
      request.setValue(String(size), forHTTPHeaderField: "Content-Length")
      request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
      request.timeoutInterval = policy.uploadTimeout
      let (_, response) = try await URLSession.shared.upload(for: request, fromFile: payloadURL)
      guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else { throw FoundkeepUploadError.server }
      try? manager.removeItem(at: payloadURL)
    } else {
      request = URLRequest(url: URL(string: "https://foundkeep.app/api/captures")!)
      request.httpMethod = "POST"
      request.setValue("application/json", forHTTPHeaderField: "Content-Type")
      request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
      request.httpBody = metadataData
      request.timeoutInterval = policy.uploadTimeout
      let (_, response) = try await URLSession.shared.data(for: request)
      guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else { throw FoundkeepUploadError.server }
    }
    try manager.removeItem(at: recordURL)
  }

  private func captureMetadata(_ item: FoundkeepShareItem, batchId: String, note: String) -> [String: Any] {
    let now = Int(Date().timeIntervalSince1970 * 1000)
    let hasPayload = item.payloadPath != nil
    var metadata: [String: Any] = [
      "clientId": item.clientId, "batchId": batchId, "type": item.type,
      "capturedAt": now, "processingOptions": ["ocr": true, "summaries": true, "tags": true],
    ]
    if !hasPayload, let value = item.sourceURL { metadata["sourceUrl"] = value }
    if !hasPayload, let value = item.sourceTitle { metadata["sourceTitle"] = value }
    if let value = item.selectionText { metadata["selectionText"] = value }
    if !hasPayload, let value = item.pageContext?["readableText"] as? String, !value.isEmpty { metadata["articleText"] = String(value.prefix(policy.articleCharacters)) }
    if !note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { metadata["noteText"] = String(note.prefix(hasPayload ? 500 : 50_000)) }
    if let value = item.fileName { metadata["fileName"] = value }
    if let value = item.mime { metadata["declaredMime"] = value }
    metadata["provenance"] = provenance(item, capturedAt: now, compact: hasPayload)
    return metadata
  }

  private func provenance(_ item: FoundkeepShareItem, capturedAt: Int, compact: Bool) -> [String: Any] {
    let context = item.pageContext ?? [:]
    let method = item.type == "bookmark" ? "ios-share-url" : item.type == "selection" ? "ios-share-text" : "ios-share-\(item.type)"
    let pageUrl: Any = context["pageUrl"] ?? item.sourceURL ?? NSNull()
    let compactTitle: Any
    if let title = item.sourceTitle {
      compactTitle = String(title.prefix(250))
    } else {
      compactTitle = NSNull()
    }
    let pageTitle: Any = compact ? compactTitle : (context["pageTitle"] ?? item.sourceTitle ?? NSNull())
    let canonicalUrl: Any = compact ? NSNull() : (context["canonicalUrl"] ?? NSNull())
    let siteName: Any = compact ? NSNull() : (context["siteName"] ?? NSNull())
    let description: Any = compact ? NSNull() : (context["description"] ?? NSNull())
    let authors: Any = compact ? [String]() : (context["authors"] ?? [String]())
    let leadImageUrl: Any = compact ? NSNull() : (context["leadImageUrl"] ?? NSNull())
    let faviconUrl: Any = compact ? NSNull() : (context["faviconUrl"] ?? NSNull())
    let headings: Any = compact ? [String]() : (context["headings"] ?? [String]())
    var value: [String: Any] = [
      "schemaVersion": 1, "captureMethod": method,
      "pageUrl": pageUrl,
      "canonicalUrl": canonicalUrl, "pageTitle": pageTitle,
      "siteName": siteName, "description": description,
      "authors": authors, "publishedAt": context["publishedAt"] ?? NSNull(), "modifiedAt": context["modifiedAt"] ?? NSNull(),
      "language": context["language"] ?? NSNull(), "leadImageUrl": leadImageUrl, "faviconUrl": faviconUrl,
      "targetUrl": NSNull(), "headings": headings, "capturedAt": capturedAt, "extractedAt": capturedAt,
      "extractorVersion": 1, "contentHash": item.contentHash ?? NSNull(), "extractionStatus": "complete", "extractionError": NSNull(),
    ]
    if let fileName = item.fileName { value["originalFileName"] = fileName }
    if let mime = item.mime { value["declaredMime"] = mime }
    if item.bytes > 0 { value["byteSize"] = item.bytes }
    return value
  }

  private func token() throws -> String? {
    let account = Data("foundkeep-device-token".utf8)
    var query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "app.foundkeep.shared",
      kSecAttrAccount as String: "foundkeep-device-token", kSecAttrGeneric as String: account,
      kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    if let group = Bundle.main.object(forInfoDictionaryKey: "FoundkeepKeychainAccessGroup") as? String, !group.contains("$(") { query[kSecAttrAccessGroup as String] = group }
    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    if status == errSecItemNotFound { return nil }
    guard status == errSecSuccess, let data = result as? Data else { throw FoundkeepUploadError.signedOut }
    return String(data: data, encoding: .utf8)
  }

  private func base64URL(_ data: Data) -> String { data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "") }
}
