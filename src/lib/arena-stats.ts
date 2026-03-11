import { arenaMatchups } from "@/db/schema";
import type { getDB } from "@/db";

type DB = ReturnType<typeof getDB>;

/**
 * Calculate win rates for all hypotheses from matchup data.
 * Formula: (wins + 0.5 * ties) / total_relevant_votes * 100
 */
export async function getAllWinRates(db: DB): Promise<Map<string, number>> {
  const matchups = await db.select().from(arenaMatchups);

  // Track per-hypothesis stats: { wins, ties, total }
  const stats = new Map<string, { wins: number; ties: number; total: number }>();

  const ensure = (id: string) => {
    if (!stats.has(id)) stats.set(id, { wins: 0, ties: 0, total: 0 });
    return stats.get(id)!;
  };

  for (const m of matchups) {
    const total = m.votesA + m.votesB + m.votesTie;
    if (total === 0) continue;

    const sA = ensure(m.hypothesisAId);
    const sB = ensure(m.hypothesisBId);

    sA.wins += m.votesA;
    sA.ties += m.votesTie;
    sA.total += total;

    sB.wins += m.votesB;
    sB.ties += m.votesTie;
    sB.total += total;
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
