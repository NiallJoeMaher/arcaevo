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

    // Two modes:
    //  • senderEmail context set  → verify a SINGLE email address (no DNS/DKIM;
    //    SES emails a confirmation link). Used for the interim trial sender
    //    (e.g. niall@codu.ie) while no arcaevo.com DNS is under our control.
    //      npx cdk deploy ArcaevoEmailStack -c senderEmail=niall@codu.ie
    //  • otherwise                → verify the sending DOMAIN with Easy DKIM +
    //    custom MAIL FROM (the production path; use a subdomain of arcaevo.com
    //    such as mail.arcaevo.com to insulate the apex domain's reputation).
    const senderEmail = (
      this.node.tryGetContext("senderEmail") as string | undefined
    )?.trim();
    const sendingDomain =
      (this.node.tryGetContext("sendingDomain") as string | undefined)?.trim() ||
      DEFAULT_SENDING_DOMAIN;
    const mailFromDomain = `mail.${sendingDomain}`;

    // The verified identity + the ARN/From condition the IAM policy is scoped to.
    // In domain mode CDK creates + manages the identity; in single-email mode we
    // do NOT create it (the address is verified out-of-band via SES's emailed
    // confirmation link — and may already exist in the account), we just scope
    // the IAM sender to its ARN.
    let identity: ses.EmailIdentity | undefined;
    let identityResourceName: string;
    let fromAddressCondition: string;

    if (senderEmail) {
      // --- Single verified email address (interim, no DNS) -------------------
      // Verify it once via: aws ses verify-email-identity --email-address <addr>
      // (SES emails a confirmation link). Not CFN-managed to avoid clashing with
      // an already-verified address.
      identityResourceName = senderEmail;
      fromAddressCondition = senderEmail; // may only send AS exactly this address
    } else {
      // --- Domain identity with Easy DKIM (production) -----------------------
      identity = new ses.EmailIdentity(this, "SendingDomainIdentity", {
        identity: ses.Identity.domain(sendingDomain),
        dkimSigning: true,
        mailFromDomain,
        mailFromBehaviorOnMxFailure:
          ses.MailFromBehaviorOnMxFailure.USE_DEFAULT_VALUE,
      });
      identityResourceName = sendingDomain;
      fromAddressCondition = `*@${sendingDomain}`;
    }

    // ARN of the verified identity — scopes the send policy to THIS identity.
    const identityArn = this.formatArn({
      service: "ses",
      resource: "identity",
      resourceName: identityResourceName,
    });

    // --- IAM: least-privilege SMTP sender ------------------------------------
    // NAMING NOTE: "SmtpUser"/arcaevo-ses-smtp started as the SES-only sender,
    // but its access keys are the app-wide ARCAEVO_AWS_* credentials in the web
    // env, and the user now also carries the Bedrock narration grant below.
    // Do NOT rename the construct or userName — CloudFormation would REPLACE
    // the IAM user, rotating the access keys and breaking the deployed env.
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
          // May only send AS the verified identity (single address, or any
          // address at the verified domain).
          StringLike: { "ses:FromAddress": fromAddressCondition },
        },
      }),
    );

    // --- Bedrock: AI-narration + bloodwork-OCR InvokeModel
    // (apps/web, docs/MOCKED_APIS.md §11 + §20)
    // The web app's ARCAEVO_AWS_* creds (this user's access key) sign Bedrock
    // InvokeModel calls for BOTH insight narration AND bloodwork OCR — both use
    // the classic bedrock-runtime InvokeModel path (narration via hand-rolled
    // SigV4; OCR via `AnthropicBedrock` from @anthropic-ai/bedrock-sdk, which
    // targets the same InvokeModel API) against the SAME Haiku EU inference
    // profile, so this single grant covers both features with no extra action
    // or resource. Invoking via a cross-region INFERENCE PROFILE authorizes
    // against BOTH the profile ARN AND the underlying foundation-model ARNs it
    // routes to, so the statement needs both resources. Live-verified
    // 2026-07-06: the EU profile id works in eu-west-1; the bare
    // foundation-model id is REJECTED for on-demand invocation ("Retry with an
    // inference profile"), so the profile is the only invocation path — but the
    // model ARNs must still be allowed. Foundation-model ARNs are region-scoped
    // with an EMPTY account field; the region wildcard tolerates AWS changing
    // the EU routing set while staying least-privilege on the single MODEL id.
    smtpUser.addToPolicy(
      new iam.PolicyStatement({
        sid: "InvokeClaudeHaikuForNarrationAndOcr",
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:InvokeModel"],
        resources: [
          `arn:aws:bedrock:eu-west-1:${this.account}:inference-profile/eu.anthropic.claude-haiku-4-5-20251001-v1:0`,
          "arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
        ],
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
    new cdk.CfnOutput(this, "SesIdentity", {
      value: senderEmail ?? sendingDomain,
      description: senderEmail
        ? "Verified SES sender EMAIL (check its inbox for the AWS confirmation link)"
        : "Verified SES sending DOMAIN",
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

    // Domain-mode only: the MAIL FROM subdomain + the 3 Easy-DKIM CNAMEs the
    // user must publish. (Single-email identities have no DKIM/MAIL FROM.)
    if (!senderEmail && identity) {
      new cdk.CfnOutput(this, "MailFromDomain", {
        value: mailFromDomain,
        description:
          "Custom MAIL FROM subdomain — add its MX + SPF TXT records (see SES_SETUP.md).",
      });
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
}
