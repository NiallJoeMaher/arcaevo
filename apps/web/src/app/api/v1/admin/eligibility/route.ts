/**
 * GET/POST /api/v1/admin/eligibility — the Eircode gate is DATA, not a deploy
 * (design_handoff_v2 §18 ADM-2). Widening to Cork is a config change made
 * here, never a release.
 *
 *   GET  → the live allowlist + edit history.
 *   POST { add?: string[], remove?: string[] } → updates the single
 *          `eligibility_config` document and appends the diff to its
 *          changeLog array (the admin /admin/eligibility history view).
 *
 * Inputs are normalised through extractRoutingKey ("d08 xy24" → "D08"), so
 * only valid routing keys can ever enter the config. Admin-gated.
 */
import type { Collection } from "mongodb";
import { z } from "zod";
import type { EligibilityConfigDoc } from "@/app/admin/(panel)/data";
import { parseJsonBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { collections } from "@/lib/db";
import { extractRoutingKey, LAUNCH_ALLOWLIST } from "@/lib/eligibility";

/** The typed accessor doesn't know about changeLog (models.ts is frozen for
 * v2) — this route and the admin loader are the only readers/writers of it. */
async function configCollection(): Promise<Collection<EligibilityConfigDoc>> {
  return (await collections.eligibilityConfig()) as unknown as Collection<EligibilityConfigDoc>;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const config = await (await configCollection()).findOne({ _id: "launch" });
  return Response.json({
    allowedRoutingKeys: config?.allowedRoutingKeys ?? LAUNCH_ALLOWLIST,
    updatedAt: config?.updatedAt ?? null,
    changeLog: config?.changeLog ?? [],
  });
}

const UpdateEligibilityInput = z.object({
  add: z.array(z.string()).default([]),
  remove: z.array(z.string()).default([]),
});

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = await parseJsonBody(req, UpdateEligibilityInput);
  if (!parsed.ok) return parsed.response;

  // Normalise every input to its routing key; reject the whole request if
  // anything isn't one (config must never hold a non-key).
  const invalid: string[] = [];
  const normalise = (inputs: string[]): string[] => {
    const keys: string[] = [];
    for (const input of inputs) {
      const key = extractRoutingKey(input);
      if (key) keys.push(key);
      else invalid.push(input.trim() || "(empty)");
    }
    return keys;
  };
  const add = normalise(parsed.data.add);
  const remove = normalise(parsed.data.remove);

  if (invalid.length) {
    return Response.json(
      {
        error: "validation",
        message: `Not a routing key: ${invalid.join(", ")} — use the first 3 characters of an Eircode (e.g. D08, T12, D6W).`,
      },
      { status: 400 }
    );
  }
  if (add.length === 0 && remove.length === 0) {
    return Response.json(
      {
        error: "validation",
        message: "Nothing to change — pass add and/or remove.",
      },
      { status: 400 }
    );
  }

  const col = await configCollection();
  const config = await col.findOne({ _id: "launch" });
  const current = config?.allowedRoutingKeys ?? [...LAUNCH_ALLOWLIST];

  const removeSet = new Set(remove);
  const added = [...new Set(add)].filter(
    (k) => !current.includes(k) && !removeSet.has(k)
  );
  const removed = [...new Set(remove)].filter((k) => current.includes(k));
  // Keep the stored order (design lists Dublin keys in launch order); new
  // keys append at the end.
  const next = [...current.filter((k) => !removeSet.has(k)), ...added];

  const now = new Date();
  if (added.length || removed.length) {
    await col.updateOne(
      { _id: "launch" },
      {
        $set: { allowedRoutingKeys: next, updatedAt: now },
        $push: { changeLog: { at: now, added, removed } },
      },
      { upsert: true }
    );
  }

  return Response.json({ allowedRoutingKeys: next, added, removed });
}
