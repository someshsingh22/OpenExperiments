import { lt, sql } from "drizzle-orm";
import { getDB } from "@/db";
import { rateLimits } from "@/db/schema";

export interface RateLimitPolicy {
  bucket: string;
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  // Credential guessing and account creation.
  auth: { bucket: "auth", limit: 10, windowSeconds: 10 * 60 },
  // Submissions, comments, edits, stars.
  write: { bucket: "write", limit: 30, windowSeconds: 60 },
  // Arena votes are cheap but should not be scriptable at scale.
  vote: { bucket: "vote", limit: 60, windowSeconds: 60 },
} satisfies Record<string, RateLimitPolicy>;

const STALE_AFTER_SECONDS = 24 * 60 * 60;

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function clientIp(request: Request) {
  // Cloudflare sets cf-connecting-ip and overwrites any client-supplied value.
  return request.headers.get("cf-connecting-ip")?.trim() || "unknown";
}

/**
 * Counts this request against the policy and returns a 429 response when the
 * client is over the limit, or null when the request may proceed. Fails open
 * if the counter store is unavailable so an outage never blocks the site.
 */
export async function enforceRateLimit(
  request: Request,
  policy: RateLimitPolicy,
  now = Math.floor(Date.now() / 1000),
): Promise<Response | null> {
  const windowStart = now - (now % policy.windowSeconds);
  try {
    const key = `${policy.bucket}:${await sha256(`${clientIp(request)}-openexperiments-rl`)}`;
    const db = getDB();
    const [row] = await db
      .insert(rateLimits)
      .values({ key, windowStart, count: 1 })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`CASE WHEN ${rateLimits.windowStart} = ${windowStart} THEN ${rateLimits.count} + 1 ELSE 1 END`,
          windowStart,
        },
      })
      .returning({ count: rateLimits.count });

    if (Math.random() < 0.02) {
      await db.delete(rateLimits).where(lt(rateLimits.windowStart, now - STALE_AFTER_SECONDS));
    }

    if (row && row.count > policy.limit) {
      const retryAfter = Math.max(1, windowStart + policy.windowSeconds - now);
      return Response.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
  } catch (error) {
    console.error("Rate limit check failed", error);
  }
  return null;
}
