import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for the multi-stage Dockerfile (node server.js runner).
  output: "standalone",
};

export default nextConfig;
