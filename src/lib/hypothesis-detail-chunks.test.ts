import { describe, expect, it, vi } from "vitest";
import { readHypothesisDetailChunks } from "./hypothesis-detail-chunks";

describe("readHypothesisDetailChunks", () => {
  it("preserves every ID while bounding each query and starting chunks concurrently", async () => {
    const ids = Array.from({ length: 205 }, (_, index) => `id-${index}`);
    const resolveChunks: (() => void)[] = [];
    const read = vi.fn(
      (chunk: string[]) =>
        new Promise<string[]>((resolve) => {
          resolveChunks.push(() => resolve(chunk));
        }),
    );
    const pending = readHypothesisDetailChunks(ids, read);
    expect(read.mock.calls.map(([chunk]) => chunk.length)).toEqual([100, 100, 5]);
    for (const resolve of resolveChunks.reverse()) resolve();
    expect(await pending).toEqual(ids);
  });

  it("preserves IN set semantics across repeated IDs and skips empty input", async () => {
    const ids = Array.from({ length: 100 }, (_, index) => `id-${index}`);
    const read = vi.fn(async (chunk: string[]) => chunk);
    expect(await readHypothesisDetailChunks([...ids, ids[0]], read)).toEqual(ids);
    expect(read).toHaveBeenCalledTimes(1);
    read.mockClear();
    expect(await readHypothesisDetailChunks([], read)).toEqual([]);
    expect(read).not.toHaveBeenCalled();
  });
});
