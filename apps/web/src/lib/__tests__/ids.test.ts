/**
 * Unit tests for src/lib/ids.ts — collision-free runtime document ids.
 * The old `${prefix}_${countDocuments()+1}` scheme collided after any delete
 * and raced under concurrency; newId() must be prefix-tagged and unique.
 */
import { describe, expect, it } from "vitest";
import { newId } from "@/lib/ids";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newId()", () => {
  it("prefixes the id and appends a UUID", () => {
    const id = newId("sub");
    expect(id.startsWith("sub_")).toBe(true);
    expect(id.slice("sub_".length)).toMatch(UUID_RE);
  });

  it("is unique across many calls (no count/delete collisions)", () => {
    const ids = new Set(Array.from({ length: 5000 }, () => newId("read")));
    expect(ids.size).toBe(5000);
  });

  it("keeps different prefixes distinct", () => {
    expect(newId("ord").startsWith("ord_")).toBe(true);
    expect(newId("mem").startsWith("mem_")).toBe(true);
  });
});
