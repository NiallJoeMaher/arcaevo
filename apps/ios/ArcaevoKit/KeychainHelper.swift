import Foundation
import Security

/// Minimal generic-password keychain wrapper — just enough to hold the
/// member session token securely on iOS and watchOS. No sync, no access
/// groups. Items use `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`:
/// available after first unlock (so background refreshes work) but never
/// migrated to another device and never written to iCloud/iTunes backups.
enum KeychainHelper {
    private static let service = "co.arcaevo.app"

    @discardableResult
    static func set(_ value: String, for key: String) -> Bool {
        guard let data = value.data(using: .utf8) else { return false }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        // Upsert: delete-then-add keeps the logic trivially correct.
        SecItemDelete(query as CFDictionary)
        var attributes = query
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(attributes as CFDictionary, nil) == errSecSuccess
    }

    static func get(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data
        else { return nil }
        return String(data: data, encoding: .utf8)
    }

    @discardableResult
    static func delete(_ key: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }
}

/// Where the current member session token lives.
///
/// Auth ladder (per docs/MOCKED_APIS.md + v2 backend):
///  1. keychain session token from `POST /auth/magic-link/verify`
///  2. legacy `demo-member-token` fallback → seeded demo member (mem_0001),
///     so the app always demos offline / signed-out.
enum SessionStore {
    private static let key = "member.sessionToken"
    /// In-memory cache so hot paths don't hit the keychain per request.
    private static var cached: String??

    static var token: String? {
        if let cached { return cached }
        let value = KeychainHelper.get(key)
        cached = .some(value)
        return value
    }

    static func store(_ token: String) {
        KeychainHelper.set(token, for: key)
        cached = .some(token)
    }

    static func clear() {
        KeychainHelper.delete(key)
        cached = .some(nil)
    }

    /// True when a real (non-demo) session is present.
    static var hasSession: Bool { token != nil }
}
