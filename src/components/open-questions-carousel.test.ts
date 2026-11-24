import { describe, expect, it } from "vitest";
import { shuffled } from "./open-questions-carousel";

describe("shuffled", () => {
  it("returns a reordered copy containing every question exactly once", () => {
    const items = ["a", "b", "c", "d", "e"];
    const values = [0.1, 0.9, 0.4, 0.7];
    const result = shuffled(items, () => values.shift() ?? 0);
    expect(result).not.toEqual(items);
    expect([...result].sort()).toEqual(items);
    expect(items).toEqual(["a", "b", "c", "d", "e"]);
  });
});
