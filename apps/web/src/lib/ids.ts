import { randomUUID } from "node:crypto";

/**
 * Collision-free document id for RUNTIME create paths.
 *
 * The seed stays deterministic (padded indices into an empty DB), but anything
 * minted while the app is running must be unique-safe: the old
 * `${prefix}_${countDocuments()+1}` scheme collides after any delete (e.g.
 * checkout's `deleteMany({status:"pending"})`) and races under concurrent
 * inserts, both of which brick the insert. A UUID suffix removes both hazards.
 */
export function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}
