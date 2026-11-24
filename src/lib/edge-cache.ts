import { headers } from "next/headers";
import { getRequestContext } from "@cloudflare/next-on-pages";

/**
 * Minimal typed view of Cloudflare's `caches.default`. The Web `CacheStorage`
 * type does not include `.default`, which is a Workers/Pages extension.
 */
interface EdgeCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
  delete(request: Request): Promise<boolean>;
}

interface Flight {
  promise: Promise<unknown>;
  invalidated: boolean;
  write?: Promise<void>;
}

const MAX_FLIGHTS = 128;
const flights = new Map<string, Flight>();

function logCacheFailure(operation: string): void {
  // Never log cache keys, request headers, payloads, or underlying errors.
  console.warn(`[edge-cache] ${operation} failed`);
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
 * Use only for public, viewer-independent JSON data. Entries expire after
 * ttlSeconds from storage; eviction can cause earlier misses. Invalidation is
 * best-effort and local to the current Cloudflare data center and host, not a
 * global freshness guarantee. Coalescing and fill fencing are isolate-local.
 */
export async function cachedQuery<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cache = getEdgeCache();
  if (!cache) return fetcher();

  let cacheKey: Request;
  try {
    cacheKey = await cacheKeyFor(key);
  } catch {
    logCacheFailure("key construction");
    return fetcher();
  }

  const url = cacheKey.url;
  const existing = flights.get(url);
  if (existing) return existing.promise as Promise<T>;

  // At capacity, bypass storage as well: an untracked fill cannot be fenced.
  if (flights.size >= MAX_FLIGHTS) return fetcher();

  const flight: Flight = {
    invalidated: false,
    promise: Promise.resolve().then(async () => {
      try {
        const hit = await cache.match(cacheKey);
        if (hit) return (await hit.json()) as T;
      } catch {
        logCacheFailure("lookup or JSON decoding");
      }

      // Fetcher failures propagate unchanged, without an implicit retry.
      const data = await fetcher();
      if (flight.invalidated) return data;

      flight.write = Promise.resolve()
        .then(async () => {
          if (flight.invalidated) return;
          const response = new Response(JSON.stringify(data), {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": `public, s-maxage=${ttlSeconds}`,
            },
          });
          await cache.put(cacheKey, response);
        })
        .catch(() => {
          logCacheFailure("serialization or write");
        });
      void flight.write.then(cleanup);

      try {
        const { ctx } = getRequestContext();
        ctx.waitUntil(flight.write);
      } catch {
        logCacheFailure("background scheduling");
        await flight.write;
      }
      return data;
    }),
  };
  function cleanup(): void {
    if (flights.get(url) === flight) flights.delete(url);
  }
  flights.set(url, flight);
  void flight.promise.then(() => {
    if (!flight.write) cleanup();
  }, cleanup);
  return flight.promise as Promise<T>;
}

/**
 * Best-effort deletion on this host/data center only. Fences this isolate's
 * pending fills, but other isolates and locations can stay stale until expiry.
 */
export async function invalidateCached(key: string): Promise<void> {
  const cache = getEdgeCache();
  if (!cache) return;
  try {
    const cacheKey = await cacheKeyFor(key);
    const flight = flights.get(cacheKey.url);
    if (flight) {
      flight.invalidated = true;
      flights.delete(cacheKey.url);
      // A put already in progress must settle before deletion to avoid
      // restoring its pre-invalidation snapshot after the delete.
      await flight.write;
    }
    await cache.delete(cacheKey);
  } catch {
    logCacheFailure("invalidation");
  }
}

/** Omit the ID when creating a hypothesis without a previously cached detail. */
export async function invalidateHypothesisCaches(id?: string): Promise<void> {
  await Promise.all([
    invalidateCached("home:data"),
    invalidateCached("explore:data"),
    invalidateCached("sitemap:hyps"),
    ...(id === undefined ? [] : [invalidateCached(`hypothesis:${id}`)]),
  ]);
}

export async function invalidateExperimentCaches(hypothesisId: string): Promise<void> {
  await Promise.all([
    invalidateCached("experiments:list"),
    invalidateCached(`hypothesis:${hypothesisId}`),
    invalidateCached("explore:data"),
    invalidateCached("datasets:list"),
  ]);
}
