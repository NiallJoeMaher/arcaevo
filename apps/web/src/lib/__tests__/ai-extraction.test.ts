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

const mantleImpl = vi.fn();
vi.mock("@anthropic-ai/bedrock-sdk", () => ({
  // A newable mock whose behaviour is delegated to `mantleImpl` per test.
  AnthropicBedrockMantle: vi.fn(function (this: unknown, opts: unknown) {
    return mantleImpl(opts);
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
  mantleImpl.mockReset();
  mantleImpl.mockReturnValue({ messages: { create: vi.fn() } });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("extraction vendor selection", () => {
  it("no creds → off, null vendor, SDK never constructed", () => {
    expect(selectedExtractionVendorKind()).toBe("off");
    expect(getExtractionVendor()).toBeNull();
    expect(mantleImpl).not.toHaveBeenCalled();
  });

  it("creds present → real bedrock vendor with an extract() method", () => {
    stubCredsOn();
    expect(selectedExtractionVendorKind()).toBe("bedrock");

    const vendor = getExtractionVendor();
    expect(vendor).not.toBeNull();
    expect(typeof vendor!.extract).toBe("function");

    // Region defaults to eu-west-1 (EU residency); creds are threaded through.
    expect(mantleImpl).toHaveBeenCalledTimes(1);
    expect(mantleImpl.mock.calls[0][0]).toMatchObject({
      awsRegion: "eu-west-1",
      awsAccessKey: "AKIDEXAMPLE",
      awsSecretAccessKey: "fake-secret",
    });
  });

  it("honours ARCAEVO_AWS_REGION override", () => {
    stubCredsOn();
    vi.stubEnv("ARCAEVO_AWS_REGION", "eu-central-1");
    getExtractionVendor();
    expect(mantleImpl.mock.calls[0][0]).toMatchObject({ awsRegion: "eu-central-1" });
  });

  it("construction failure → null, never throws (fail-safe)", () => {
    stubCredsOn();
    mantleImpl.mockImplementation(() => {
      throw new Error("sdk boom");
    });
    expect(() => getExtractionVendor()).not.toThrow();
    expect(getExtractionVendor()).toBeNull();
  });
});
