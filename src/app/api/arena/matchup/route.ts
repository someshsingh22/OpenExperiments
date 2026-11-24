export const runtime = "edge";

import { getDB } from "@/db";
import { arenaMatchups, hypotheses } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

export async function GET() {
  const db = getDB();

  // Keep uniform random OFFSET sampling; join hypotheses after selecting one matchup.
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(arenaMatchups);

  if (total === 0) {
    return Response.json({ error: "No matchups available" }, { status: 404 });
  }

  const offset = Math.floor(Math.random() * total);
  const selectedMatchup = db
    .select({
      id: arenaMatchups.id,
      totalVotes: arenaMatchups.totalVotes,
      votesA: arenaMatchups.votesA,
      votesB: arenaMatchups.votesB,
      votesTie: arenaMatchups.votesTie,
      hypothesisAId: arenaMatchups.hypothesisAId,
      hypothesisBId: arenaMatchups.hypothesisBId,
    })
    .from(arenaMatchups)
    .limit(1)
    .offset(offset)
    .as("selected_matchup");
  const hypothesisA = alias(hypotheses, "hypothesis_a");
  const hypothesisB = alias(hypotheses, "hypothesis_b");
  const [matchup] = await db
    .select({
      id: selectedMatchup.id,
      totalVotes: selectedMatchup.totalVotes,
      votesA: selectedMatchup.votesA,
      votesB: selectedMatchup.votesB,
      votesTie: selectedMatchup.votesTie,
      hypothesisA: {
        id: hypothesisA.id,
        statement: hypothesisA.statement,
        domain: hypothesisA.domains,
        arenaElo: hypothesisA.arenaElo,
        source: hypothesisA.source,
        agentName: hypothesisA.agentName,
      },
      hypothesisB: {
        id: hypothesisB.id,
        statement: hypothesisB.statement,
        domain: hypothesisB.domains,
        arenaElo: hypothesisB.arenaElo,
        source: hypothesisB.source,
        agentName: hypothesisB.agentName,
      },
    })
    .from(selectedMatchup)
    .leftJoin(hypothesisA, eq(hypothesisA.id, selectedMatchup.hypothesisAId))
    .leftJoin(hypothesisB, eq(hypothesisB.id, selectedMatchup.hypothesisBId));

  if (!matchup) {
    return Response.json({ error: "No matchups available" }, { status: 404 });
  }

  return Response.json(
    { data: matchup },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
