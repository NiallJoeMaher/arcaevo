import { execSync } from "node:child_process";

/** Reseed before every run so DB-mutating specs stay deterministic. */
export default function globalSetup() {
  execSync("npx tsx scripts/seed.ts", {
    cwd: __dirname + "/..",
    stdio: "inherit",
    env: {
      ...process.env,
      MONGODB_URI:
        process.env.MONGODB_URI ?? "mongodb://localhost:27019/arcaevo",
    },
  });
}
