/**
 * /api/v1/waitlist — the early-access list (design §06 W6, §14 X5).
 *
 *  POST — join: { email, eircode } → county queue position; sends E10.
 *         Idempotent per email: joining again returns the existing position.
 *  GET  — position: authenticated member (uses their email) or ?email=…
 *         (position + county only — nothing sensitive).
 */
import { memberFromRequest } from "@/lib/auth";
import { parseJsonBody, siteUrl } from "@/lib/api";
import { collections } from "@/lib/db";
import { checkEligibility } from "@/lib/eligibility";
import { sendEmail } from "@/lib/emails";
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

  const existing = await waitlist.findOne({ email });
  if (existing) {
    return Response.json({
      ok: true,
      alreadyJoined: true,
      position: existing.position,
      county: existing.county,
    });
  }

  const position = (await waitlist.countDocuments({ county })) + 1;
  const total = await waitlist.countDocuments();
  const entry = {
    _id: `wait_${String(total + 1).padStart(4, "0")}`,
    email,
    routingKey: result.routingKey,
    county,
    position,
    createdAt: new Date(),
  };
  await waitlist.insertOne(entry);

  // E10 — confirmation immediately; monthly updates + the county-open E11
  // (30-day founding-member window) come later from ops.
  await sendEmail("e10_waitlist_joined", email, {
    county,
    position,
    fusionUrl: `${siteUrl()}/pricing`,
  });

  return Response.json(
    { ok: true, alreadyJoined: false, position, county },
    { status: 201 }
  );
}

export async function GET(req: Request) {
  const member = await memberFromRequest(req);
  const emailParam = new URL(req.url).searchParams.get("email");
  const email = (member?.email ?? emailParam)?.toLowerCase();
  if (!email) {
    return Response.json(
      {
        error: "bad_request",
        message: "Sign in or pass ?email= to look up a waitlist position.",
      },
      { status: 400 }
    );
  }
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
