#!/usr/bin/env node
/**
 * Arcaevo AWS footprint — CDK entrypoint.
 * eu-west-1 everywhere (EU data residency, per the design handoff).
 */
import * as cdk from "aws-cdk-lib";
import { ArcaevoStack } from "../lib/arcaevo-stack";
import { ArcaevoEmailStack } from "../lib/arcaevo-email-stack";

const app = new cdk.App();

// eu-west-1 everywhere; account comes from the deploying credentials.
const env = {
  region: "eu-west-1",
  account: process.env.CDK_DEFAULT_ACCOUNT,
};

new ArcaevoStack(app, "ArcaevoStack", {
  env,
  description:
    "Arcaevo AWS footprint: exports bucket + secret placeholders. Web is on Vercel; MongoDB Atlas is external (eu-west-1).",
});

// SES transactional email (domain identity + scoped SMTP sender). Kept separate
// so DNS verification / sandbox lifecycle doesn't churn the core stack.
new ArcaevoEmailStack(app, "ArcaevoEmailStack", {
  env,
  description:
    "Arcaevo SES email: domain identity (Easy DKIM) + least-privilege SMTP IAM user for the nodemailer adapter (eu-west-1).",
});
