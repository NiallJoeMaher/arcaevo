import Foundation

/// Where the watch's OWN device-scoped session token lives (the watch keychain
/// — there is no shared keychain with the iPhone, which is why the phone hands
/// the token over via WatchConnectivity in the first place).
///
/// KEYCHAIN ACCESSIBILITY — DELIBERATE CHOICE:
/// `KeychainHelper` writes with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`.
/// A source tip suggested plain `kSecAttrAccessibleAfterFirstUnlock` for
/// background workout sync, but `…ThisDeviceOnly` ALSO permits background
/// access after the first unlock (so the watch can refresh over LTE/Wi-Fi with
/// the phone in a drawer) AND is strictly more secure: a device-scoped,
/// independently-revocable credential must never be backed up to the
/// iCloud keychain or migrated to another device. We keep ThisDeviceOnly.
enum WatchSessionStore {
    private static let tokenKey = "watch.sessionToken"
    private static let expiryKey = "watch.sessionExpiresAt"
    private static let nameKey = "watch.memberName"

    static var token: String? { KeychainHelper.get(tokenKey) }
    static var memberName: String? { KeychainHelper.get(nameKey) }

    static var expiresAt: Date? {
        guard let raw = KeychainHelper.get(expiryKey) else { return nil }
        return iso.date(from: raw)
    }

    static var hasToken: Bool { token != nil }

    /// Store the token handed over by the phone (via updateApplicationContext).
    static func store(token: String, expiresAt: Date?, memberName: String?) {
        KeychainHelper.set(token, for: tokenKey)
        if let expiresAt {
            KeychainHelper.set(iso.string(from: expiresAt), for: expiryKey)
        }
        if let memberName, !memberName.isEmpty {
            KeychainHelper.set(memberName, for: nameKey)
        }
    }

    /// After a successful refresh: slide the stored expiry and adopt the
    /// authoritative member name from the server.
    static func updateExpiry(_ expiresAt: Date, memberName: String?) {
        KeychainHelper.set(iso.string(from: expiresAt), for: expiryKey)
        if let memberName, !memberName.isEmpty {
            KeychainHelper.set(memberName, for: nameKey)
        }
    }

    static func clear() {
        KeychainHelper.delete(tokenKey)
        KeychainHelper.delete(expiryKey)
        KeychainHelper.delete(nameKey)
    }

    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
}
