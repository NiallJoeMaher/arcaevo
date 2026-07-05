/**
 * /api/v1/waitlist — the early-access list (design §06 W6, §14 X5).
 *
 *  POST — join: { email, eircode } → county queue position; sends E10.
 *         Idempotent per email: joining again returns the existing position.
 *  GET  — position: authenticated member (uses their email) or ?email=…
 *         (position + county only — nothing sensitive).
 */
import { requireMember } from "@/lib/auth";
import { AnalyticsEvent, capture } from "@/lib/analytics";
import { parseJsonBody, siteUrl } from "@/lib/api";
import { collections } from "@/lib/db";
import { checkEligibility } from "@/lib/eligibility";
import { sendEmail } from "@/lib/emails";
import { newId } from "@/lib/ids";
import { WaitlistJoinInput } from "@/lib/models";

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, WaitlistJoinInput);
  if (!parsed.ok) return parsed.response;
  const email = parsed.data.email.toLowerCase();

  const result = await checkEligibility(parsed.data.eircode);
  if (result.status === "invalid" || !result.routingKey) {
    return Response.json(
      {
        error: "invalid_eircode",
        message:
          "That doesn't look like an Eircode — we only need the first 3 characters (e.g. T12).",
      },
      { status: 422 }
    );
  }
  if (result.status === "eligible") {
    return Response.json(
      {
        error: "already_eligible",
        message:
          "Good news — you're already in the service area. Head to checkout instead.",
        routingKey: result.routingKey,
      },
      { status: 409 }
    );
  }

  const waitlist = await collections.waitlist();
  const county = result.county ?? "Ireland";

  // Non-revealing join (security audit W-2): the response is IDENTICAL whether
  // or not the email was already on the list — same shape, same 201, no
  // `alreadyJoined` tell — so a third party can't probe an arbitrary address to
  // learn whether it's registered. Re-joining is still idempotent (returns the
  // existing position) and does NOT re-send E10 (avoids confirmation spam).
  const existing = await waitlist.findOne({ email });
  if (existing) {
    return Response.json(
      { ok: true, position: existing.position, county: existing.county },
      { status: 201 }
    );
  }

  const position = (await waitlist.countDocuments({ county })) + 1;
  const entry = {
    _id: newId("wait"), // collision-free (security audit W-4; see lib/ids)
    email,
    routingKey: result.routingKey,
    county,
    position,
    createdAt: new Date(),
  };
  await waitlist.insertOne(entry);

  // Funnel: a genuine new join (re-joins above return early, so no double-count).
  // distinctId is the waitlist id (no member id yet); county is coarse geo.
  capture(
    AnalyticsEvent.WaitlistJoined,
    { county, routingKey: result.routingKey, position },
    entry._id
  );

  // E10 — confirmation immediately; monthly updates + the county-open E11
  // (30-day founding-member window) come later from ops.
  await sendEmail("e10_waitlist_joined", email, {
    county,
    position,
    fusionUrl: `${siteUrl()}/pricing`,
  });

  return Response.json({ ok: true, position, county }, { status: 201 });
}

export async function GET(req: Request) {
  // Member-scoped only (security audit W-2): the previous `?email=` bypass let
  // anyone confirm whether an arbitrary address was on the waitlist (+ county /
  // join date). A member may only look up THEIR OWN position.
  const auth = await requireMember(req);
  if (auth.denied) return auth.denied;
  const email = auth.member.email.toLowerCase();

  const entry = await collections
    .waitlist()
    .then((c) => c.findOne({ email }));
  if (!entry) {
    return Response.json({ onWaitlist: false });
  }
  return Response.json({
    onWaitlist: true,
    position: entry.position,
    county: entry.county,
    joinedAt: entry.createdAt,
  });
}
