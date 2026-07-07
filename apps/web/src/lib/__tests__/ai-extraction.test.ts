/**
 * Real-OCR vendor SELECTION factory (mirrors ai-narration.ts):
 *
 *  - CREDENTIALS ARE THE SWITCH. No ARCAEVO_AWS_* key pair → "off", null vendor,
 *    the SDK is never even constructed (route keeps its mock/manual behaviour).
 *  - Key pair present → the real Bedrock vision vendor, exposing `extract()`.
 *  - FAIL-SAFE: any construction problem (bad SDK, throwing constructor) → null,
 *    never a throw. A missing vendor routes the member to manual entry.
 *
 * The Bedrock SDK is mocked so no network/credentials are touched: we only prove
 * the selection + fail-safe wiring, not the transport (that has its own suite).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clientImpl = vi.fn();
vi.mock("@anthropic-ai/bedrock-sdk", () => ({
  // A newable mock whose behaviour is delegated to `clientImpl` per test.
  // `AnthropicBedrock` is the classic bedrock-runtime InvokeModel client (the
  // same path AI narration signs with the ARCAEVO_AWS_* keys).
  AnthropicBedrock: vi.fn(function (this: unknown, opts: unknown) {
    return clientImpl(opts);
  }),
}));

import {
  getExtractionVendor,
  selectedExtractionVendorKind,
} from "@/lib/ai-extraction";

function stubCredsOn() {
  vi.stubEnv("ARCAEVO_AWS_ACCESS_KEY_ID", "AKIDEXAMPLE");
  vi.stubEnv("ARCAEVO_AWS_SECRET_ACCESS_KEY", "fake-secret");
}

beforeEach(() => {
  clientImpl.mockReset();
  clientImpl.mockReturnValue({ messages: { create: vi.fn() } });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("extraction vendor selection", () => {
  it("no creds → off, null vendor, SDK never constructed", () => {
    expect(selectedExtractionVendorKind()).toBe("off");
    expect(getExtractionVendor()).toBeNull();
    expect(clientImpl).not.toHaveBeenCalled();
  });

  it("creds present → real bedrock vendor with an extract() method", () => {
    stubCredsOn();
    expect(selectedExtractionVendorKind()).toBe("bedrock");

    const vendor = getExtractionVendor();
    expect(vendor).not.toBeNull();
    expect(typeof vendor!.extract).toBe("function");

    // Region defaults to eu-west-1 (EU residency); creds are threaded through.
    expect(clientImpl).toHaveBeenCalledTimes(1);
    expect(clientImpl.mock.calls[0][0]).toMatchObject({
      awsRegion: "eu-west-1",
      awsAccessKey: "AKIDEXAMPLE",
      // Classic AnthropicBedrock uses `awsSecretKey` (NOT Mantle's
      // `awsSecretAccessKey`); see @anthropic-ai/bedrock-sdk client.d.ts.
      awsSecretKey: "fake-secret",
      // We enforce our own single hard deadline; the SDK must not retry silently.
      maxRetries: 0,
    });
  });

  it("honours ARCAEVO_AWS_REGION override", () => {
    stubCredsOn();
    vi.stubEnv("ARCAEVO_AWS_REGION", "eu-central-1");
    getExtractionVendor();
    expect(clientImpl.mock.calls[0][0]).toMatchObject({ awsRegion: "eu-central-1" });
  });

  it("missing region falls back to the eu-west-1 default → allowed", () => {
    stubCredsOn(); // no ARCAEVO_AWS_REGION stubbed
    const vendor = getExtractionVendor();
    expect(vendor).not.toBeNull();
    expect(clientImpl.mock.calls[0][0]).toMatchObject({ awsRegion: "eu-west-1" });
  });

  it("FAIL CLOSED: a non-EU region disables OCR (null vendor, SDK never built)", () => {
    stubCredsOn();
    vi.stubEnv("ARCAEVO_AWS_REGION", "us-east-1");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(getExtractionVendor()).toBeNull(); // degrades to manual entry
    // A non-EU endpoint client is NEVER constructed (no Art.9 leak).
    expect(clientImpl).not.toHaveBeenCalled();

    // If a warning is emitted it carries ONLY the region — never creds/PII.
    const warned = warnSpy.mock.calls.flat().map(String).join(" ");
    expect(warned).not.toContain("AKIDEXAMPLE"); // access key id
    expect(warned).not.toContain("fake-secret"); // secret access key
    warnSpy.mockRestore();
  });

  it("FAIL CLOSED: a UK region (eu-west-2) is NOT EU/EEA → OCR disabled", () => {
    // London has an EU adequacy decision but is NOT an EU/EEA member state;
    // routing special-category health data there is a separate, deliberate
    // compliance decision, so it must fail closed here (guards against a silent
    // regression that re-adds it to the allowlist). Zurich (eu-central-2) is
    // excluded for the same reason.
    stubCredsOn();
    vi.stubEnv("ARCAEVO_AWS_REGION", "eu-west-2");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(getExtractionVendor()).toBeNull(); // same as the us-east-1 case
    expect(clientImpl).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("construction failure → null, never throws (fail-safe)", () => {
    stubCredsOn();
    clientImpl.mockImplementation(() => {
      throw new Error("sdk boom");
    });
    expect(() => getExtractionVendor()).not.toThrow();
    expect(getExtractionVendor()).toBeNull();
  });
});
