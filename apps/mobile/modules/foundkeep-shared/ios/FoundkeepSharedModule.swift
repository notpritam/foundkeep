import ExpoModulesCore
import Foundation
import Security

private enum FoundkeepSharedError: Error {
  case configuration
  case keychain(OSStatus)
}

private struct PendingRecord: Codable {
  let id: String
  let clientId: String
  let batchId: String?
  let metadata: [String: JSONValue]
  let payloadPath: String?
  var attempts: Int
  var nextAttemptAt: Double
  let createdAt: Double
}

private enum JSONValue: Codable {
  case string(String), number(Double), bool(Bool), object([String: JSONValue]), array([JSONValue]), null

  init(from decoder: Decoder) throws {
    let value = try decoder.singleValueContainer()
    if value.decodeNil() { self = .null }
    else if let item = try? value.decode(Bool.self) { self = .bool(item) }
    else if let item = try? value.decode(Double.self) { self = .number(item) }
    else if let item = try? value.decode(String.self) { self = .string(item) }
    else if let item = try? value.decode([String: JSONValue].self) { self = .object(item) }
    else { self = .array(try value.decode([JSONValue].self)) }
  }
  func encode(to encoder: Encoder) throws {
    var value = encoder.singleValueContainer()
    switch self {
    case .string(let item): try value.encode(item)
    case .number(let item): try value.encode(item)
    case .bool(let item): try value.encode(item)
    case .object(let item): try value.encode(item)
    case .array(let item): try value.encode(item)
    case .null: try value.encodeNil()
    }
  }
}

private final class FoundkeepSharedStore {
  static let group = "group.app.foundkeep.ios"
  static let service = "app.foundkeep.shared"
  static let tokenAccount = "foundkeep-device-token"
  private let manager = FileManager.default

  private var keychainGroup: String? { Bundle.main.object(forInfoDictionaryKey: "FoundkeepKeychainAccessGroup") as? String }
  private var container: URL? { manager.containerURL(forSecurityApplicationGroupIdentifier: Self.group) }
  private var queue: URL? { container?.appendingPathComponent("queue", isDirectory: true) }

  func token() throws -> String? {
    var query = keychainQuery()
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    if status == errSecItemNotFound { return nil }
    guard status == errSecSuccess else { throw FoundkeepSharedError.keychain(status) }
    guard let data = result as? Data else { return nil }
    return String(data: data, encoding: .utf8)
  }

  func set(token: String, accountJSON: String) throws {
    var query = keychainQuery()
    SecItemDelete(query as CFDictionary)
    query[kSecValueData as String] = Data(token.utf8)
    query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    let status = SecItemAdd(query as CFDictionary, nil)
    guard status == errSecSuccess else { throw FoundkeepSharedError.keychain(status) }
    UserDefaults(suiteName: Self.group)?.set(accountJSON, forKey: "account")
  }

  func clear() throws {
    let status = SecItemDelete(keychainQuery() as CFDictionary)
    if status != errSecSuccess && status != errSecItemNotFound { throw FoundkeepSharedError.keychain(status) }
    UserDefaults(suiteName: Self.group)?.removeObject(forKey: "account")
  }

  func policy() -> String? { UserDefaults(suiteName: Self.group)?.string(forKey: "mobile-policy") }
  func set(policy: String) { UserDefaults(suiteName: Self.group)?.set(policy, forKey: "mobile-policy") }

  func records() -> [(PendingRecord, URL)] {
    guard let queue else { return [] }
    try? manager.createDirectory(at: queue, withIntermediateDirectories: true)
    let files = (try? manager.contentsOfDirectory(at: queue, includingPropertiesForKeys: nil)) ?? []
    return files.filter { $0.pathExtension == "json" }.compactMap { url in
      guard let data = try? Data(contentsOf: url), let record = try? JSONDecoder().decode(PendingRecord.self, from: data) else { return nil }
      return (record, url)
    }.sorted { $0.0.createdAt < $1.0.createdAt }
  }

  func retry() async throws -> Int {
    guard let token = try token() else { return 0 }
    var completed = 0
    for (var record, recordURL) in records() where record.nextAttemptAt <= Date().timeIntervalSince1970 * 1000 {
      var metadata = record.metadata
      metadata["clientId"] = .string(record.clientId)
      if let batchId = record.batchId { metadata["batchId"] = .string(batchId) }
      let metadataData = try JSONEncoder().encode(metadata)
      var request: URLRequest
      var payloadURL: URL?
      if let payloadPath = record.payloadPath, let container {
        payloadURL = container.appendingPathComponent(payloadPath)
        request = URLRequest(url: URL(string: "https://foundkeep.app/api/mobile/captures/file")!)
        request.httpMethod = "POST"
        request.setValue(metadataData.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: ""), forHTTPHeaderField: "X-Foundkeep-Capture")
        if case .string(let mime) = metadata["declaredMime"] { request.setValue(mime, forHTTPHeaderField: "Content-Type") }
        if let payloadURL, let bytes = try? payloadURL.resourceValues(forKeys: [.fileSizeKey]).fileSize {
          request.setValue(String(bytes), forHTTPHeaderField: "Content-Length")
        }
      } else {
        request = URLRequest(url: URL(string: "https://foundkeep.app/api/captures")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = metadataData
      }
      request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
      request.timeoutInterval = 20
      do {
        let result: (Data, URLResponse)
        if let payloadURL {
          result = try await URLSession.shared.upload(for: request, fromFile: payloadURL)
        } else {
          result = try await URLSession.shared.data(for: request)
        }
        let response = result.1
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else { throw URLError(.badServerResponse) }
        if let payloadPath = record.payloadPath, let container { try? manager.removeItem(at: container.appendingPathComponent(payloadPath)) }
        try? manager.removeItem(at: recordURL)
        completed += 1
      } catch {
        record.attempts += 1
        record.nextAttemptAt = Date().timeIntervalSince1970 * 1000 + min(900_000, 5_000 * pow(2, Double(max(0, min(8, record.attempts - 1)))))
        if let data = try? JSONEncoder().encode(record) { try? data.write(to: recordURL, options: .atomic) }
      }
    }
    return completed
  }

  func downloadCaptureFile(id: String, fileName: String) async throws -> String {
    guard id.range(of: "^[A-Za-z0-9-]{1,80}$", options: .regularExpression) != nil else { throw URLError(.badURL) }
    guard let token = try token() else { throw URLError(.userAuthenticationRequired) }
    var request = URLRequest(url: URL(string: "https://foundkeep.app/api/mobile/captures/\(id)/file")!)
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.timeoutInterval = 30
    let (temporary, response) = try await URLSession.shared.download(for: request)
    guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else { throw URLError(.badServerResponse) }
    let cache = manager.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("Foundkeep Exports", isDirectory: true)
    try manager.createDirectory(at: cache, withIntermediateDirectories: true)
    let leaf = (fileName as NSString).lastPathComponent.components(separatedBy: .controlCharacters).joined().trimmingCharacters(in: .whitespacesAndNewlines)
    let safeName = String((leaf.isEmpty ? "Shared file" : leaf).prefix(180))
    let destination = cache.appendingPathComponent("\(id)-\(safeName)")
    try? manager.removeItem(at: destination)
    try manager.moveItem(at: temporary, to: destination)
    return destination.absoluteString
  }

  private func keychainQuery() -> [String: Any] {
    let account = Data(Self.tokenAccount.utf8)
    var query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: Self.service,
      kSecAttrAccount as String: Self.tokenAccount,
      kSecAttrGeneric as String: account,
    ]
    if let keychainGroup, !keychainGroup.contains("$(") { query[kSecAttrAccessGroup as String] = keychainGroup }
    return query
  }
}

public class FoundkeepSharedModule: Module {
  private let store = FoundkeepSharedStore()
  public func definition() -> ModuleDefinition {
    Name("FoundkeepShared")
    AsyncFunction("setSession") { (token: String, accountJSON: String) in try self.store.set(token: token, accountJSON: accountJSON) }
    AsyncFunction("getToken") { () -> String? in try self.store.token() }
    AsyncFunction("clearSession") { try self.store.clear() }
    AsyncFunction("pendingCount") { self.store.records().count }
    AsyncFunction("retryPending") { () async throws -> Int in try await self.store.retry() }
    AsyncFunction("downloadCaptureFile") { (captureId: String, fileName: String) async throws -> String in
      try await self.store.downloadCaptureFile(id: captureId, fileName: fileName)
    }
    AsyncFunction("getPolicy") { self.store.policy() }
    AsyncFunction("setPolicy") { (policyJSON: String) in self.store.set(policy: policyJSON) }
  }
}
