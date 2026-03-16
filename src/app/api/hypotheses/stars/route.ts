export const runtime = "edge";

import { getDB } from "@/db";
import { stars } from "@/db/schema";
import { inArray, eq, and, sql } from "drizzle-orm";

export async function GET(request: Request) {
  const { getSession } = await import("@/lib/auth");
  const user = await getSession(request);
  const db = getDB();

  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids");
  if (!idsParam) {
    return Response.json({ error: "ids parameter is required" }, { status: 400 });
  }

  const ids = idsParam.split(",").filter(Boolean);
  if (ids.length === 0) {
    return Response.json(
      { data: {} },
      {
        headers: { "Cache-Control": "private, max-age=60" },
      },
    );
  }

  // Batch count stars per hypothesis
  const counts = await db
    .select({
      hypothesisId: stars.hypothesisId,
      count: sql<number>`count(*)`,
    })
    .from(stars)
    .where(inArray(stars.hypothesisId, ids))
    .groupBy(stars.hypothesisId);

  const countMap = new Map(counts.map((c) => [c.hypothesisId, c.count]));

  // Batch check which ones the user has starred
  const starredSet = new Set<string>();
  if (user) {
    const userStars = await db
      .select({ hypothesisId: stars.hypothesisId })
      .from(stars)
      .where(and(eq(stars.userId, user.id), inArray(stars.hypothesisId, ids)));
    for (const s of userStars) {
      starredSet.add(s.hypothesisId);
    }
  }

  const result: Record<string, { count: number; starred: boolean }> = {};
  for (const id of ids) {
    result[id] = {
      count: countMap.get(id) ?? 0,
      starred: starredSet.has(id),
    };
  }

  return Response.json(
    { data: result },
    {
      headers: { "Cache-Control": "private, max-age=60" },
    },
  );
}
