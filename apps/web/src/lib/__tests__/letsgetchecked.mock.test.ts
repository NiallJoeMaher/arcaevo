/**
 * Unit tests for src/lib/vendors/letsgetchecked.mock.ts.
 *
 * The mock vendor persists its fake state machine in Mongo, so unit tests
 * replace `@/lib/db` with a minimal in-memory collection. The fake's
 * findOneAndUpdate genuinely evaluates the aggregation pipeline the vendor
 * passes ($set / $min / $add / "$field" refs), so the forward-only clamp and
 * one-step-per-call progression being verified is the vendor's own logic —
 * not re-implemented in the test double.
 *
 * Real-Mongo behavior (pipeline semantics on an actual server, concurrent
 * order-id counting) is deferred to the e2e suite.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ORDER_STATUS_SEQUENCE } from "@/lib/models";

// --- minimal in-memory stand-in for the `vendor_lgc_mock_orders` collection

type Doc = { _id: string; [key: string]: unknown };

function evalExpr(expr: unknown, doc: Doc): unknown {
  if (typeof expr === "string" && expr.startsWith("$")) {
    return doc[expr.slice(1)];
  }
  if (Array.isArray(expr)) {
    return expr.map((e) => evalExpr(e, doc));
  }
  if (expr !== null && typeof expr === "object") {
    const entries = Object.entries(expr as Record<string, unknown>);
    if (entries.length === 1 && entries[0][0].startsWith("$")) {
      const [op, args] = entries[0];
      const values = evalExpr(args, doc) as number[];
      switch (op) {
        case "$add":
          return values.reduce((a, b) => a + b, 0);
        case "$min":
          return Math.min(...values);
        default:
          throw new Error(`fake Mongo: unsupported operator ${op}`);
      }
    }
  }
  return expr;
}

class FakeCollection {
  docs = new Map<string, Doc>();

  async countDocuments(): Promise<number> {
    return this.docs.size;
  }

  async insertOne(doc: Doc): Promise<{ insertedId: string }> {
    if (this.docs.has(doc._id)) {
      throw new Error(`fake Mongo: duplicate _id ${doc._id}`);
    }
    this.docs.set(doc._id, { ...doc });
    return { insertedId: doc._id };
  }

  async findOne(filter: { _id: string }): Promise<Doc | null> {
    const doc = this.docs.get(filter._id);
    return doc ? { ...doc } : null;
  }

  /** Supports exactly what the vendor uses: an aggregation-pipeline update
   * with $set stages, returnDocument: "after". */
  async findOneAndUpdate(
    filter: { _id: string },
    pipeline: unknown,
    _options?: unknown
  ): Promise<Doc | null> {
    const doc = this.docs.get(filter._id);
    if (!doc) return null;
    if (!Array.isArray(pipeline)) {
      throw new Error("fake Mongo: only pipeline updates are supported");
    }
    for (const stage of pipeline as Array<Record<string, unknown>>) {
      const set = stage.$set as Record<string, unknown> | undefined;
      if (!set) throw new Error("fake Mongo: unsupported pipeline stage");
      for (const [field, expr] of Object.entries(set)) {
        doc[field] = evalExpr(expr, doc);
      }
    }
    return { ...doc };
  }
}

const fake = vi.hoisted(() => ({ col: undefined as unknown }));

vi.mock("@/lib/db", () => ({
  PRIMARY_READ: { readPreference: "primary" },
  collections: {
    lgcMockOrders: async () => fake.col,
  },
}));

// Import AFTER the mock is registered.
import { bloodTestVendor } from "@/lib/vendors/letsgetchecked.mock";

beforeEach(() => {
  fake.col = new FakeCollection();
});

describe("createKitOrder", () => {
  it('starts every order at "ordered" with a sequential vendor id', async () => {
    const first = await bloodTestVendor.createKitOrder("mem_0001", "full");
    expect(first).toEqual({ vendorOrderId: "lgc_mock_0001", status: "ordered" });

    const second = await bloodTestVendor.createKitOrder("mem_0002", "recheck");
    expect(second).toEqual({
      vendorOrderId: "lgc_mock_0002",
      status: "ordered",
    });
  });
});

describe("getOrderStatus state machine", () => {
  it("advances exactly one step per call through the full pipeline, in order", async () => {
    const { vendorOrderId } = await bloodTestVendor.createKitOrder(
      "mem_0001",
      "full"
    );
    const seen: string[] = [];
    for (let i = 0; i < ORDER_STATUS_SEQUENCE.length - 1; i++) {
      seen.push(await bloodTestVendor.getOrderStatus(vendorOrderId));
    }
    expect(seen).toEqual([
      "shipped",
      "delivered",
      "sample_registered",
      "in_lab",
      "results_ready",
    ]);
  });

  it('is forward-only: stays clamped at "results_ready" on further polls', async () => {
    const { vendorOrderId } = await bloodTestVendor.createKitOrder(
      "mem_0001",
      "recheck"
    );
    for (let i = 0; i < 20; i++) {
      await bloodTestVendor.getOrderStatus(vendorOrderId);
    }
    expect(await bloodTestVendor.getOrderStatus(vendorOrderId)).toBe(
      "results_ready"
    );
  });

  it("throws for an unknown vendor order id", async () => {
    await expect(bloodTestVendor.getOrderStatus("lgc_mock_9999")).rejects.toThrow(
      /unknown lgc mock order/i
    );
  });
});

describe("getResults — seeded determinism", () => {
  it("same order → identical results on every call", async () => {
    const { vendorOrderId } = await bloodTestVendor.createKitOrder(
      "mem_0001",
      "full"
    );
    const a = await bloodTestVendor.getResults(vendorOrderId);
    const b = await bloodTestVendor.getResults(vendorOrderId);
    expect(a).toEqual(b);
  });

  it("different orders → different seeded values for the same marker", async () => {
    const one = await bloodTestVendor.createKitOrder("mem_0001", "recheck");
    const two = await bloodTestVendor.createKitOrder("mem_0001", "recheck");
    const [a, b] = await Promise.all([
      bloodTestVendor.getResults(one.vendorOrderId),
      bloodTestVendor.getResults(two.vendorOrderId),
    ]);
    // Same panel → same marker codes in the same order…
    expect(a.map((r) => r.code)).toEqual(b.map((r) => r.code));
    // …but the seeded values differ (seed = orderId:code).
    expect(a.map((r) => r.value)).not.toEqual(b.map((r) => r.value));
  });

  it("recheck panel returns the 7 lipid/metabolic markers; full returns 15", async () => {
    const recheck = await bloodTestVendor.createKitOrder("mem_0001", "recheck");
    const full = await bloodTestVendor.createKitOrder("mem_0001", "full");
    const recheckResults = await bloodTestVendor.getResults(
      recheck.vendorOrderId
    );
    const fullResults = await bloodTestVendor.getResults(full.vendorOrderId);

    expect(recheckResults.map((r) => r.code)).toEqual([
      "apob",
      "ldl_c",
      "hdl_c",
      "triglycerides",
      "hba1c",
      "fasting_glucose",
      "hs_crp",
    ]);
    expect(fullResults).toHaveLength(15);
  });

  it("every result carries a unit and a plausible finite value", async () => {
    const { vendorOrderId } = await bloodTestVendor.createKitOrder(
      "mem_0001",
      "full"
    );
    for (const result of await bloodTestVendor.getResults(vendorOrderId)) {
      expect(result.unit).toBeTruthy();
      expect(Number.isFinite(result.value)).toBe(true);
      expect(result.value).toBeGreaterThan(0);
      // Values are rounded to 2 decimal places.
      expect(result.value).toBe(Math.round(result.value * 100) / 100);
    }
  });

  it("throws for an unknown vendor order id", async () => {
    await expect(bloodTestVendor.getResults("lgc_mock_9999")).rejects.toThrow(
      /unknown lgc mock order/i
    );
  });
});
