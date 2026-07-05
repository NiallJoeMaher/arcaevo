/**
 * /api/v1/share/[token] — one GP share link (design §15).
 *
 *  GET    — PUBLIC, read-only, no account needed: the clinician summary the
 *           GP page (/s/[token]) renders. Every open is appended to the
 *           access log the member sees. Revoked/expired → 410 Gone.
 *  DELETE — revoke (member auth; owner only). Links die instantly.
 *
 * Summary contents: lab values only — self-reported readings are EXCLUDED
 * from clinician-reviewed claims (§13) — with the reviewer's IMC number.
 * MOCK: the named clinician is the seeded review persona, not a real doctor.
 */
import { requireMember } from "@/lib/auth";
import { collections } from "@/lib/db";
import type { BiomarkerReading } from "@/lib/models";

// MOCK: clinician identity — replace with the real reviewing clinician.
const REVIEWER = "Dr. S. Nolan, IMC 412887";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const shareLinks = await collections.shareLinks();
  const link = await shareLinks.findOne({ token });
  if (!link) {
    return Response.json(
      { error: "not_found", message: "This link doesn't exist." },
      { status: 404 }
    );
  }
  if (link.revoked || link.expiresAt.getTime() <= Date.now()) {
    return Response.json(
      {
        error: "gone",
        message:
          "This share link has been revoked or has expired. Ask the member for a fresh one.",
      },
      { status: 410 }
    );
  }

  // Consent gate on the PUBLIC endpoint (security audit W-1): if the owning
  // member has withdrawn health_processing consent or started account closure
  // (processingSuspended / status closing|closed), refuse to disclose their
  // Art.9 lab values — even if the link's own 30-day TTL hasn't elapsed yet.
  // Withdrawal also revokes the link (suspendProcessingForWithdrawal), so this
  // is defence-in-depth for a link created/raced around the withdrawal.
  const member = await collections
    .users()
    .then((c) => c.findOne({ _id: link.userId }));
  if (!member) {
    return Response.json(
      { error: "gone", message: "This account no longer exists." },
      { status: 410 }
    );
  }
  if (
    member.processingSuspended ||
    member.status === "closing" ||
    member.status === "closed"
  ) {
    return Response.json(
      {
        error: "gone",
        message:
          "This share link has been revoked or has expired. Ask the member for a fresh one.",
      },
      { status: 410 }
    );
  }

  // Access is logged and shown to the member ("Opened twice — Dublin, 3 July").
  // MOCK: coarse location is hardcoded — a real deployment would GeoIP the
  // request (city-level only, never stored beyond this log).
  await shareLinks.updateOne(
    { _id: link._id },
    { $push: { accessLog: { at: new Date(), location: "Dublin" } } }
  );

  const readings = await collections.biomarkerReadings().then((c) =>
    c
      .find({ memberId: link.userId, source: "lab" }) // lab values only
      .sort({ takenAt: 1 })
      .toArray()
  );

  // Last two lab values per marker → the Feb/Jul columns of the GP table.
  const byCode = new Map<string, BiomarkerReading[]>();
  for (const reading of readings) {
    const list = byCode.get(reading.code) ?? [];
    list.push(reading);
    byCode.set(reading.code, list);
  }
  const rules = await collections
    .biomarkerRules()
    .then((c) => c.find().toArray());
  const ruleByCode = new Map(rules.map((r) => [r.code, r]));

  const rows = [...byCode.entries()].map(([code, series]) => {
    const current = series.at(-1)!;
    const previous = series.length > 1 ? series.at(-2)! : null;
    const rule = ruleByCode.get(code);
    return {
      code,
      name: rule?.name ?? code,
      unit: current.unit,
      previous: previous
        ? { value: previous.value, takenAt: previous.takenAt }
        : null,
      current: { value: current.value, takenAt: current.takenAt },
      rcvVerdict: current.rcvVerdict,
      clinicianReviewed: current.clinicianReviewed,
    };
  });

  return Response.json({
    member: { name: member.name },
    sharedAt: link.createdAt,
    expiresAt: link.expiresAt,
    reviewedBy: REVIEWER, // MOCK persona
    labNote: "Clinician summary · lab values from VHI-accredited partner lab",
    rows,
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const auth = await requireMember(req);
  if (auth.denied) return auth.denied;

  const { token } = await params;
  const shareLinks = await collections.shareLinks();
  const link = await shareLinks.findOne({ token });
  if (!link || link.userId !== auth.member._id) {
    return Response.json(
      { error: "not_found", message: "No such share link on your account." },
      { status: 404 }
    );
  }
  await shareLinks.updateOne({ _id: link._id }, { $set: { revoked: true } });
  return Response.json({ ok: true, revoked: true, token });
}
