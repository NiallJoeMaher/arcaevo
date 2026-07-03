/**
 * Eircode eligibility — the Dublin gate (design_handoff_v2 §06).
 *
 * Rules (README §3):
 *  - Only the ROUTING KEY (first 3 characters) is ever validated or stored.
 *  - Checked only at checkout for Essential/Performance. Fusion is never gated.
 *  - The allowlist is CONFIG, not code: it lives in the `eligibility_config`
 *    Mongo collection (seeded with LAUNCH_ALLOWLIST). Widening to Cork is a
 *    data change.
 *  - Every rejected routing key is logged (key only, no address) to the
 *    `eligibility_rejections` collection to drive expansion by demand.
 *
 * The pure functions (extractRoutingKey / evaluateRoutingKey / countyFor…)
 * carry all the validation logic and are unit-tested without Mongo.
 */
import { collections } from "@/lib/db";
import { newId } from "@/lib/ids";

/** Launch allowlist, verbatim from the handoff:
 * D01–D18, D20, D22, D24, D6W, A94, A96, K32, K34, K36, K45, K56, K67, K78. */
export const LAUNCH_ALLOWLIST: readonly string[] = [
  ...Array.from({ length: 18 }, (_, i) => `D${String(i + 1).padStart(2, "0")}`),
  "D20",
  "D22",
  "D24",
  "D6W",
  "A94",
  "A96",
  "K32",
  "K34",
  "K36",
  "K45",
  "K56",
  "K67",
  "K78",
];

/**
 * Eircode routing keys are a letter + 2 alphanumerics (digits everywhere
 * except the one special case D6W). Full Eircodes append a 4-char unique
 * identifier we deliberately never look at.
 */
const ROUTING_KEY_RE = /^(?:[A-Z]\d{2}|D6W)$/;

/**
 * Extract the routing key from user input — case/space tolerant.
 * Accepts a full Eircode ("d08 xy24") or just the key ("D08").
 * Returns null when the input can't be a valid routing key.
 */
export function extractRoutingKey(input: string): string | null {
  const compact = input.toUpperCase().replace(/\s+/g, "");
  // Routing key alone (3 chars) up to a full Eircode (7). Anything longer is
  // not an Eircode; anything shorter can't contain a routing key.
  if (compact.length < 3 || compact.length > 7) return null;
  const key = compact.slice(0, 3);
  return ROUTING_KEY_RE.test(key) ? key : null;
}

export type EligibilityStatus = "invalid" | "eligible" | "ineligible";

export interface EligibilityEvaluation {
  status: EligibilityStatus;
  /** Null only when status is "invalid". */
  routingKey: string | null;
  county: string | null;
}

/** Pure evaluation of an input against an allowlist. */
export function evaluateRoutingKey(
  input: string,
  allowlist: readonly string[]
): EligibilityEvaluation {
  const routingKey = extractRoutingKey(input);
  if (!routingKey) return { status: "invalid", routingKey: null, county: null };
  const county = countyForRoutingKey(routingKey);
  return {
    status: allowlist.includes(routingKey) ? "eligible" : "ineligible",
    routingKey,
    county,
  };
}

/**
 * Approximate county for a routing key — used for waitlist grouping and the
 * "Not in Cork yet" copy. Coarse and deliberately incomplete: unknown keys
 * fall back to "Ireland". (Real Eircode → county needs the Eircode DB.)
 */
const COUNTY_BY_KEY: Record<string, string> = {
  T12: "Cork", T23: "Cork", T45: "Cork", P31: "Cork", P43: "Cork",
  H91: "Galway", H53: "Galway", H62: "Galway",
  V94: "Limerick", V35: "Limerick", V42: "Limerick",
  X91: "Waterford", X35: "Waterford",
  V92: "Kerry", V93: "Kerry",
  R95: "Kilkenny",
  Y35: "Wexford", Y25: "Wexford",
  A91: "Louth", A92: "Louth",
  W23: "Kildare", W12: "Kildare", R14: "Kildare",
  A63: "Wicklow", A67: "Wicklow", A98: "Wicklow",
  C15: "Meath", A82: "Meath", A85: "Meath",
  N37: "Westmeath", N91: "Westmeath",
  F91: "Sligo", F92: "Donegal", F93: "Donegal", F94: "Leitrim",
  E91: "Tipperary", E34: "Tipperary",
  V15: "Clare", V95: "Clare",
  H12: "Cavan", H14: "Monaghan", H18: "Monaghan",
  N39: "Longford", R32: "Laois", R42: "Offaly", F35: "Mayo", F23: "Mayo",
  H65: "Roscommon", R21: "Carlow",
};

export function countyForRoutingKey(routingKey: string): string {
  if (routingKey.startsWith("D") || routingKey === "A94" || routingKey === "A96")
    return "Dublin";
  if (routingKey.startsWith("K")) return "Dublin"; // K32–K78 = north Co. Dublin
  return COUNTY_BY_KEY[routingKey] ?? "Ireland";
}

/** Load the live allowlist from config (falls back to the launch list). */
export async function loadAllowlist(): Promise<readonly string[]> {
  const config = await collections
    .eligibilityConfig()
    .then((c) => c.findOne({ _id: "launch" }));
  return config?.allowedRoutingKeys ?? LAUNCH_ALLOWLIST;
}

/**
 * Full check: evaluates the input against the configured allowlist and logs
 * rejected routing keys (key only — never an address, never an email).
 */
export async function checkEligibility(
  input: string
): Promise<EligibilityEvaluation> {
  const evaluation = evaluateRoutingKey(input, await loadAllowlist());
  if (evaluation.status === "ineligible" && evaluation.routingKey) {
    const rejections = await collections.eligibilityRejections();
    await rejections.insertOne({
      _id: newId("elig_rej"), // collision-free (see lib/ids)
      routingKey: evaluation.routingKey,
      county: evaluation.county ?? "Ireland",
      at: new Date(),
    });
  }
  return evaluation;
}
