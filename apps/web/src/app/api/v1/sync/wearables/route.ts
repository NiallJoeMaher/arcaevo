/**
 * POST /api/v1/sync/wearables — bearer: upsert daily wearable signals.
 * v1 integrations: Apple Watch + Apple Health ONLY. Any other source is
 * rejected with a roadmap message (WHOOP/Oura/Garmin are "on the roadmap").
 */
import { requireMember } from "@/lib/auth";
import { collections } from "@/lib/db";
import { SyncWearablesInput, WearableSource } from "@/lib/models";

export async function POST(req: Request) {
  const auth = await requireMember(req);
  if (auth.denied) return auth.denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "bad_request", message: "Expected JSON body." },
      { status: 400 }
    );
  }
  const parsed = SyncWearablesInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const source = WearableSource.safeParse(parsed.data.source);
  if (!source.success) {
    return Response.json(
      {
        error: "unsupported_source",
        message: `"${parsed.data.source}" isn't supported yet. v1 syncs Apple Watch via Apple Health only — WHOOP, Oura and Garmin are on the roadmap.`,
      },
      { status: 422 }
    );
  }

  const signals = await collections.wearableSignals();
  const ops = parsed.data.signals.map((s) => ({
    replaceOne: {
      // Deterministic id ⇒ idempotent re-syncs (one doc per member/type/day).
      filter: { _id: `${auth.member._id}:${s.type}:${s.date}` },
      replacement: {
        _id: `${auth.member._id}:${s.type}:${s.date}`,
        memberId: auth.member._id,
        source: source.data,
        type: s.type,
        value: s.value,
        date: s.date,
      },
      upsert: true,
    },
  }));
  const result = await signals.bulkWrite(ops);

  return Response.json({
    ok: true,
    upserted: result.upsertedCount,
    updated: result.modifiedCount,
    total: parsed.data.signals.length,
  });
}
