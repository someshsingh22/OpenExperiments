import { arenaMatchups, hypotheses } from "@/db/schema";
import { eq, or, inArray } from "drizzle-orm";
import type { getDB } from "@/db";

type DB = ReturnType<typeof getDB>;

/**
 * Calculate win rates for all hypotheses from matchup data.
 * Formula: (wins + 0.5 * ties) / total_relevant_votes * 100
 */
export async function getAllWinRates(db: DB): Promise<Map<string, number>> {
  const matchups = await db.select().from(arenaMatchups);

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

export async function getWinRate(db: DB, hypothesisId: string): Promise<number | null> {
  const rates = await getAllWinRates(db);
  return rates.get(hypothesisId) ?? null;
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
  const matchups = await db.select().from(arenaMatchups);
  if (matchups.length === 0) return [];

  // Collect all hypothesis IDs from matchups
  const hypIds = new Set<string>();
  for (const m of matchups) {
    hypIds.add(m.hypothesisAId);
    hypIds.add(m.hypothesisBId);
  }

  // Fetch source info for these hypotheses
  const hyps = await db
    .select({
      id: hypotheses.id,
      source: hypotheses.source,
      agentName: hypotheses.agentName,
    })
    .from(hypotheses)
    .where(inArray(hypotheses.id, [...hypIds]));

  // Build lookup: hypothesisId -> source label
  const sourceMap = new Map<string, { label: string; type: "human" | "ai_agent" }>();
  for (const h of hyps) {
    const label = h.source === "ai_agent" ? h.agentName || "AI Agent" : "Human";
    sourceMap.set(h.id, { label, type: h.source as "human" | "ai_agent" });
  }

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

    const srcA = sourceMap.get(m.hypothesisAId);
    const srcB = sourceMap.get(m.hypothesisBId);
    if (!srcA || !srcB) continue;

    const sA = ensure(srcA.label, srcA.type);
    const sB = ensure(srcB.label, srcB.type);

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

/**
 * One-time backfill: compute win rates from all matchups and write to hypotheses table.
 */
export async function backfillWinRates(db: DB) {
  const rates = await getAllWinRates(db);
  for (const [id, rate] of rates) {
    await db.update(hypotheses).set({ winRate: rate }).where(eq(hypotheses.id, id));
  }
}
