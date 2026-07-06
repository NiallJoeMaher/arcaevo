/**
 * /api/v1/waitlist — the early-access list (design §06 W6, §14 X5).
 *
 *  POST — join: { email, eircode, name?, planInterest? } → county queue
 *         position; sends E10. Idempotent per email: joining again returns
 *         the existing position (newly provided name/planInterest are still
 *         persisted onto the existing entry; nothing is ever unset).
 *         Same promise as the in-app waitlist: one email when the area opens,
 *         founding-member pricing honoured.
 *         Eligible routing keys 409 (already_eligible → checkout) ONLY while
 *         BLOOD_TIERS_ENABLED is on; while the flag is off checkout is closed,
 *         so eligible areas join the early-access list like everyone else.
 *  GET  — position: authenticated member (uses their email) or ?email=…
 *         (position + county only — nothing sensitive).
 */
import { requireMember } from "@/lib/auth";
import { AnalyticsEvent, capture } from "@/lib/analytics";
import { parseJsonBody, siteUrl } from "@/lib/api";
import { collections } from "@/lib/db";
import { checkEligibility } from "@/lib/eligibility";
import { sendEmail } from "@/lib/emails";
import { bloodTiersEnabled } from "@/lib/env";
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
  // "Head to checkout" is only a real answer while checkout is open. With
  // blood tiers flagged off (early-access gate), eligible areas fall through
  // and join the list too — county comes from checkEligibility as usual.
  if (result.status === "eligible" && bloodTiersEnabled()) {
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
    // Idempotent re-join, but not amnesiac: a plain /early-access join later
    // upgraded through the pricing form says "Noted for {plan}" — so persist
    // any newly provided name/planInterest onto the existing entry. Only the
    // fields actually sent are $set (a plain re-join never unsets anything);
    // no second E10; the response stays byte-identical (W-2 non-revealing).
    const updates: Record<string, unknown> = {};
    if (parsed.data.name) updates.name = parsed.data.name;
    if (parsed.data.planInterest) updates.planInterest = parsed.data.planInterest;
    if (Object.keys(updates).length > 0) {
      await waitlist.updateOne({ _id: existing._id }, { $set: updates });
    }
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
    // Early-access extras (pricing form) — pass-through, both optional.
    ...(parsed.data.name ? { name: parsed.data.name } : {}),
    ...(parsed.data.planInterest
      ? { planInterest: parsed.data.planInterest }
      : {}),
    // Launch-gate segment marker: this join can only reach here with an
    // ELIGIBLE key while BLOOD_TIERS_ENABLED is off (flag-on eligible keys
    // 409 above). They're waiting for sales to OPEN, not for their area —
    // /admin/waitlist keeps them out of the expansion-demand aggregates.
    ...(result.status === "eligible" ? { eligibleAtJoin: true } : {}),
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
