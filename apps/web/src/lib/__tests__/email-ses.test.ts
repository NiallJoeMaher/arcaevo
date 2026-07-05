/**
 * Unit tests for src/lib/vendors/email.ses.ts — the dep-free AWS SigV4 signer
 * and the SES v2 SendEmail body builder / provider selection.
 *
 * The signer is validated against AWS's OWN published test vectors so we know
 * the canonical-request → string-to-sign → signing-key → signature pipeline is
 * byte-for-byte correct, not merely self-consistent. No network is touched.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildSendEmailBody,
  getSignatureKey,
  resolveSesCredentials,
  sesDeliveryEnabled,
  sha256Hex,
  signAwsV4,
} from "@/lib/vendors/email.ses";

describe("SigV4 signing key (AWS documented vector)", () => {
  it("matches the AWS 'deriving the signing key' worked example", () => {
    // https://docs.aws.amazon.com/general/latest/gr/signature-v4-examples.html
    const key = getSignatureKey(
      "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
      "20120215",
      "us-east-1",
      "iam"
    );
    expect(key.toString("hex")).toBe(
      "f4780e2d9f65fa895f9c67b32ce1baf0b0d8a43505a000a1a9e090d414db404d"
    );
  });
});

describe("signAwsV4 (AWS SigV4 test-suite: get-vanilla)", () => {
  // From the official aws-sig-v4-test-suite `get-vanilla` case.
  const CREDS = {
    accessKeyId: "AKIDEXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
  };

  it("produces the exact published signature + Authorization header", () => {
    const r = signAwsV4({
      method: "GET",
      host: "example.amazonaws.com",
      path: "/",
      region: "us-east-1",
      service: "service",
      headers: {},
      body: "",
      amzDate: "20150830T123600Z",
      ...CREDS,
    });

    expect(r.signature).toBe(
      "5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31"
    );
    expect(r.canonicalRequest).toBe(
      [
        "GET",
        "/",
        "",
        "host:example.amazonaws.com",
        "x-amz-date:20150830T123600Z",
        "",
        "host;x-amz-date",
        sha256Hex(""),
      ].join("\n")
    );
    expect(r.stringToSign.split("\n")[0]).toBe("AWS4-HMAC-SHA256");
    expect(r.headers.Authorization).toBe(
      "AWS4-HMAC-SHA256 " +
        "Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, " +
        "SignedHeaders=host;x-amz-date, " +
        "Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31"
    );
  });

  it("is deterministic and sorts/lowercases signed headers", () => {
    const sign = () =>
      signAwsV4({
        method: "POST",
        host: "email.eu-west-1.amazonaws.com",
        path: "/v2/email/outbound-emails",
        region: "eu-west-1",
        service: "ses",
        headers: { "Content-Type": "application/json" },
        body: '{"a":1}',
        amzDate: "20260705T101112Z",
        ...CREDS,
      });
    const a = sign();
    const b = sign();
    expect(a.signature).toBe(b.signature); // round-trip determinism
    // content-type sorts before host/x-amz-date; all lowercased.
    expect(a.authorization).toContain(
      "SignedHeaders=content-type;host;x-amz-date"
    );
    expect(a.headers.Authorization).toContain("Credential=AKIDEXAMPLE/20260705/eu-west-1/ses/aws4_request");
  });
});

describe("buildSendEmailBody (SES v2 SendEmail JSON)", () => {
  it("shapes FromEmailAddress / Destination / Content.Simple", () => {
    const body = JSON.parse(
      buildSendEmailBody({
        from: "Arcaevo <hello@arcaevo.com>",
        to: "member@example.com",
        subject: "Your results are ready",
        html: "<p>hello</p>",
      })
    );
    expect(body.FromEmailAddress).toBe("Arcaevo <hello@arcaevo.com>");
    expect(body.Destination.ToAddresses).toEqual(["member@example.com"]);
    expect(body.Content.Simple.Subject.Data).toBe("Your results are ready");
    expect(body.Content.Simple.Body.Html.Data).toBe("<p>hello</p>");
    expect(body.Content.Simple.Body.Text).toBeUndefined();
  });

  it("includes a Text part only when provided", () => {
    const body = JSON.parse(
      buildSendEmailBody({
        from: "f@x.com",
        to: "t@x.com",
        subject: "s",
        html: "<p>h</p>",
        text: "h",
      })
    );
    expect(body.Content.Simple.Body.Text.Data).toBe("h");
  });
});

describe("provider selection + credential resolution", () => {
  const KEYS = [
    "EMAIL_PROVIDER",
    "AWS_SES_ACCESS_KEY_ID",
    "AWS_SES_SECRET_ACCESS_KEY",
    "AWS_SES_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_REGION",
  ] as const;
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("sesDeliveryEnabled is true only for EMAIL_PROVIDER=ses", () => {
    expect(sesDeliveryEnabled()).toBe(false);
    process.env.EMAIL_PROVIDER = "smtp";
    expect(sesDeliveryEnabled()).toBe(false);
    process.env.EMAIL_PROVIDER = "ses";
    expect(sesDeliveryEnabled()).toBe(true);
    process.env.EMAIL_PROVIDER = "SES";
    expect(sesDeliveryEnabled()).toBe(true);
  });

  it("prefers SES-specific creds", () => {
    process.env.AWS_SES_ACCESS_KEY_ID = "AKIA_SES";
    process.env.AWS_SES_SECRET_ACCESS_KEY = "secret_ses";
    process.env.AWS_SES_REGION = "eu-west-1";
    expect(resolveSesCredentials()).toEqual({
      accessKeyId: "AKIA_SES",
      secretAccessKey: "secret_ses",
      region: "eu-west-1",
    });
  });

  it("falls back to standard AWS_* vars", () => {
    process.env.AWS_ACCESS_KEY_ID = "AKIA_STD";
    process.env.AWS_SECRET_ACCESS_KEY = "secret_std";
    process.env.AWS_REGION = "us-east-1";
    expect(resolveSesCredentials()).toEqual({
      accessKeyId: "AKIA_STD",
      secretAccessKey: "secret_std",
      region: "us-east-1",
    });
  });

  it("returns null when any credential piece is missing", () => {
    process.env.AWS_SES_ACCESS_KEY_ID = "AKIA_SES";
    process.env.AWS_SES_REGION = "eu-west-1";
    expect(resolveSesCredentials()).toBeNull(); // no secret
  });
});
