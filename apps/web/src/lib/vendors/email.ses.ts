/**
 * AWS SES v2 API email delivery — a dependency-free, AWS-native alternative to
 * the SMTP path (email.smtp.ts). Instead of opening an SMTP connection with a
 * password *derived* from the IAM secret, this signs the SES v2 SendEmail HTTP
 * API call DIRECTLY with the IAM access key id + secret using AWS Signature
 * Version 4 (SigV4), implemented here with `node:crypto` (no aws-sdk).
 *
 *   POST https://email.<region>.amazonaws.com/v2/email/outbound-emails
 *
 * Why prefer this over SMTP on Vercel serverless: there is no persistent SMTP
 * socket to keep alive across cold starts, it uses SES's native HTTPS + retry
 * surface, and it authenticates with the raw IAM keys the founder expects
 * (AWS_SES_ACCESS_KEY_ID / AWS_SES_SECRET_ACCESS_KEY) rather than an
 * SMTP-specific derived credential.
 *
 * This is NOT a replacement for the Mongo outbox (email.mock.ts): the outbox
 * write ALWAYS happens (e2e specs + admin views read it). When
 * EMAIL_PROVIDER=ses, the same rendered email is ADDITIONALLY handed to this
 * sender, fire-and-forget — an SES failure is logged and must never break the
 * API request that triggered the email (same invariant as the SMTP path).
 *
 * The IAM secret is never logged; it exists only inside the HMAC chain below.
 */
import { createHash, createHmac } from "node:crypto";
import { EMAIL_FROM } from "@/lib/emails";

const SERVICE = "ses";
const SIGNING_ALGORITHM = "AWS4-HMAC-SHA256";

/** True when the env asks for real SES v2 API delivery alongside the outbox. */
export function sesDeliveryEnabled(): boolean {
  return (process.env.EMAIL_PROVIDER ?? "").toLowerCase() === "ses";
}

/** Resolved From header — EMAIL_FROM overrides the emails.ts default when set. */
function resolveFrom(): string {
  const override = process.env.EMAIL_FROM?.trim();
  return override && override.length > 0 ? override : EMAIL_FROM;
}

export interface SesCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

/**
 * Resolve the SES creds from the environment. Prefers the SES-specific vars and
 * falls back to the standard AWS SDK vars so a machine already configured for
 * the AWS CLI Just Works. Returns null when incomplete (caller skips the send).
 * The secret is returned but NEVER logged.
 */
export function resolveSesCredentials(): SesCredentials | null {
  const accessKeyId =
    process.env.AWS_SES_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.AWS_SES_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_SES_REGION ?? process.env.AWS_REGION;
  if (!accessKeyId || !secretAccessKey || !region) return null;
  return { accessKeyId, secretAccessKey, region };
}

// ---------------------------------------------------------------------------
// AWS Signature Version 4 — dep-free (node:crypto)
// https://docs.aws.amazon.com/general/latest/gr/sigv4-create-canonical-request.html
// ---------------------------------------------------------------------------

/** Lowercase hex SHA-256 of a string or buffer (payload hash + canonical hash). */
export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/** HMAC-SHA256 returning raw bytes, so the signing-key chain can nest. */
function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

/**
 * Derive the SigV4 signing key: HMAC chain over the date, region, service and
 * the literal `aws4_request`, seeded with `AWS4` + the secret. Exported so a
 * test can assert it against the documented AWS worked example.
 */
export function getSignatureKey(
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

export interface SignV4Input {
  method: string;
  host: string;
  path: string;
  region: string;
  service: string;
  /** Header name → value. `host` and `x-amz-date` are added if absent. */
  headers: Record<string, string>;
  body: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Basic ISO8601 e.g. 20150830T123600Z. Defaults to now. */
  amzDate?: string;
}

export interface SignV4Result {
  /** Full header set to send, including Authorization + x-amz-date. */
  headers: Record<string, string>;
  authorization: string;
  /** Intermediate artefacts, exposed for deterministic round-trip tests. */
  canonicalRequest: string;
  stringToSign: string;
  signature: string;
  amzDate: string;
}

/**
 * Sign an arbitrary AWS request with SigV4. Generic (not SES-specific) so it can
 * be exercised against AWS's published canonical-request test vectors. The four
 * steps are: canonical request → string-to-sign → signing key → signature.
 */
export function signAwsV4(input: SignV4Input): SignV4Result {
  const amzDate = input.amzDate ?? isoBasic(new Date());
  const dateStamp = amzDate.slice(0, 8); // YYYYMMDD

  const payloadHash = sha256Hex(input.body);

  // Assemble the headers we sign: caller headers + host + x-amz-date +
  // x-amz-content-sha256 (SES accepts it; harmless for the vector tests since
  // callers control the exact header map).
  const headers: Record<string, string> = {
    host: input.host,
    "x-amz-date": amzDate,
    ...input.headers,
  };

  // Canonical headers: lowercased names, trimmed values, sorted, each "k:v\n".
  const sortedNames = Object.keys(headers)
    .map((n) => n.toLowerCase())
    .sort();
  const lowerHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    lowerHeaders[k.toLowerCase()] = String(v).trim();
  }
  const canonicalHeaders = sortedNames
    .map((n) => `${n}:${lowerHeaders[n]}`)
    .join("\n");
  const signedHeaders = sortedNames.join(";");

  const canonicalRequest = [
    input.method.toUpperCase(),
    input.path,
    "", // canonical query string (SES SendEmail has none)
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = [
    SIGNING_ALGORITHM,
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = getSignatureKey(
    input.secretAccessKey,
    dateStamp,
    input.region,
    input.service
  );
  const signature = createHmac("sha256", signingKey)
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

// ---------------------------------------------------------------------------
// SES v2 SendEmail
// ---------------------------------------------------------------------------

/** Build the SES v2 SendEmail JSON body from a rendered email. */
export function buildSendEmailBody(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}): string {
  const body: {
    Html: { Data: string; Charset: string };
    Text?: { Data: string; Charset: string };
  } = { Html: { Data: params.html, Charset: "UTF-8" } };
  if (params.text) body.Text = { Data: params.text, Charset: "UTF-8" };

  return JSON.stringify({
    FromEmailAddress: params.from,
    Destination: { ToAddresses: [params.to] },
    Content: {
      Simple: {
        Subject: { Data: params.subject, Charset: "UTF-8" },
        Body: body,
      },
    },
  });
}

/**
 * Send one already-rendered email via the SES v2 API. Throws on missing creds
 * or a non-2xx response — callers decide whether that's fatal (email.mock.ts
 * fire-and-forgets it). Returns the SES MessageId on success.
 */
export async function sendViaSes(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ messageId: string }> {
  const creds = resolveSesCredentials();
  if (!creds) {
    throw new Error(
      "SES credentials missing: set AWS_SES_ACCESS_KEY_ID / AWS_SES_SECRET_ACCESS_KEY / AWS_SES_REGION"
    );
  }

  const host = `email.${creds.region}.amazonaws.com`;
  const path = "/v2/email/outbound-emails";
  const requestBody = buildSendEmailBody({
    from: resolveFrom(),
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });

  const signed = signAwsV4({
    method: "POST",
    host,
    path,
    region: creds.region,
    service: SERVICE,
    headers: {
      "content-type": "application/json",
      "x-amz-content-sha256": sha256Hex(requestBody),
    },
    body: requestBody,
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
  });

  const res = await fetch(`https://${host}${path}`, {
    method: "POST",
    headers: signed.headers,
    body: requestBody,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // detail is SES's error JSON (no recipient PII); safe to surface for logs.
    throw new Error(`SES SendEmail failed: ${res.status} ${detail}`);
  }

  const json = (await res.json().catch(() => ({}))) as { MessageId?: string };
  return { messageId: json.MessageId ?? "" };
}
