/**
 * ArcaevoStack — the (deliberately minimal) AWS footprint.
 *
 * Context: the Next.js app is hosted on Vercel and MongoDB lives in Atlas
 * (eu-west-1) — neither is provisioned here. AWS holds:
 *   1. An S3 bucket for GDPR member data exports (self-serve export/delete).
 *   2. Secrets Manager placeholders for the third-party credentials the web
 *      app + future workers read (Mongo URI, Stripe, LetsGetChecked).
 */
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export class ArcaevoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- S3: member data exports (GDPR self-serve export) -------------------
    const exportsBucket = new s3.Bucket(this, "MemberExportsBucket", {
      bucketName: undefined, // let CloudFormation generate a unique name
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: false,
      lifecycleRules: [
        {
          id: "expire-exports",
          // Export bundles are download-once artifacts; purge after 30 days.
          expiration: cdk.Duration.days(30),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN, // member data — never auto-delete
    });

    // --- Secrets Manager: placeholders (values set out-of-band, never in code)
    const mongoSecret = new secretsmanager.Secret(this, "MongoDbUriSecret", {
      secretName: "arcaevo/mongodb-uri",
      description:
        "PLACEHOLDER — MongoDB Atlas (eu-west-1) connection string for MONGODB_URI. Set the real value in the console/CLI; Atlas itself is external to this stack.",
    });

    const stripeSecret = new secretsmanager.Secret(this, "StripeKeysSecret", {
      secretName: "arcaevo/stripe",
      description:
        "PLACEHOLDER — Stripe secret key + webhook signing secret (JSON). Payments are MOCKED until a real EU-entity Stripe account exists (docs/MOCKED_APIS.md §2).",
    });

    const lgcSecret = new secretsmanager.Secret(this, "LetsGetCheckedSecret", {
      secretName: "arcaevo/letsgetchecked",
      description:
        "PLACEHOLDER — LetsGetChecked API credentials + webhook secret (JSON). Vendor is MOCKED until the partner agreement is signed (docs/MOCKED_APIS.md §1).",
    });

    // --- Outputs -------------------------------------------------------------
    new cdk.CfnOutput(this, "ExportsBucketName", {
      value: exportsBucket.bucketName,
      description: "S3 bucket for GDPR member data exports",
    });
    new cdk.CfnOutput(this, "MongoDbUriSecretArn", { value: mongoSecret.secretArn });
    new cdk.CfnOutput(this, "StripeSecretArn", { value: stripeSecret.secretArn });
    new cdk.CfnOutput(this, "LetsGetCheckedSecretArn", { value: lgcSecret.secretArn });
  }
}
