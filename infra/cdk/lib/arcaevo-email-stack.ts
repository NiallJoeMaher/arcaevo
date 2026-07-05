/**
 * ArcaevoEmailStack — AWS SES for transactional email (eu-west-1, EU data residency).
 *
 * This is a SEPARATE stack from ArcaevoStack on purpose: email infra has its
 * own lifecycle (DNS verification, sandbox → production access) and its own
 * IAM principal, and we don't want to redeploy the exports bucket / secret
 * placeholders every time email changes.
 *
 * What it provisions:
 *   1. An SES v2 EmailIdentity for the sending domain, with Easy DKIM +
 *      a custom MAIL FROM subdomain (for SPF/DMARC alignment).
 *   2. A least-privilege IAM user (ses:SendEmail / ses:SendRawEmail only,
 *      scoped to this identity + a ses:FromAddress condition) with an
 *      AccessKey — its id is the SES-SMTP username.
 *   3. A Secrets Manager secret holding the IAM *secret access key* (NOT the
 *      SMTP password — that is derived from it; see scripts/ses-smtp-password.mjs).
 *      The secret is never emitted in a plaintext CfnOutput.
 *
 * The web app (apps/web) speaks SMTP to SES via the existing nodemailer adapter
 * (email.smtp.ts) — nothing in apps/web changes; this only produces the
 * credentials + DNS records it consumes. See SES_SETUP.md for the walkthrough.
 */
import * as cdk from "aws-cdk-lib";
import * as ses from "aws-cdk-lib/aws-ses";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

/**
 * DEFAULT sending domain. NOT finally confirmed (arcaevo.com vs arcaevo.health)
 * — this is the single place to change it. Override without editing code via:
 *   npx cdk synth -c sendingDomain=arcaevo.health
 * (or set "sendingDomain" under "context" in cdk.json).
 */
const DEFAULT_SENDING_DOMAIN = "arcaevo.com";

export class ArcaevoEmailStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Domain is a single easily-changed knob: context param wins, else default.
    const sendingDomain =
      (this.node.tryGetContext("sendingDomain") as string | undefined)?.trim() ||
      DEFAULT_SENDING_DOMAIN;

    // Custom MAIL FROM subdomain — makes the bounce/Return-Path align to our
    // own domain (better SPF alignment + deliverability) instead of amazonses.com.
    const mailFromDomain = `mail.${sendingDomain}`;

    // --- SES: domain identity with Easy DKIM ---------------------------------
    const identity = new ses.EmailIdentity(this, "SendingDomainIdentity", {
      identity: ses.Identity.domain(sendingDomain),
      // Easy DKIM: AWS manages the 2048-bit keys; we publish 3 CNAMEs (below).
      dkimSigning: true,
      // Route bounces/complaints through our own subdomain (needs MX + SPF TXT
      // on mail.<domain>; those records are documented in SES_SETUP.md).
      mailFromDomain,
      // If the MAIL FROM MX isn't set up yet, fall back to amazonses.com so
      // sending still works while DNS propagates.
      mailFromBehaviorOnMxFailure:
        ses.MailFromBehaviorOnMxFailure.USE_DEFAULT_VALUE,
    });

    // ARN of the verified identity — used to scope the send policy to THIS domain.
    const identityArn = this.formatArn({
      service: "ses",
      resource: "identity",
      resourceName: sendingDomain,
    });

    // --- IAM: least-privilege SMTP sender ------------------------------------
    const smtpUser = new iam.User(this, "SmtpUser", {
      userName: "arcaevo-ses-smtp",
    });

    // Only the two send actions the nodemailer transport needs, scoped to this
    // identity, and further constrained so it may only send AS our own domain.
    smtpUser.addToPolicy(
      new iam.PolicyStatement({
        sid: "SendTransactionalEmailFromArcaevoDomain",
        effect: iam.Effect.ALLOW,
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: [identityArn],
        conditions: {
          // May only send with a From address at our sending domain.
          StringLike: { "ses:FromAddress": `*@${sendingDomain}` },
        },
      }),
    );

    // Programmatic credential. accessKeyId → SES-SMTP username (safe to output);
    // secretAccessKey → NOT the SMTP password (that's derived) and never output.
    const accessKey = new iam.AccessKey(this, "SmtpAccessKey", {
      user: smtpUser,
    });

    // --- Secrets Manager: hold the IAM secret access key ---------------------
    // We store the raw IAM secret (used to DERIVE the SMTP password) here rather
    // than in a CfnOutput, so it never appears in plaintext CloudFormation.
    const smtpSecret = new secretsmanager.Secret(this, "SesSmtpSecret", {
      secretName: "arcaevo/ses-smtp",
      description:
        "SES SMTP sender IAM secret access key. NOT the SMTP password — derive that with infra/cdk/scripts/ses-smtp-password.mjs (SigV4 HMAC), then set SMTP_PASS in the web env.",
      secretStringValue: accessKey.secretAccessKey,
    });

    // --- Outputs (never the secret in plaintext) -----------------------------
    new cdk.CfnOutput(this, "SendingDomain", {
      value: sendingDomain,
      description: "Verified SES sending domain",
    });

    new cdk.CfnOutput(this, "SmtpUsername", {
      value: accessKey.accessKeyId,
      description:
        "SES-SMTP username → set as SMTP_USER in the web env (this IS the IAM access key id; safe to expose).",
    });

    new cdk.CfnOutput(this, "SmtpSecretArn", {
      value: smtpSecret.secretArn,
      description:
        "Secrets Manager ARN holding the IAM secret access key. Retrieve it, then derive SMTP_PASS with scripts/ses-smtp-password.mjs.",
    });

    new cdk.CfnOutput(this, "SmtpEndpoint", {
      value: `email-smtp.${this.region}.amazonaws.com`,
      description: "SMTP_HOST for the web env (STARTTLS :587 / TLS :465).",
    });

    new cdk.CfnOutput(this, "MailFromDomain", {
      value: mailFromDomain,
      description:
        "Custom MAIL FROM subdomain — add its MX + SPF TXT records (see SES_SETUP.md).",
    });

    // Easy DKIM CNAMEs the user must publish (3 records). Names/values are
    // resolved at deploy time from the identity's DKIM tokens.
    new cdk.CfnOutput(this, "DkimCname1Name", {
      value: identity.dkimDnsTokenName1,
      description: "DKIM CNAME #1 — record name",
    });
    new cdk.CfnOutput(this, "DkimCname1Value", {
      value: identity.dkimDnsTokenValue1,
      description: "DKIM CNAME #1 — record value",
    });
    new cdk.CfnOutput(this, "DkimCname2Name", {
      value: identity.dkimDnsTokenName2,
      description: "DKIM CNAME #2 — record name",
    });
    new cdk.CfnOutput(this, "DkimCname2Value", {
      value: identity.dkimDnsTokenValue2,
      description: "DKIM CNAME #2 — record value",
    });
    new cdk.CfnOutput(this, "DkimCname3Name", {
      value: identity.dkimDnsTokenName3,
      description: "DKIM CNAME #3 — record name",
    });
    new cdk.CfnOutput(this, "DkimCname3Value", {
      value: identity.dkimDnsTokenValue3,
      description: "DKIM CNAME #3 — record value",
    });
  }
}
