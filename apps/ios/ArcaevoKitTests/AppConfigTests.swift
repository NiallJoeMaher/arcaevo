import XCTest

/// `GET /api/v1/config` decoding — the blood-tier gate MUST fail safe (false)
/// whenever the field is absent, null, or the body is garbled, so the paid
/// blood tiers are never treated as purchasable on an unknown flag.
final class AppConfigTests: XCTestCase {

    private func decode(_ json: String) throws -> AppConfig {
        try APIClient.decoder.decode(AppConfig.self, from: Data(json.utf8))
    }

    func testEnabledTrue() throws {
        XCTAssertTrue(try decode(#"{ "bloodTiersEnabled": true }"#).bloodTiersEnabled)
    }

    func testEnabledFalse() throws {
        XCTAssertFalse(try decode(#"{ "bloodTiersEnabled": false }"#).bloodTiersEnabled)
    }

    func testMissingFieldFailsSafeToFalse() throws {
        // A `{}` body (or a config that hasn't shipped the field yet) must NOT
        // throw and must resolve to the safe default.
        XCTAssertFalse(try decode("{}").bloodTiersEnabled)
    }

    func testNullFieldFailsSafeToFalse() throws {
        XCTAssertFalse(try decode(#"{ "bloodTiersEnabled": null }"#).bloodTiersEnabled)
    }

    func testUnrelatedKeysIgnored() throws {
        XCTAssertTrue(try decode(#"{ "somethingElse": 1, "bloodTiersEnabled": true }"#).bloodTiersEnabled)
    }

    func testDefaultInitIsFalse() {
        XCTAssertFalse(AppConfig().bloodTiersEnabled)
    }
}
