export const runtime = "edge";

import { getDB } from "@/db";
import { arenaVotes, arenaMatchups } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function POST(request: Request) {
  const { getSession } = await import("@/lib/auth");
  const user = await getSession(request);
  const db = getDB();
  const body = await request.json();
  const { matchupId, vote } = body as { matchupId: string; vote: string };

  if (!matchupId || !vote) {
    return Response.json({ error: "matchupId and vote are required" }, { status: 400 });
  }

  if (!["a", "b", "tie", "both_weak"].includes(vote)) {
    return Response.json({ error: "vote must be a, b, tie, or both_weak" }, { status: 400 });
  }

  // Dedup: use userId if logged in, otherwise hash IP
  let ipHash: string | null = null;
  if (user) {
    const [existing] = await db
      .select()
      .from(arenaVotes)
      .where(and(eq(arenaVotes.matchupId, matchupId), eq(arenaVotes.userId, user.id)))
      .limit(1);
    if (existing) {
      return Response.json({ error: "Already voted on this matchup" }, { status: 409 });
    }
  } else {
    const ip =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for") ||
      "unknown";
    const encoder = new TextEncoder();
    const hashData = encoder.encode(ip + "-openexperiments-salt");
    const hashBuffer = await crypto.subtle.digest("SHA-256", hashData);
    ipHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const [existing] = await db
      .select()
      .from(arenaVotes)
      .where(and(eq(arenaVotes.matchupId, matchupId), eq(arenaVotes.voterIpHash, ipHash)))
      .limit(1);
    if (existing) {
      return Response.json({ error: "Already voted on this matchup" }, { status: 409 });
    }
  }

  // Verify matchup exists
  const [matchup] = await db
    .select()
    .from(arenaMatchups)
    .where(eq(arenaMatchups.id, matchupId))
    .limit(1);

  if (!matchup) {
    return Response.json({ error: "Matchup not found" }, { status: 404 });
  }

  const voteId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  // Insert vote
  await db.insert(arenaVotes).values({
    id: voteId,
    matchupId,
    userId: user?.id ?? null,
    voterIpHash: ipHash,
    vote,
    createdAt: now,
  });

  // Update aggregate counts (both_weak only increments total_votes, not any vote column)
  const voteColumn =
    vote === "a" ? "votes_a" : vote === "b" ? "votes_b" : vote === "tie" ? "votes_tie" : null;
  if (voteColumn) {
    await db.run(sql`
      UPDATE arena_matchups
      SET total_votes = total_votes + 1,
          ${sql.raw(voteColumn)} = ${sql.raw(voteColumn)} + 1,
          updated_at = ${now}
      WHERE id = ${matchupId}
    `);
  } else {
    await db.run(sql`
      UPDATE arena_matchups
      SET total_votes = total_votes + 1,
          updated_at = ${now}
      WHERE id = ${matchupId}
    `);
  }

  // Return updated matchup
  const [updated] = await db
    .select()
    .from(arenaMatchups)
    .where(eq(arenaMatchups.id, matchupId))
    .limit(1);

  return Response.json({
    data: {
      id: updated.id,
      totalVotes: updated.totalVotes,
      votesA: updated.votesA,
      votesB: updated.votesB,
      votesTie: updated.votesTie,
    },
  });
}
