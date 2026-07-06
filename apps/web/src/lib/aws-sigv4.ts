/**
 * AWS Signature Version 4 — pure, dependency-free (`node:crypto` only).
 *
 * A general-purpose SigV4 signer for AWS REST calls made with `fetch` (the
 * same no-SDK posture as src/lib/stripe-signature.ts and the SES signer in
 * src/lib/vendors/email.ses.ts). This module exists because Bedrock model ids
 * contain `.` and `:`, which forces correct canonical-path handling that the
 * SES signer (fixed, unreserved path) never needed:
 *
 *  - The REQUEST path (what goes on the wire) is percent-encoded ONCE per
 *    RFC 3986 (`:` → `%3A`; `.` is unreserved and stays).
 *  - The CANONICAL path (what gets signed) is the request path encoded
 *    AGAIN — the "URI-encode twice" rule AWS applies to every service except
 *    S3 (`%3A` → `%253A`). Getting this wrong yields an opaque 403
 *    SignatureDoesNotMatch, hence the fixed-vector tests in
 *    src/lib/__tests__/aws-sigv4.test.ts.
 *
 * The four steps (canonical request → string-to-sign → signing key →
 * signature) follow the official spec:
 * https://docs.aws.amazon.com/IAM/latest/UserGuide/create-signed-request.html
 *
 * Everything here is pure: no I/O, no clocks unless `amzDate` is omitted, no
 * env reads. Secrets pass through the HMAC chain and are never logged.
 */
import { createHash, createHmac } from "node:crypto";

const SIGNING_ALGORITHM = "AWS4-HMAC-SHA256";

/** Lowercase hex SHA-256 (payload hash + canonical-request hash). */
export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/** HMAC-SHA256 returning raw bytes so the key-derivation chain can nest. */
function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

/**
 * Strict RFC 3986 percent-encoding of ONE path segment / query token:
 * unreserved characters (A–Z a–z 0–9 - _ . ~) pass through, everything else
 * (including `!'()*`, which encodeURIComponent leaves alone) is %XX-encoded.
 */
export function rfc3986Encode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/**
 * Canonical URI for the signature, derived from the path AS SENT ON THE WIRE
 * (i.e. already percent-encoded once). Every path segment is encoded a second
 * time — the non-S3 "URI-encode twice" rule — so an on-wire `%3A` becomes
 * `%253A` in the canonical request while unreserved chars (`.`, `-`) are
 * untouched.
 */
export function canonicalUriPath(requestPath: string): string {
  if (!requestPath) return "/";
  return requestPath.split("/").map(rfc3986Encode).join("/") || "/";
}

/**
 * Canonical query string: RFC 3986-encoded names/values, sorted by encoded
 * name then encoded value, joined with `&`. Empty map → empty string.
 */
export function canonicalQueryString(
  query: Record<string, string> | undefined
): string {
  if (!query) return "";
  return Object.entries(query)
    .map(([k, v]) => [rfc3986Encode(k), rfc3986Encode(v)] as const)
    .sort(([ak, av], [bk, bv]) =>
      ak < bk ? -1 : ak > bk ? 1 : av < bv ? -1 : av > bv ? 1 : 0
    )
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
}

/**
 * SigV4 signing key: HMAC chain over date / region / service /
 * `aws4_request`, seeded with `AWS4` + the secret. Exported so the test can
 * assert it against AWS's published worked example.
 */
export function deriveSigningKey(
  secretAccessKey: string,
  dateStamp: string, // YYYYMMDD
  region: string,
  service: string
): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

export interface SignAwsRequestInput {
  method: string;
  host: string;
  /** Path AS SENT ON THE WIRE (percent-encoded once, e.g. via encodeURIComponent). */
  path: string;
  /** Query parameters (raw, un-encoded). Omit when there are none. */
  query?: Record<string, string>;
  region: string;
  service: string;
  /** Extra headers to sign. `host` and `x-amz-date` are added automatically. */
  headers?: Record<string, string>;
  body: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Basic ISO8601, e.g. 20150830T123600Z. Defaults to now. */
  amzDate?: string;
}

export interface SignAwsRequestResult {
  /** Full header set to send, including Authorization + x-amz-date. */
  headers: Record<string, string>;
  authorization: string;
  /** Intermediate artefacts, exposed for the deterministic vector tests. */
  canonicalRequest: string;
  stringToSign: string;
  signature: string;
  amzDate: string;
}

/**
 * Sign an AWS REST request with SigV4. Generic across services — the tests
 * pin it to AWS's official IAM worked example AND to a Bedrock-shaped vector
 * whose model id exercises the canonical-path double-encoding.
 */
export function signAwsRequestV4(
  input: SignAwsRequestInput
): SignAwsRequestResult {
  const amzDate = input.amzDate ?? isoBasic(new Date());
  const dateStamp = amzDate.slice(0, 8);

  const headers: Record<string, string> = {
    host: input.host,
    "x-amz-date": amzDate,
    ...(input.headers ?? {}),
  };

  // Canonical headers: lowercased names, trimmed values, sorted, "k:v\n" each.
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    lower[k.toLowerCase()] = String(v).trim();
  }
  const sortedNames = Object.keys(lower).sort();
  const canonicalHeaders = sortedNames.map((n) => `${n}:${lower[n]}`).join("\n");
  const signedHeaders = sortedNames.join(";");

  const canonicalRequest = [
    input.method.toUpperCase(),
    canonicalUriPath(input.path),
    canonicalQueryString(input.query),
    `${canonicalHeaders}\n`,
    signedHeaders,
    sha256Hex(input.body),
  ].join("\n");

  const credentialScope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = [
    SIGNING_ALGORITHM,
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = createHmac(
    "sha256",
    deriveSigningKey(input.secretAccessKey, dateStamp, input.region, input.service)
  )
    .update(stringToSign, "utf8")
    .digest("hex");

  const authorization =
    `${SIGNING_ALGORITHM} Credential=${input.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    headers: { ...headers, Authorization: authorization },
    authorization,
    canonicalRequest,
    stringToSign,
    signature,
    amzDate,
  };
}

/** ISO8601 basic format (YYYYMMDDTHHMMSSZ) as SigV4's X-Amz-Date requires. */
function isoBasic(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}
