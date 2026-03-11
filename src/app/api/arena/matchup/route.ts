export const runtime = "edge";

import { getDB } from "@/db";
import { arenaMatchups, hypotheses } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  const db = getDB();

  // Pick a random matchup
  const [matchup] = await db
    .select()
    .from(arenaMatchups)
    .orderBy(sql`RANDOM()`)
    .limit(1);

  if (!matchup) {
    return Response.json({ error: "No matchups available" }, { status: 404 });
  }

  // Fetch both hypotheses
  const [hypA] = await db
    .select()
    .from(hypotheses)
    .where(eq(hypotheses.id, matchup.hypothesisAId))
    .limit(1);

  const [hypB] = await db
    .select()
    .from(hypotheses)
    .where(eq(hypotheses.id, matchup.hypothesisBId))
    .limit(1);

  return Response.json({
    data: {
      id: matchup.id,
      totalVotes: matchup.totalVotes,
      votesA: matchup.votesA,
      votesB: matchup.votesB,
      votesTie: matchup.votesTie,
      hypothesisA: hypA
        ? {
            id: hypA.id,
            statement: hypA.statement,
            domain: hypA.domains,
            arenaElo: hypA.arenaElo,
          }
        : null,
      hypothesisB: hypB
        ? {
            id: hypB.id,
            statement: hypB.statement,
            domain: hypB.domains,
            arenaElo: hypB.arenaElo,
          }
        : null,
    },
  });
}
