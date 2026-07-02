/**
 * POST /api/v1/eligibility/check — the Eircode gate (design §06 W5/W6).
 *
 * Body: { eircode } — full Eircode or routing key; case/space tolerant.
 * No auth: checkout step 1 happens before an account may exist.
 *
 * Only the routing key (first 3 chars) is validated; it is NOT stored until
 * an order is placed — except rejected keys, which are logged (key only, no
 * address) to drive expansion by demand.
 */
import { parseJsonBody } from "@/lib/api";
import { checkEligibility } from "@/lib/eligibility";
import { EligibilityCheckInput } from "@/lib/models";

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, EligibilityCheckInput);
  if (!parsed.ok) return parsed.response;

  const result = await checkEligibility(parsed.data.eircode);

  if (result.status === "invalid") {
    return Response.json(
      {
        error: "invalid_eircode",
        message:
          "That doesn't look like an Eircode — we only need the first 3 characters (e.g. D08).",
      },
      { status: 422 }
    );
  }

  return Response.json({
    eligible: result.status === "eligible",
    routingKey: result.routingKey,
    county: result.county,
    ...(result.status === "eligible"
      ? { message: "You're in the Dublin service area" }
      : {
          message: `Not in ${result.county} yet — but you're next.`,
          // The refusal sells: a reason, a promise, and a real alternative.
          waitlist: true,
          fusionAlternative: {
            tier: "fusion",
            priceEur: 119,
            note: "Fusion works anywhere: your watch + any past bloodwork.",
          },
        }),
  });
}
