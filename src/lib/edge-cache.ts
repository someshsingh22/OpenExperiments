import { headers } from "next/headers";

/**
 * Minimal typed view of Cloudflare's `caches.default`. The Web `CacheStorage`
 * type does not include `.default`, which is a Workers/Pages extension.
 */
interface EdgeCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
  delete(request: Request): Promise<boolean>;
}

function getEdgeCache(): EdgeCache | null {
  // Absent under `next dev` (Node runtime); present in the Pages edge runtime.
  if (typeof caches === "undefined") return null;
  const store = (caches as unknown as { default?: EdgeCache }).default;
  return store ?? null;
}

/**
 * Build a same-zone cache key. Cloudflare's Cache API only stores responses
 * for the current zone, so we key off the incoming request host with a
 * synthetic path namespace that never collides with real routes.
 */
async function cacheKeyFor(key: string): Promise<Request> {
  const host = (await headers()).get("host") ?? "localhost";
  return new Request(`https://${host}/__edge_cache__/${encodeURIComponent(key)}`);
}

/**
 * Read-through edge cache for a JSON-serializable query result.
 *
 * On a hit, the D1 query never runs — this is the lever that keeps browsing
 * off the free-tier rows-read budget. On a miss, `fetcher` runs and the result
 * is stored for `ttlSeconds`. Cache failures degrade gracefully to a direct
 * query so a caching problem can never take down a page.
 *
 * Use only for public (non per-user) data. Staleness is bounded by ttlSeconds;
 * call `invalidateCached(key)` after a write for instant freshness.
 */
export async function cachedQuery<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cache = getEdgeCache();
  if (!cache) return fetcher();

  try {
    const cacheKey = await cacheKeyFor(key);
    const hit = await cache.match(cacheKey);
    if (hit) {
      return (await hit.json()) as T;
    }

    const data = await fetcher();
    const response = new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, s-maxage=${ttlSeconds}`,
      },
    });
    await cache.put(cacheKey, response);
    return data;
  } catch {
    // Never let a cache issue break the page.
    return fetcher();
  }
}

/** Drop a cached entry (call after a write that changes the cached data). */
export async function invalidateCached(key: string): Promise<void> {
  const cache = getEdgeCache();
  if (!cache) return;
  try {
    await cache.delete(await cacheKeyFor(key));
  } catch {
    // best-effort
  }
}
