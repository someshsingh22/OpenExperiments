export const runtime = "edge";

import { getDB } from "@/db";
import { hypotheses } from "@/db/schema";
import { eq, desc, isNotNull, and } from "drizzle-orm";
import { getAllWinRates } from "@/lib/arena-stats";

export async function GET() {
  const db = getDB();

  // Try denormalized win_rate column first (fast path)
  const ranked = await db
    .select({
      id: hypotheses.id,
      statement: hypotheses.statement,
      domains: hypotheses.domains,
      winRate: hypotheses.winRate,
    })
    .from(hypotheses)
    .where(and(eq(hypotheses.phase, "completed"), isNotNull(hypotheses.winRate)))
    .orderBy(desc(hypotheses.winRate))
    .limit(10);

  if (ranked.length > 0) {
    return Response.json(
      {
        data: ranked.map((h) => ({
          id: h.id,
          statement: h.statement,
          domain: h.domains,
          winRate: h.winRate ?? 0,
        })),
      },
      {
        headers: { "Cache-Control": "public, max-age=120, s-maxage=300" },
      },
    );
  }

  // Fallback: compute from matchups (pre-backfill or empty win_rate column)
  const completed = await db
    .select({
      id: hypotheses.id,
      statement: hypotheses.statement,
      domains: hypotheses.domains,
    })
    .from(hypotheses)
    .where(eq(hypotheses.phase, "completed"))
    .orderBy(desc(hypotheses.arenaElo));

  const winRates = await getAllWinRates(db);

  const fallbackRanked = completed
    .map((h) => ({
      id: h.id,
      statement: h.statement,
      domain: h.domains,
      winRate: winRates.get(h.id) ?? 0,
    }))
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 10);

  return Response.json(
    { data: fallbackRanked },
    {
      headers: { "Cache-Control": "public, max-age=120, s-maxage=300" },
    },
  );
}
