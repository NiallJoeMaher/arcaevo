/**
 * Regression test for security audit W-4 — the consent audit trail must use
 * collision-safe ids, not `consent_${countDocuments()+1}` (which raced under
 * concurrent withdrawals and could drop an append-only audit record).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Doc = { _id: string; [k: string]: unknown };

class FakeCollection {
  docs: Doc[] = [];
  async insertMany(docs: Doc[]) {
    for (const d of docs) {
      if (this.docs.some((e) => e._id === d._id)) {
        throw new Error(`duplicate key: ${d._id}`); // mirror Mongo unique _id
      }
      this.docs.push({ ...d });
    }
    return { insertedCount: docs.length };
  }
  async countDocuments() {
    return this.docs.length;
  }
}

const store = new FakeCollection();
vi.mock("@/lib/db", () => ({
  collections: { consents: async () => store },
}));

import { recordConsents } from "@/lib/consents";

beforeEach(() => {
  store.docs = [];
});

describe("recordConsents — collision-safe ids (W-4)", () => {
  it("mints prefixed, non-sequential, unique ids", async () => {
    const docs = await recordConsents(
      "mem_0001",
      [
        { purpose: "health_processing", granted: true },
        { purpose: "clinician_review", granted: true },
      ],
      "web"
    );
    for (const d of docs) expect(d._id.startsWith("consent_")).toBe(true);
    // Not the old sequential scheme.
    expect(docs[0]._id).not.toBe("consent_0001");
    expect(new Set(docs.map((d) => d._id)).size).toBe(2);
  });

  it("does not collide across concurrent writes (the W-4 race)", async () => {
    // Two withdrawals racing: with the old count()+1 scheme both computed the
    // same next id and the second insert threw. newId() removes the race.
    await Promise.all([
      recordConsents("mem_a", [{ purpose: "health_processing", granted: false }], "web"),
      recordConsents("mem_b", [{ purpose: "health_processing", granted: false }], "ios"),
    ]);
    const ids = store.docs.map((d) => d._id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(2);
  });
});
