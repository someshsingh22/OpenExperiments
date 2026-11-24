import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  getRequestContext: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@cloudflare/next-on-pages", () => ({
  getRequestContext: mocks.getRequestContext,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function memoryCache() {
  const entries = new Map<string, string>();
  return {
    entries,
    match: vi.fn(async (request: Request) => {
      const body = entries.get(request.url);
      return body === undefined ? undefined : new Response(body);
    }),
    put: vi.fn(async (request: Request, response: Response) => {
      entries.set(request.url, await response.text());
    }),
    delete: vi.fn(async (request: Request) => entries.delete(request.url)),
  };
}

describe("public edge query cache", () => {
  let cache: ReturnType<typeof memoryCache>;
  let api: typeof import("./edge-cache");
  let background: Promise<unknown>[];
  let waitUntil: ReturnType<typeof vi.fn>;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();
    mocks.headers.mockReset();
    mocks.getRequestContext.mockReset();
    cache = memoryCache();
    background = [];
    waitUntil = vi.fn((promise: Promise<unknown>) => background.push(promise));
    mocks.headers.mockResolvedValue(new Headers({ host: "public.example" }));
    mocks.getRequestContext.mockReturnValue({ ctx: { waitUntil } });
    vi.stubGlobal("caches", { default: cache });
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    api = await import("./edge-cache");
  });

  afterEach(async () => {
    await Promise.all(background);
    vi.unstubAllGlobals();
  });

  it("returns a decoded hit without fetching or scheduling a fill", async () => {
    cache.entries.set("https://public.example/__edge_cache__/home%3Adata", '{"value":3}');
    const fetcher = vi.fn(async () => ({ value: 4 }));
    expect(await api.cachedQuery("home:data", 300, fetcher)).toEqual({ value: 3 });
    expect(fetcher).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("fills a miss with public JSON and the requested TTL", async () => {
    const data = { value: "public" };
    const fetcher = vi.fn(async () => data);
    expect(await api.cachedQuery("list", 300, fetcher)).toBe(data);
    await Promise.all(background);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.put).toHaveBeenCalledTimes(1);
    const [request, response] = cache.put.mock.calls[0];
    expect(request.url).toBe("https://public.example/__edge_cache__/list");
    expect(request.method).toBe("GET");
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=300");
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.has("Set-Cookie")).toBe(false);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each(["read", "malformed JSON"])(
    "fetches once and replaces the entry after a %s failure",
    async (failure) => {
      if (failure === "read") cache.match.mockRejectedValueOnce(new Error("secret read error"));
      else cache.entries.set("https://public.example/__edge_cache__/list", "not JSON");
      const fetcher = vi.fn(async () => ({ ok: true }));
      expect(await api.cachedQuery("list", 300, fetcher)).toEqual({ ok: true });
      await Promise.all(background);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(cache.put).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith("[edge-cache] lookup or JSON decoding failed");
      expect(JSON.stringify(warn.mock.calls)).not.toContain("secret");
    },
  );

  it("returns fetched data once when a background write fails", async () => {
    cache.put.mockRejectedValueOnce(new Error("secret write error"));
    const fetcher = vi.fn(async () => ({ ok: true }));
    expect(await api.cachedQuery("list", 300, fetcher)).toEqual({ ok: true });
    await Promise.all(background);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("[edge-cache] serialization or write failed");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret");
    expect(await api.cachedQuery("list", 300, fetcher)).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("returns fetched data without retrying when serialization fails", async () => {
    const data: Record<string, unknown> = {};
    data.circular = data;
    const fetcher = vi.fn(async () => data);
    expect(await api.cachedQuery("circular", 300, fetcher)).toBe(data);
    await Promise.all(background);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.put).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("[edge-cache] serialization or write failed");
  });

  it("propagates fetcher errors unchanged once and cleans up rejected flights", async () => {
    const error = new Error("database unavailable");
    const fetcher = vi.fn(async () => {
      throw error;
    });
    await expect(api.cachedQuery("list", 300, fetcher)).rejects.toBe(error);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.put).not.toHaveBeenCalled();
    expect(waitUntil).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    const retry = vi.fn(async () => "recovered");
    expect(await api.cachedQuery("list", 300, retry)).toBe("recovered");
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("coalesces 20 misses into one lookup, fetch, and fill", async () => {
    const gate = deferred<string>();
    const fetcher = vi.fn(() => gate.promise);
    const queries = Array.from({ length: 20 }, () => api.cachedQuery("list", 300, fetcher));
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    gate.resolve("shared");
    expect(await Promise.all(queries)).toEqual(Array(20).fill("shared"));
    await Promise.all(background);
    expect(cache.match).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.put).toHaveBeenCalledTimes(1);
  });

  it("shares a rejection without retrying and allows the next flight", async () => {
    const gate = deferred<string>();
    const fetcher = vi.fn(() => gate.promise);
    const queries = Array.from({ length: 20 }, () => api.cachedQuery("list", 300, fetcher));
    const settled = Promise.allSettled(queries);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    const error = new Error("D1 failed");
    gate.reject(error);
    expect(await settled).toEqual(Array(20).fill({ status: "rejected", reason: error }));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await api.cachedQuery("list", 300, async () => "new")).toBe("new");
  });

  it("uses the complete host URL for flight isolation", async () => {
    const gate = deferred<string>();
    const firstFetcher = vi.fn(() => gate.promise);
    const first = api.cachedQuery("list", 300, firstFetcher);
    await vi.waitFor(() => expect(firstFetcher).toHaveBeenCalledTimes(1));
    mocks.headers.mockResolvedValue(new Headers({ host: "preview.example" }));
    const secondFetcher = vi.fn(async () => "preview");
    expect(await api.cachedQuery("list", 300, secondFetcher)).toBe("preview");
    gate.resolve("public");
    expect(await first).toBe("public");
    await Promise.all(background);
    expect(cache.entries.get("https://public.example/__edge_cache__/list")).toBe('"public"');
    expect(cache.entries.get("https://preview.example/__edge_cache__/list")).toBe('"preview"');
  });

  it("returns before a scheduled put completes while retaining flight tracking", async () => {
    const gate = deferred<void>();
    cache.put.mockImplementationOnce(async () => gate.promise);
    const fetcher = vi.fn(async () => "data");
    expect(await api.cachedQuery("list", 300, fetcher)).toBe("data");
    expect(await api.cachedQuery("list", 300, fetcher)).toBe("data");
    expect(fetcher).toHaveBeenCalledTimes(1);
    gate.resolve(undefined);
    await Promise.all(background);
  });

  it.each(["missing context", "waitUntil throws"])(
    "awaits the write safely if %s",
    async (failure) => {
      const gate = deferred<void>();
      const started = deferred<void>();
      cache.put.mockImplementationOnce(async () => {
        started.resolve(undefined);
        await gate.promise;
      });
      if (failure === "missing context") {
        mocks.getRequestContext.mockImplementation(() => {
          throw new Error("no context");
        });
      } else {
        waitUntil.mockImplementation(() => {
          throw new Error("scheduling unavailable");
        });
      }
      let returned = false;
      const fetcher = vi.fn(async () => "data");
      const query = api.cachedQuery("list", 300, fetcher).then((value) => {
        returned = true;
        return value;
      });
      await started.promise;
      expect(returned).toBe(false);
      gate.resolve(undefined);
      expect(await query).toBe("data");
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith("[edge-cache] background scheduling failed");
    },
  );

  it.each([undefined, {}])(
    "preserves direct dev fetching without caches.default: %s",
    async (store) => {
      vi.stubGlobal("caches", store);
      const fetcher = vi.fn(async () => "uncached");
      expect(
        await Promise.all([
          api.cachedQuery("list", 300, fetcher),
          api.cachedQuery("list", 300, fetcher),
        ]),
      ).toEqual(["uncached", "uncached"]);
      await api.invalidateCached("list");
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(mocks.headers).not.toHaveBeenCalled();
      expect(mocks.getRequestContext).not.toHaveBeenCalled();
    },
  );

  it("fetches once without storage when key construction fails", async () => {
    mocks.headers.mockRejectedValue(new Error("secret headers"));
    const fetcher = vi.fn(async () => "data");
    expect(await api.cachedQuery("list", 300, fetcher)).toBe("data");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.match).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("[edge-cache] key construction failed");
  });

  it("fences a pre-invalidation fetch without blocking deletion on its fetcher", async () => {
    const gate = deferred<string>();
    const fetcher = vi.fn(() => gate.promise);
    const old = api.cachedQuery("list", 300, fetcher);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await api.invalidateCached("list");
    expect(cache.delete).toHaveBeenCalledTimes(1);
    expect(await api.cachedQuery("list", 300, async () => "new")).toBe("new");
    gate.resolve("old");
    expect(await old).toBe("old");
    await Promise.all(background);
    expect(cache.put).toHaveBeenCalledTimes(1);
    expect(cache.entries.get("https://public.example/__edge_cache__/list")).toBe('"new"');
  });

  it("does not let an invalidated flight remove its still-pending replacement", async () => {
    const oldGate = deferred<string>();
    const oldFetcher = vi.fn(() => oldGate.promise);
    const old = api.cachedQuery("list", 300, oldFetcher);
    await vi.waitFor(() => expect(oldFetcher).toHaveBeenCalledTimes(1));
    await api.invalidateCached("list");

    const newGate = deferred<string>();
    const newFetcher = vi.fn(() => newGate.promise);
    const replacement = api.cachedQuery("list", 300, newFetcher);
    await vi.waitFor(() => expect(newFetcher).toHaveBeenCalledTimes(1));
    oldGate.resolve("old");
    expect(await old).toBe("old");
    const joined = api.cachedQuery("list", 300, newFetcher);
    newGate.resolve("new");
    expect(await Promise.all([replacement, joined])).toEqual(["new", "new"]);
    await Promise.all(background);
    expect(newFetcher).toHaveBeenCalledTimes(1);
    expect(cache.put).toHaveBeenCalledTimes(1);
  });

  it("deletes after an already-started put so it cannot resurrect the old entry", async () => {
    const gate = deferred<void>();
    const originalPut = cache.put.getMockImplementation()!;
    cache.put.mockImplementationOnce(async (request, response) => {
      await gate.promise;
      await originalPut(request, response);
    });
    expect(await api.cachedQuery("list", 300, async () => "old")).toBe("old");
    let deleted = false;
    const invalidation = api.invalidateCached("list").then(() => {
      deleted = true;
    });
    await vi.waitFor(() => expect(cache.put).toHaveBeenCalledTimes(1));
    expect(deleted).toBe(false);
    expect(cache.delete).not.toHaveBeenCalled();
    gate.resolve(undefined);
    await invalidation;
    expect(cache.entries.size).toBe(0);
    expect(await api.cachedQuery("list", 300, async () => "new")).toBe("new");
  });

  it("still deletes if an already-started fill rejects", async () => {
    const gate = deferred<void>();
    cache.put.mockImplementationOnce(async () => gate.promise);
    expect(await api.cachedQuery("list", 300, async () => "old")).toBe("old");
    const invalidation = api.invalidateCached("list");
    await vi.waitFor(() => expect(cache.put).toHaveBeenCalledTimes(1));
    gate.reject(new Error("secret put failure"));
    await expect(invalidation).resolves.toBeUndefined();
    expect(cache.delete).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("[edge-cache] serialization or write failed");
  });

  it("logs deletion failures without failing the mutation or exposing its key", async () => {
    cache.delete.mockRejectedValueOnce(new Error("secret deletion error"));
    await expect(api.invalidateCached("sensitive-key")).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith("[edge-cache] invalidation failed");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("sensitive-key");
  });

  it.each([
    {
      operation: "hypothesis update",
      invalidate: () => api.invalidateHypothesisCaches("h-1"),
      keys: ["home:data", "explore:data", "sitemap:hyps", "hypothesis:h-1"],
    },
    {
      operation: "hypothesis creation",
      invalidate: () => api.invalidateHypothesisCaches(),
      keys: ["home:data", "explore:data", "sitemap:hyps"],
    },
    {
      operation: "experiment update",
      invalidate: () => api.invalidateExperimentCaches("h-1"),
      keys: ["experiments:list", "hypothesis:h-1", "explore:data", "datasets:list"],
    },
  ])("invalidates exactly the public dependencies for $operation", async ({ invalidate, keys }) => {
    const allKeys = [
      "home:data",
      "explore:data",
      "sitemap:hyps",
      "hypothesis:h-1",
      "hypothesis:h-2",
      "experiments:list",
      "datasets:list",
      "unrelated:list",
    ];
    const urlFor = (key: string) =>
      `https://public.example/__edge_cache__/${encodeURIComponent(key)}`;
    for (const key of allKeys) cache.entries.set(urlFor(key), '"public snapshot"');

    await invalidate();

    expect(cache.delete.mock.calls.map(([request]) => request.url).sort()).toEqual(
      keys.map(urlFor).sort(),
    );
    for (const key of allKeys) {
      expect(cache.entries.has(urlFor(key))).toBe(!keys.includes(key));
    }
  });

  it("attempts all dependency deletions when one fails", async () => {
    cache.delete.mockRejectedValueOnce(new Error("deletion failure"));
    await expect(api.invalidateHypothesisCaches("h-1")).resolves.toBeUndefined();
    expect(cache.delete).toHaveBeenCalledTimes(4);
    expect(warn).toHaveBeenCalledWith("[edge-cache] invalidation failed");
  });

  it("bounds tracked URLs and skips unfenced storage when all slots are occupied", async () => {
    const gate = deferred<string>();
    const fetcher = vi.fn(() => gate.promise);
    const queries = Array.from({ length: 128 }, (_, i) =>
      api.cachedQuery(`busy:${i}`, 300, fetcher),
    );
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(128));
    const overflow = vi.fn(async () => "overflow");
    expect(await api.cachedQuery("overflow", 300, overflow)).toBe("overflow");
    expect(cache.match).toHaveBeenCalledTimes(128);
    expect(cache.put).not.toHaveBeenCalled();
    gate.resolve("data");
    await Promise.all(queries);
    await Promise.all(background);
    expect(cache.put).toHaveBeenCalledTimes(128);
    expect(await api.cachedQuery("overflow", 300, overflow)).toBe("overflow");
    await Promise.all(background);
    expect(cache.put).toHaveBeenCalledTimes(129);
  });
});
