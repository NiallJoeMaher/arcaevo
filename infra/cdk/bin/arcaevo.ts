#!/usr/bin/env node
/**
 * Arcaevo AWS footprint — CDK entrypoint.
 * eu-west-1 everywhere (EU data residency, per the design handoff).
 */
import * as cdk from "aws-cdk-lib";
import { ArcaevoStack } from "../lib/arcaevo-stack";

const app = new cdk.App();

new ArcaevoStack(app, "ArcaevoStack", {
  env: {
    region: "eu-west-1",
    // Account comes from the deploying credentials (CDK_DEFAULT_ACCOUNT).
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  description:
    "Arcaevo AWS footprint: exports bucket + secret placeholders. Web is on Vercel; MongoDB Atlas is external (eu-west-1).",
});
