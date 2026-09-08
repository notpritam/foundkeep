import Foundation

@main
struct QueueScopeTests {
  static func main() {
    var checks = 0
    func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
      precondition(condition(), message)
      checks += 1
    }
    let account = "{\"id\":\"account-a\",\"email\":\"a@example.test\"}"
    expect(FoundkeepQueueScope.organizationName(" Cafe\u{0301} ", limit: 4) == "Café", "Normalize to NFC before measuring names")
    expect(FoundkeepQueueScope.organizationName(String(repeating: "😀", count: 20), limit: 40) != nil, "Accept exactly 40 UTF-16 units")
    expect(FoundkeepQueueScope.organizationName(String(repeating: "😀", count: 21), limit: 40) == nil, "Reject emoji names beyond the server's UTF-16 limit")
    expect(FoundkeepQueueScope.organizationName("hello\nworld", limit: 40) == nil, "Reject embedded control characters")
    expect(FoundkeepQueueScope.organizationName("hello\u{007f}", limit: 40) == nil, "Reject DEL as the server does")
    expect(FoundkeepQueueScope.accountId(from: account) == "account-a", "Read the stable ID from shared account JSON")
    expect(FoundkeepQueueScope.accountId(from: "{\"id\":\"\"}") == nil, "Reject an empty owner")
    expect(FoundkeepQueueScope.accountId(from: "{\"email\":\"a@example.test\"}") == nil, "Never substitute email for account ID")
    expect(FoundkeepQueueScope.accountId(from: "invalid") == nil, "Reject malformed account JSON")
    expect(FoundkeepQueueScope.session(token: "token-a", boundAccountId: nil) == nil, "Legacy unbound credentials cannot own queued content")
    expect(FoundkeepQueueScope.session(token: nil, boundAccountId: "account-a") == nil, "A signed-out account cannot own an active queue session")
    let first = FoundkeepQueueScope.session(token: "token-a", boundAccountId: "account-a")!
    let rotated = FoundkeepQueueScope.session(token: "token-b", boundAccountId: "account-a")!
    let other = FoundkeepQueueScope.session(token: "token-c", boundAccountId: "account-b")!
    expect(first != rotated, "A request snapshot notices token rotation")
    expect(first != other, "A request snapshot notices account switching")
    expect(FoundkeepQueueScope.owns("account-a", accountId: rotated.accountId), "A stable owner survives token rotation")
    expect(!FoundkeepQueueScope.owns("account-a", accountId: other.accountId), "Another account cannot retry an owner's records")
    expect(!FoundkeepQueueScope.owns(nil, accountId: first.accountId), "Legacy ownerless records stay quarantined")
    expect(!FoundkeepQueueScope.owns("", accountId: first.accountId), "Empty owner IDs are not migration candidates")
    expect(!FoundkeepQueueScope.owns("account-a", accountId: nil), "Signing out stops owned queue access")
    expect(FoundkeepQueueScope.mayRetry(ownerAccountId: "account-a", requiresOrganizationReview: false, accountId: first.accountId), "An owned ready record can retry")
    expect(!FoundkeepQueueScope.mayRetry(ownerAccountId: "account-a", requiresOrganizationReview: true, accountId: first.accountId), "A permanent organization error stops automatic retries")
    expect(!FoundkeepQueueScope.mayRetry(ownerAccountId: nil, requiresOrganizationReview: false, accountId: first.accountId), "Clearing a block does not adopt a legacy record")
    let missingFolder = Data("{\"error\":\"folder_not_found\"}".utf8)
    expect(FoundkeepQueueScope.isMissingFolder(statusCode: 404, data: missingFolder), "Recognize the explicit missing-folder server response")
    expect(!FoundkeepQueueScope.isMissingFolder(statusCode: 500, data: missingFolder), "A temporary server error remains retryable")
    expect(!FoundkeepQueueScope.isMissingFolder(statusCode: 404, data: Data("{\"error\":\"capture_not_found\"}".utf8)), "An unrelated 404 cannot trigger folder reassignment")
    expect(!FoundkeepQueueScope.isMissingFolder(statusCode: 404, data: Data()), "An empty response cannot trigger folder reassignment")
    expect(FoundkeepQueueScope.needsFolderReview(required: true, reason: "folder_not_found"), "The explicit folder error is recoverable to Unfiled")
    expect(!FoundkeepQueueScope.needsFolderReview(required: true, reason: "another_error"), "Recovery cannot clear another reason's block")
    expect(!FoundkeepQueueScope.needsFolderReview(required: false, reason: "folder_not_found"), "Already resolved records are not counted as blocked")
    let queuedJSON = #"{"id":"record-1","clientId":"client-1","batchId":"batch-1","ownerAccountId":"account-a","metadata":{"folderId":"deleted-folder","userTags":["Read later"],"noteText":"Keep this note","provenance":{"sourceUrl":"https://example.test"}},"payloadPath":"payloads/retained.pdf","attempts":4,"nextAttemptAt":5000,"createdAt":1000,"requiresOrganizationReview":true,"organizationReviewReason":"folder_not_found"}"#
    var record = try! JSONDecoder().decode(FoundkeepPendingRecord.self, from: Data(queuedJSON.utf8))
    let originalMetadata = record.metadata
    expect(!record.resolveFolderToUnfiled(for: "account-b"), "Recovery cannot modify another account's record")
    expect(record.metadata == originalMetadata && record.attempts == 4, "A rejected recovery leaves the record unchanged")
    expect(record.resolveFolderToUnfiled(for: "account-a"), "Explicit recovery resolves the matching account's folder error")
    expect(record.metadata["folderId"] == .null, "Recovery chooses Unfiled explicitly")
    expect(record.metadata["userTags"] == originalMetadata["userTags"] && record.metadata["noteText"] == originalMetadata["noteText"] && record.metadata["provenance"] == originalMetadata["provenance"], "Recovery preserves tags, content, and provenance")
    expect(record.clientId == "client-1" && record.batchId == "batch-1" && record.payloadPath == "payloads/retained.pdf" && record.ownerAccountId == "account-a", "Recovery preserves identity, account, and payload reference")
    expect(record.requiresOrganizationReview == false && record.organizationReviewReason == nil && record.attempts == 0 && record.nextAttemptAt == 0, "Recovery clears the permanent block and backoff")
    let restored = try! JSONDecoder().decode(FoundkeepPendingRecord.self, from: JSONEncoder().encode(record))
    expect(restored.ownerAccountId == record.ownerAccountId && restored.metadata == record.metadata && restored.payloadPath == record.payloadPath, "Queue serialization preserves ownership and capture data")
    let legacyJSON = queuedJSON.replacingOccurrences(of: #""ownerAccountId":"account-a","#, with: "")
    var legacy = try! JSONDecoder().decode(FoundkeepPendingRecord.self, from: Data(legacyJSON.utf8))
    expect(legacy.ownerAccountId == nil && !legacy.resolveFolderToUnfiled(for: "account-a"), "Legacy ownerless captures decode safely and are never reassigned")
    print("Passed \(checks) native queue scope checks.")
  }
}
