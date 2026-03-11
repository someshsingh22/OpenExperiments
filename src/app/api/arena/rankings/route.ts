export const runtime = "edge";

import { getDB } from "@/db";
import { hypotheses } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getAllWinRates } from "@/lib/arena-stats";

export async function GET() {
  const db = getDB();

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

  const ranked = completed
    .map((h) => ({
      id: h.id,
      statement: h.statement,
      domain: h.domains,
      winRate: winRates.get(h.id) ?? 0,
    }))
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 10);

  return Response.json({ data: ranked });
}
