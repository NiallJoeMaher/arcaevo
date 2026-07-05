#!/usr/bin/env node
/**
 * Derive an AWS SES SMTP password from an IAM secret access key.
 *
 * The SES SMTP username is the IAM *access key id* as-is. The SMTP *password*
 * is NOT the raw IAM secret access key — it is a SigV4-style HMAC derivation of
 * it (region-signed, versioned). This script implements AWS's documented
 * algorithm so you can convert the secret we store in Secrets Manager
 * (arcaevo/ses-smtp) into the SMTP_PASS the nodemailer adapter needs.
 *
 * Ref: AWS SES Developer Guide — "Converting an existing IAM secret access key
 * to an SES SMTP password" (Signature Version 4).
 *
 * Usage:
 *   node scripts/ses-smtp-password.mjs <SECRET_ACCESS_KEY> [region]
 *   node scripts/ses-smtp-password.mjs "$(aws secretsmanager get-secret-value \
 *        --secret-id arcaevo/ses-smtp --query SecretString --output text)" eu-west-1
 *
 * region defaults to eu-west-1 (this project's region). Output is the SMTP
 * password — set it as SMTP_PASS. Nothing is logged except the result.
 */
import { createHmac } from "node:crypto";

// Constants fixed by the AWS derivation algorithm.
const DATE = "11111111"; // literal, not a real date
const SERVICE = "ses";
const MESSAGE = "SendRawEmail";
const TERMINAL = "aws4_request";
const VERSION = 0x04; // SMTP password format version byte

/** HMAC-SHA256 over raw bytes, returning a Buffer. */
function hmac(key, data) {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

/**
 * @param {string} secretAccessKey - the IAM secret access key
 * @param {string} region - e.g. "eu-west-1"
 * @returns {string} the SES SMTP password (base64)
 */
export function deriveSmtpPassword(secretAccessKey, region) {
  let sig = hmac(`AWS4${secretAccessKey}`, DATE);
  sig = hmac(sig, region);
  sig = hmac(sig, SERVICE);
  sig = hmac(sig, TERMINAL);
  sig = hmac(sig, MESSAGE);
  // Prepend the version byte, then base64-encode.
  return Buffer.concat([Buffer.from([VERSION]), sig]).toString("base64");
}

// CLI entrypoint (skipped when imported for tests).
const invokedDirectly =
  process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  const secret = process.argv[2];
  const region = process.argv[3] || "eu-west-1";
  if (!secret) {
    console.error(
      "Usage: node scripts/ses-smtp-password.mjs <SECRET_ACCESS_KEY> [region]",
    );
    process.exit(1);
  }
  process.stdout.write(deriveSmtpPassword(secret, region) + "\n");
}
