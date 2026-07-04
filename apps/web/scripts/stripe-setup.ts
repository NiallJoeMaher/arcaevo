/**
 * Stripe TEST-mode product/price setup — `npm run stripe:setup`.
 *
 * Idempotently creates one Product + one Billing Price for every Arcaevo SKU
 * (src/lib/vendors/stripe-config.ts), keyed by a stable `lookup_key`. Re-runs
 * find the existing price by lookup_key and DON'T duplicate. Prints the price
 * ids + ready-to-paste `STRIPE_PRICE_*` env lines.
 *
 * No SDK: talks to Stripe's REST API with fetch + form bodies. Uses the
 * `STRIPE_SECRET_KEY` from apps/web/.env.local (must be a `sk_test_…` key —
 * the script refuses a live key so it can never touch real money).
 *
 * Safe + reversible: TEST mode only. Delete the test products in the Dashboard
 * (Test mode) to reset.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ALL_SKUS, priceIdEnvVar } from "../src/lib/vendors/stripe-config";

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const STRIPE_API_VERSION = "2026-06-24.dahlia";

/** Load STRIPE_* vars from apps/web/.env.local into process.env (no dep). */
function loadEnvLocal(): void {
  try {
    const path = resolve(process.cwd(), ".env.local");
    const text = readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // No .env.local — rely on the ambient environment instead.
  }
}

function encodeForm(obj: Record<string, unknown>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    p.append(k, String(v));
  }
  return p.toString();
}

async function stripe<T = Record<string, unknown>>(
  method: "GET" | "POST",
  path: string,
  params?: Record<string, unknown>
): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  const isGet = method === "GET";
  const body = params ? encodeForm(params) : undefined;
  const url = isGet && body ? `${STRIPE_API_BASE}${path}?${body}` : `${STRIPE_API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Stripe-Version": STRIPE_API_VERSION,
      ...(isGet ? {} : { "Content-Type": "application/x-www-form-urlencoded" }),
    },
    body: isGet ? undefined : body,
  });
  const json = (await res.json().catch(() => ({}))) as T & {
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `Stripe ${method} ${path} → ${res.status}`);
  }
  return json;
}

async function findPriceByLookupKey(
  lookupKey: string
): Promise<{ id: string } | null> {
  const list = await stripe<{ data: Array<{ id: string }> }>("GET", "/prices", {
    "lookup_keys[]": lookupKey,
    active: "true",
    limit: 1,
  });
  return list.data?.[0] ?? null;
}

async function main() {
  loadEnvLocal();
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error(
      "✗ STRIPE_SECRET_KEY not found (checked apps/web/.env.local + env)."
    );
    process.exit(1);
  }
  if (!key.startsWith("sk_test_")) {
    console.error(
      "✗ Refusing to run: STRIPE_SECRET_KEY is not a TEST key (sk_test_…).\n" +
        "  This script is TEST-mode only. Set a test key in .env.local."
    );
    process.exit(1);
  }

  console.log("Arcaevo · Stripe TEST-mode product/price setup\n");
  const envLines: string[] = [];

  for (const sku of ALL_SKUS) {
    const existing = await findPriceByLookupKey(sku.lookupKey);
    let priceId: string;
    if (existing) {
      priceId = existing.id;
      console.log(`= ${sku.lookupKey.padEnd(28)} exists   ${priceId}`);
    } else {
      const product = await stripe<{ id: string }>("POST", "/products", {
        name: sku.name,
        "metadata[lookup_key]": sku.lookupKey,
      });
      const priceParams: Record<string, unknown> = {
        currency: "eur",
        unit_amount: Math.round(sku.amountEur * 100),
        product: product.id,
        lookup_key: sku.lookupKey,
        transfer_lookup_key: "true",
        "tax_behavior": "exclusive",
      };
      if (sku.mode === "subscription") {
        priceParams["recurring[interval]"] = "year";
      }
      const price = await stripe<{ id: string }>("POST", "/prices", priceParams);
      priceId = price.id;
      console.log(
        `+ ${sku.lookupKey.padEnd(28)} created  ${priceId}  (€${sku.amountEur} ${sku.mode})`
      );
    }
    envLines.push(`${priceIdEnvVar(sku.lookupKey)}=${priceId}`);
  }

  console.log(
    "\nDone. Prices are resolved by lookup_key at runtime, so these env lines\n" +
      "are OPTIONAL (they just pin ids to skip the lookup). To use them, paste\n" +
      "into apps/web/.env.local:\n"
  );
  console.log(envLines.join("\n"));
}

main().catch((err) => {
  console.error("✗ stripe:setup failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
