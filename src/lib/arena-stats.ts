import { arenaMatchups, hypotheses } from "@/db/schema";
import { eq, or, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { getDB } from "@/db";

type DB = ReturnType<typeof getDB>;

/**
 * Calculate win rates for all hypotheses from matchup data.
 * Formula: (wins + 0.5 * ties) / total_relevant_votes * 100
 */
export async function getAllWinRates(db: DB): Promise<Map<string, number>> {
  const matchups = await db
    .select({
      hypothesisAId: arenaMatchups.hypothesisAId,
      hypothesisBId: arenaMatchups.hypothesisBId,
      votesA: arenaMatchups.votesA,
      votesB: arenaMatchups.votesB,
      votesTie: arenaMatchups.votesTie,
    })
    .from(arenaMatchups);

  const stats = new Map<string, { wins: number; ties: number; total: number }>();

  const ensure = (id: string) => {
    if (!stats.has(id)) stats.set(id, { wins: 0, ties: 0, total: 0 });
    return stats.get(id)!;
  };

  for (const m of matchups) {
    const meaningful = m.votesA + m.votesB + m.votesTie;
    if (meaningful === 0) continue;

    const sA = ensure(m.hypothesisAId);
    const sB = ensure(m.hypothesisBId);

    sA.wins += m.votesA;
    sA.ties += m.votesTie;
    sA.total += meaningful;

    sB.wins += m.votesB;
    sB.ties += m.votesTie;
    sB.total += meaningful;
  }

  const rates = new Map<string, number>();
  for (const [id, s] of stats) {
    if (s.total > 0) {
      rates.set(id, Math.round(((s.wins + 0.5 * s.ties) / s.total) * 100));
    }
  }

  return rates;
}

/**
 * Aggregate win rates by source (Human / agent name).
 * Groups all hypotheses by their submitter type and computes a single
 * win rate per source across all their matchups.
 */
export async function getSourceWinRates(db: DB): Promise<
  {
    source: string;
    sourceType: "human" | "ai_agent";
    winRate: number;
    hypothesisCount: number;
    matchups: number;
  }[]
> {
  const hypothesisA = alias(hypotheses, "hypothesis_a");
  const hypothesisB = alias(hypotheses, "hypothesis_b");
  const matchups = await db
    .select({
      hypothesisAId: arenaMatchups.hypothesisAId,
      hypothesisBId: arenaMatchups.hypothesisBId,
      votesA: arenaMatchups.votesA,
      votesB: arenaMatchups.votesB,
      votesTie: arenaMatchups.votesTie,
      sourceA: hypothesisA.source,
      agentNameA: hypothesisA.agentName,
      sourceB: hypothesisB.source,
      agentNameB: hypothesisB.agentName,
    })
    .from(arenaMatchups)
    .innerJoin(hypothesisA, eq(arenaMatchups.hypothesisAId, hypothesisA.id))
    .innerJoin(hypothesisB, eq(arenaMatchups.hypothesisBId, hypothesisB.id));

  // Aggregate per source
  const stats = new Map<
    string,
    {
      type: "human" | "ai_agent";
      wins: number;
      ties: number;
      total: number;
      hypIds: Set<string>;
      matchups: number;
    }
  >();

  const ensure = (label: string, type: "human" | "ai_agent") => {
    if (!stats.has(label))
      stats.set(label, { type, wins: 0, ties: 0, total: 0, hypIds: new Set(), matchups: 0 });
    return stats.get(label)!;
  };

  for (const m of matchups) {
    const meaningful = m.votesA + m.votesB + m.votesTie;
    if (meaningful === 0) continue;

    const labelA = m.sourceA === "ai_agent" ? m.agentNameA || "AI Agent" : "Human";
    const labelB = m.sourceB === "ai_agent" ? m.agentNameB || "AI Agent" : "Human";
    const sA = ensure(labelA, m.sourceA as "human" | "ai_agent");
    const sB = ensure(labelB, m.sourceB as "human" | "ai_agent");

    sA.wins += m.votesA;
    sA.ties += m.votesTie;
    sA.total += meaningful;
    sA.hypIds.add(m.hypothesisAId);
    sA.matchups += 1;

    sB.wins += m.votesB;
    sB.ties += m.votesTie;
    sB.total += meaningful;
    sB.hypIds.add(m.hypothesisBId);
    sB.matchups += 1;
  }

  const results: {
    source: string;
    sourceType: "human" | "ai_agent";
    winRate: number;
    hypothesisCount: number;
    matchups: number;
  }[] = [];
  for (const [label, s] of stats) {
    if (s.total > 0) {
      results.push({
        source: label,
        sourceType: s.type,
        winRate: Math.round(((s.wins + 0.5 * s.ties) / s.total) * 100),
        hypothesisCount: s.hypIds.size,
        matchups: s.matchups,
      });
    }
  }

  return results.sort((a, b) => b.winRate - a.winRate);
}

/**
 * After a vote, recompute and persist win rates for both hypotheses in a matchup.
 * Reads only matchups involving those two hypotheses (not the whole table).
 */
export async function updateWinRatesForMatchup(db: DB, matchupId: string) {
  const [matchup] = await db
    .select()
    .from(arenaMatchups)
    .where(eq(arenaMatchups.id, matchupId))
    .limit(1);
  if (!matchup) return;

  const hypIds = [matchup.hypothesisAId, matchup.hypothesisBId];

  // Fetch all matchups involving either hypothesis
  const relevant = await db
    .select()
    .from(arenaMatchups)
    .where(
      or(
        inArray(arenaMatchups.hypothesisAId, hypIds),
        inArray(arenaMatchups.hypothesisBId, hypIds),
      ),
    );

  // Compute stats for each hypothesis
  for (const hypId of hypIds) {
    let wins = 0;
    let ties = 0;
    let total = 0;

    for (const m of relevant) {
      const meaningful = m.votesA + m.votesB + m.votesTie;
      if (meaningful === 0) continue;

      if (m.hypothesisAId === hypId) {
        wins += m.votesA;
        ties += m.votesTie;
        total += meaningful;
      } else if (m.hypothesisBId === hypId) {
        wins += m.votesB;
        ties += m.votesTie;
        total += meaningful;
      }
    }

    const rate = total > 0 ? Math.round(((wins + 0.5 * ties) / total) * 100) : null;

    await db
      .update(hypotheses)
      .set({ winRate: rate, arenaWins: wins, arenaTotal: total })
      .where(eq(hypotheses.id, hypId));
  }
}
