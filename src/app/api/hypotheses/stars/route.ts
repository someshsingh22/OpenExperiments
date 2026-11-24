export const runtime = "edge";

import { getDB } from "@/db";
import { stars } from "@/db/schema";
import { inArray, sql } from "drizzle-orm";
import { STAR_BATCH_LIMIT } from "@/lib/star-batch";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids");
  if (!idsParam) {
    return Response.json({ error: "ids parameter is required" }, { status: 400 });
  }

  const ids = [...new Set(idsParam.split(",").filter(Boolean))];
  if (ids.length > STAR_BATCH_LIMIT) {
    return Response.json(
      { error: `At most ${STAR_BATCH_LIMIT} unique ids are allowed` },
      { status: 400 },
    );
  }
  if (ids.length === 0) {
    return Response.json(
      { data: {} },
      {
        headers: { "Cache-Control": "private, max-age=60" },
      },
    );
  }

  const { getSession } = await import("@/lib/auth");
  const user = await getSession(request);
  const db = getDB();

  const counts = await db
    .select({
      hypothesisId: stars.hypothesisId,
      count: sql<number>`count(*)`.as("count"),
      starred: (user
        ? sql<number>`max(case when ${stars.userId} = ${user.id} then 1 else 0 end)`
        : sql<number>`0`
      ).as("starred"),
    })
    .from(stars)
    .where(inArray(stars.hypothesisId, ids))
    .groupBy(stars.hypothesisId);

  const countMap = new Map(counts.map((c) => [c.hypothesisId, c]));

  const result: Record<string, { count: number; starred: boolean }> = {};
  for (const id of ids) {
    result[id] = {
      count: countMap.get(id)?.count ?? 0,
      starred: Boolean(countMap.get(id)?.starred),
    };
  }

  return Response.json(
    { data: result },
    {
      headers: { "Cache-Control": "private, max-age=60" },
    },
  );
}
