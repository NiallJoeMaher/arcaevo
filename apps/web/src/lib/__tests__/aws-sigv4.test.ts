/**
 * SigV4 signer (src/lib/aws-sigv4.ts) — deterministic vector tests, no network.
 *
 * Three layers of regression protection:
 *  1. AWS's OFFICIAL published worked example (IAM ListUsers, the documented
 *     canonical request / string-to-sign / signature) — proves the whole
 *     chain against ground truth we didn't produce.
 *  2. AWS's official signing-key derivation vector.
 *  3. A Bedrock-shaped vector whose model id contains `.` and `:` — the
 *     expected values were computed by an INDEPENDENT hand-built chain
 *     following the spec (not by this implementation), then pinned. This is
 *     the one that guards the canonical-path double-encoding rule
 *     (`%3A` on the wire → `%253A` in the canonical request).
 */
import { describe, expect, it } from "vitest";
import {
  canonicalQueryString,
  canonicalUriPath,
  deriveSigningKey,
  rfc3986Encode,
  sha256Hex,
  signAwsRequestV4,
} from "@/lib/aws-sigv4";

// AWS's published example credentials — NOT real secrets.
const ACCESS_KEY = "AKIDEXAMPLE";
const SECRET_KEY = "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY";

describe("official AWS worked example (IAM ListUsers, docs ground truth)", () => {
  // https://docs.aws.amazon.com/IAM/latest/UserGuide/create-signed-request.html
  const signed = signAwsRequestV4({
    method: "GET",
    host: "iam.amazonaws.com",
    path: "/",
    query: { Action: "ListUsers", Version: "2010-05-08" },
    region: "us-east-1",
    service: "iam",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=utf-8",
    },
    body: "",
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
    amzDate: "20150830T123600Z",
  });

  it("reproduces the documented canonical request (incl. empty-body hash)", () => {
    expect(signed.canonicalRequest).toBe(
      [
        "GET",
        "/",
        "Action=ListUsers&Version=2010-05-08",
        "content-type:application/x-www-form-urlencoded; charset=utf-8",
        "host:iam.amazonaws.com",
        "x-amz-date:20150830T123600Z",
        "",
        "content-type;host;x-amz-date",
        // sha256("") — the documented empty-payload hash
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      ].join("\n")
    );
    expect(sha256Hex(signed.canonicalRequest)).toBe(
      "f536975d06c0309214f805bb90ccff089219ecd68b2577efef23edd43b7e1a59"
    );
  });

  it("reproduces the documented string-to-sign", () => {
    expect(signed.stringToSign).toBe(
      [
        "AWS4-HMAC-SHA256",
        "20150830T123600Z",
        "20150830/us-east-1/iam/aws4_request",
        "f536975d06c0309214f805bb90ccff089219ecd68b2577efef23edd43b7e1a59",
      ].join("\n")
    );
  });

  it("reproduces the documented signature + Authorization header", () => {
    expect(signed.signature).toBe(
      "5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7"
    );
    expect(signed.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/iam/aws4_request, " +
        "SignedHeaders=content-type;host;x-amz-date, " +
        "Signature=5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7"
    );
  });

  it("sends host, x-amz-date and Authorization in the returned header set", () => {
    expect(signed.headers.host).toBe("iam.amazonaws.com");
    expect(signed.headers["x-amz-date"]).toBe("20150830T123600Z");
    expect(signed.headers.Authorization).toBe(signed.authorization);
  });
});

describe("official signing-key derivation vector", () => {
  it("matches AWS's documented kSigning bytes", () => {
    // https://docs.aws.amazon.com/general/latest/gr/signature-v4-examples.html
    const key = deriveSigningKey(SECRET_KEY, "20120215", "us-east-1", "iam");
    expect(key.toString("hex")).toBe(
      "f4780e2d9f65fa895f9c67b32ce1baf0b0d8a43505a000a1a9e090d414db404d"
    );
  });
});

describe("canonical path/query encoding rules", () => {
  it("double-encodes the on-wire path (non-S3 rule): %3A → %253A, '.' untouched", () => {
    const requestPath = `/model/${encodeURIComponent(
      "eu.anthropic.claude-haiku-4-5-20251001-v1:0"
    )}/invoke`;
    expect(requestPath).toBe(
      "/model/eu.anthropic.claude-haiku-4-5-20251001-v1%3A0/invoke"
    );
    expect(canonicalUriPath(requestPath)).toBe(
      "/model/eu.anthropic.claude-haiku-4-5-20251001-v1%253A0/invoke"
    );
  });

  it("rfc3986Encode is strict (encodes !*'() that encodeURIComponent skips)", () => {
    expect(rfc3986Encode("a!b*c'd(e)f~g.h-i_j")).toBe(
      "a%21b%2Ac%27d%28e%29f~g.h-i_j"
    );
  });

  it("sorts canonical query params by encoded name then value", () => {
    expect(canonicalQueryString({ b: "2", a: "1", "a b": "x y" })).toBe(
      "a=1&a%20b=x%20y&b=2"
    );
    expect(canonicalQueryString(undefined)).toBe("");
  });
});

describe("Bedrock-shaped vector (model id with '.' and ':')", () => {
  // Expected values computed by an independent, hand-built SigV4 chain
  // (spec-following, separate from src/lib/aws-sigv4.ts) and pinned here.
  const BODY = '{"anthropic_version":"bedrock-2023-05-31"}';
  const BODY_HASH =
    "661f62a67d543adab5f8cd5f03e2b23e3806b22b592f7b2183fa95029e90cca5";

  const signed = signAwsRequestV4({
    method: "POST",
    host: "bedrock-runtime.eu-west-1.amazonaws.com",
    path: `/model/${encodeURIComponent(
      "eu.anthropic.claude-haiku-4-5-20251001-v1:0"
    )}/invoke`,
    region: "eu-west-1",
    service: "bedrock",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "x-amz-content-sha256": BODY_HASH,
    },
    body: BODY,
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
    amzDate: "20260101T000000Z",
  });

  it("hashes the body as expected", () => {
    expect(sha256Hex(BODY)).toBe(BODY_HASH);
  });

  it("signs the DOUBLE-encoded canonical path", () => {
    expect(signed.canonicalRequest.split("\n")[1]).toBe(
      "/model/eu.anthropic.claude-haiku-4-5-20251001-v1%253A0/invoke"
    );
    expect(sha256Hex(signed.canonicalRequest)).toBe(
      "a3c44c8ed9f52a8dea1d80634b7a8b1757470001f7fe87082f85da87ee34b4d3"
    );
  });

  it("produces the pinned string-to-sign and signature", () => {
    expect(signed.stringToSign).toBe(
      [
        "AWS4-HMAC-SHA256",
        "20260101T000000Z",
        "20260101/eu-west-1/bedrock/aws4_request",
        "a3c44c8ed9f52a8dea1d80634b7a8b1757470001f7fe87082f85da87ee34b4d3",
      ].join("\n")
    );
    expect(signed.signature).toBe(
      "b9a6a3d507cd7a109c5c0f9abded4ed49d92be0602d94fde505171310c4bd08d"
    );
  });
});

describe("STS session-token vector (x-amz-security-token participates in signing)", () => {
  // Same Bedrock-shaped request as above but with temporary (STS) credentials.
  // Expected values computed by an independent, hand-built SigV4 chain
  // (spec-following, separate from src/lib/aws-sigv4.ts) and pinned here —
  // same methodology as the vector above. NOT a real token.
  const SESSION_TOKEN =
    "FwoGZXIvYXdzEXAMPLESESSIONTOKEN/aBcD1234+eXaMpLeToKeN=";
  const BODY = '{"anthropic_version":"bedrock-2023-05-31"}';
  const BODY_HASH =
    "661f62a67d543adab5f8cd5f03e2b23e3806b22b592f7b2183fa95029e90cca5";

  const signed = signAwsRequestV4({
    method: "POST",
    host: "bedrock-runtime.eu-west-1.amazonaws.com",
    path: `/model/${encodeURIComponent(
      "eu.anthropic.claude-haiku-4-5-20251001-v1:0"
    )}/invoke`,
    region: "eu-west-1",
    service: "bedrock",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "x-amz-content-sha256": BODY_HASH,
    },
    body: BODY,
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
    sessionToken: SESSION_TOKEN,
    amzDate: "20260101T000000Z",
  });

  it("includes the lowercased token header in the canonical request, sorted last", () => {
    const lines = signed.canonicalRequest.split("\n");
    // Canonical headers block: accept, content-type, host,
    // x-amz-content-sha256, x-amz-date, x-amz-security-token (sorted).
    expect(lines).toContain(`x-amz-security-token:${SESSION_TOKEN}`);
    const dateIdx = lines.indexOf("x-amz-date:20260101T000000Z");
    expect(lines[dateIdx + 1]).toBe(`x-amz-security-token:${SESSION_TOKEN}`);
  });

  it("appends the token to the signed-headers list (sorted position)", () => {
    expect(signed.authorization).toContain(
      "SignedHeaders=accept;content-type;host;x-amz-content-sha256;x-amz-date;x-amz-security-token"
    );
  });

  it("produces the independently computed string-to-sign and signature", () => {
    expect(signed.stringToSign).toBe(
      [
        "AWS4-HMAC-SHA256",
        "20260101T000000Z",
        "20260101/eu-west-1/bedrock/aws4_request",
        "b423bb3f7b7aee6023e12ee3c723b4a98ee2ed03ed3e1e2a4507a0d2d96c89eb",
      ].join("\n")
    );
    expect(signed.signature).toBe(
      "8d45ad4f065f778b2e07af6fa71ee5d72305f6cdd2d987185786370c6d4d57a3"
    );
  });

  it("sends x-amz-security-token on the wire; omits it when no token given", () => {
    expect(signed.headers["x-amz-security-token"]).toBe(SESSION_TOKEN);

    const withoutToken = signAwsRequestV4({
      method: "POST",
      host: "bedrock-runtime.eu-west-1.amazonaws.com",
      path: "/model/x/invoke",
      region: "eu-west-1",
      service: "bedrock",
      body: BODY,
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_KEY,
      amzDate: "20260101T000000Z",
    });
    expect(withoutToken.headers["x-amz-security-token"]).toBeUndefined();
    expect(withoutToken.canonicalRequest).not.toContain("security-token");
  });
});
