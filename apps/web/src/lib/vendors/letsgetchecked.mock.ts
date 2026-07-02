// MOCK: LetsGetChecked adapter — NOT a real integration.
//
// No API contract has been selected/signed; every shape here is our own guess,
// NOT LetsGetChecked's real schema. See docs/MOCKED_APIS.md §1 for the
// productionisation checklist (real REST client, real webhook signatures,
// LGC biomarker-code mapping, per-tier kit SKUs).
//
// Determinism: the fake state machine advances exactly one step per
// getOrderStatus() call (persisted in Mongo `vendor_lgc_mock_orders`), and
// result values come from a seeded PRNG keyed on (vendorOrderId, code) — the
// same order always yields the same numbers. No Date.now()-seeded randomness.
import { collections } from "@/lib/db";
import {
  ORDER_STATUS_SEQUENCE,
  type TestOrderStatus,
  type TestPanel,
} from "@/lib/models";
import type {
  BloodTestVendor,
  VendorBiomarkerResult,
  VendorKitOrder,
} from "@/lib/vendors/types";

// --- seeded PRNG (mulberry32 + fnv1a string hash) — deterministic ----------

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- plausible marker ranges the mock lab "measures" -----------------------
// code → [unit, min, max] — deterministic value drawn inside [min, max].
const MARKER_RANGES: Record<string, [string, number, number]> = {
  apob: ["g/L", 0.6, 1.3],
  ldl_c: ["mmol/L", 1.8, 4.2],
  hdl_c: ["mmol/L", 0.9, 2.0],
  triglycerides: ["mmol/L", 0.6, 2.4],
  hba1c: ["mmol/mol", 28, 44],
  fasting_glucose: ["mmol/L", 4.2, 6.2],
  hs_crp: ["mg/L", 0.3, 4.0],
  ferritin: ["µg/L", 25, 250],
  vitamin_d: ["nmol/L", 35, 110],
  tsh: ["mIU/L", 0.6, 3.8],
  alt: ["U/L", 12, 45],
  creatinine: ["µmol/L", 60, 105],
  testosterone: ["nmol/L", 9, 28],
  cortisol: ["nmol/L", 150, 480],
  omega3_index: ["%", 3.5, 9.5],
};

/** Panels → markers the mock returns. venous80 reuses the same 15 (a real
 * 80+ marker venous panel would map many more LGC codes). */
const PANEL_MARKERS: Record<TestPanel, string[]> = {
  full: Object.keys(MARKER_RANGES),
  recheck: [
    "apob",
    "ldl_c",
    "hdl_c",
    "triglycerides",
    "hba1c",
    "fasting_glucose",
    "hs_crp",
  ],
  venous80: Object.keys(MARKER_RANGES),
};

class LetsGetCheckedMock implements BloodTestVendor {
  // MOCK: creates a fake order record; a real client would call LGC's API.
  async createKitOrder(
    memberId: string,
    panel: TestPanel
  ): Promise<VendorKitOrder> {
    const col = await collections.lgcMockOrders();
    const count = await col.countDocuments();
    const vendorOrderId = `lgc_mock_${String(count + 1).padStart(4, "0")}`;
    await col.insertOne({
      _id: vendorOrderId,
      memberId,
      panel,
      statusIndex: 0, // "ordered"
      createdAt: new Date(),
    });
    return { vendorOrderId, status: "ordered" };
  }

  // MOCK: deterministic state machine — advances exactly ONE step per call
  // until "results_ready". Real LGC would push webhooks / return live status.
  async getOrderStatus(vendorOrderId: string): Promise<TestOrderStatus> {
    const col = await collections.lgcMockOrders();
    const doc = await col.findOneAndUpdate(
      { _id: vendorOrderId },
      [
        {
          $set: {
            statusIndex: {
              $min: [
                { $add: ["$statusIndex", 1] },
                ORDER_STATUS_SEQUENCE.length - 1,
              ],
            },
          },
        },
      ],
      { returnDocument: "after" }
    );
    if (!doc) throw new Error(`Unknown LGC mock order: ${vendorOrderId}`);
    return ORDER_STATUS_SEQUENCE[doc.statusIndex];
  }

  // MOCK: seeded biomarker values — same order id ⇒ same results, always.
  async getResults(vendorOrderId: string): Promise<VendorBiomarkerResult[]> {
    const col = await collections.lgcMockOrders();
    const doc = await col.findOne({ _id: vendorOrderId });
    if (!doc) throw new Error(`Unknown LGC mock order: ${vendorOrderId}`);
    const markers = PANEL_MARKERS[doc.panel as TestPanel] ?? [];
    return markers.map((code) => {
      const [unit, min, max] = MARKER_RANGES[code];
      const rand = mulberry32(fnv1a(`${vendorOrderId}:${code}`))();
      const value = Math.round((min + rand * (max - min)) * 100) / 100;
      return { code, value, unit };
    });
  }
}

/** The one BloodTestVendor the app uses. Swap for the real client here. */
export const bloodTestVendor: BloodTestVendor = new LetsGetCheckedMock();
