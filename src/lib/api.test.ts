import { afterEach, describe, expect, it, vi } from "vitest";
import { getHypotheses, getProblemStatements, getStarsBatch } from "./api";
import { STAR_BATCH_LIMIT } from "./star-batch";

afterEach(() => vi.unstubAllGlobals());

describe("client request wrappers", () => {
  it("encodes the problem statement filter without changing pagination", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ data: [], total: 0 }));
    vi.stubGlobal("fetch", fetcher);
    await getHypotheses({ problemStatementId: "ps & 1", limit: 20, offset: 40 });
    const url = new URL(fetcher.mock.calls[0][0], "https://example.test");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      problemStatementId: "ps & 1",
      limit: "20",
      offset: "40",
    });
  });

  it("passes catalog cancellation through to fetch", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ data: [] }));
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    await getProblemStatements({ includeDatasets: true }, { signal: controller.signal });
    expect(fetcher).toHaveBeenCalledWith("/api/problem-statements?includeDatasets=true", {
      signal: controller.signal,
    });
  });

  it("does not fetch an empty star batch", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(await getStarsBatch(["", ""])).toEqual({ data: {} });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("deduplicates and safely encodes batch IDs", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ data: { "h&one": { count: 2, starred: true } } }));
    vi.stubGlobal("fetch", fetcher);
    const result = await getStarsBatch(["h&one", "h&one", ""]);
    const url = new URL(fetcher.mock.calls[0][0], "https://example.test");
    expect([...url.searchParams]).toEqual([["ids", "h&one"]]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.data["h&one"]).toEqual({ count: 2, starred: true });
  });

  it("chunks into bounded sequential requests and merges all results", async () => {
    const ids = Array.from({ length: STAR_BATCH_LIMIT * 2 + 1 }, (_, i) => `h-${i}`);
    let active = 0;
    let maximumActive = 0;
    const fetcher = vi.fn(async (input: string) => {
      active++;
      maximumActive = Math.max(maximumActive, active);
      await Promise.resolve();
      const batch = new URL(input, "https://example.test").searchParams.get("ids")!.split(",");
      active--;
      return Response.json({
        data: Object.fromEntries(batch.map((id) => [id, { count: 1, starred: false }])),
      });
    });
    vi.stubGlobal("fetch", fetcher);
    const result = await getStarsBatch([...ids, ...ids]);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(
      fetcher.mock.calls.map(
        ([input]) =>
          new URL(input, "https://example.test").searchParams.get("ids")!.split(",").length,
      ),
    ).toEqual([99, 99, 1]);
    expect(Object.keys(result.data)).toEqual(ids);
    expect(maximumActive).toBe(1);
  });

  it("stops chunking on failure without returning a partial response", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(getStarsBatch(Array.from({ length: 100 }, (_, i) => `h-${i}`))).rejects.toThrow(
      "API error: 503",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
