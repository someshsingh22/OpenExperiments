export const runtime = "edge";

import { getDB } from "@/db";
import { arenaVotes, arenaMatchups } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { updateWinRatesForMatchup } from "@/lib/arena-stats";
import { invalidateCached } from "@/lib/edge-cache";

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

  // Build the counter update (both_weak bumps only total_votes).
  const base = {
    totalVotes: sql`${arenaMatchups.totalVotes} + 1`,
    updatedAt: now,
  };
  const counters =
    vote === "a"
      ? { ...base, votesA: sql`${arenaMatchups.votesA} + 1` }
      : vote === "b"
        ? { ...base, votesB: sql`${arenaMatchups.votesB} + 1` }
        : vote === "tie"
          ? { ...base, votesTie: sql`${arenaMatchups.votesTie} + 1` }
          : base;

  // Insert the vote row and bump the matchup counters atomically. D1 runs a
  // batch as a single transaction, so the vote and its count can't desync, and
  // the (matchup_id, user_id) unique index makes a concurrent double-vote fail
  // here rather than slip past the check-then-insert above (TOCTOU).
  try {
    await db.batch([
      db.insert(arenaVotes).values({
        id: voteId,
        matchupId,
        userId: user?.id ?? null,
        voterIpHash: ipHash,
        vote,
        createdAt: now,
      }),
      db.update(arenaMatchups).set(counters).where(eq(arenaMatchups.id, matchupId)),
    ]);
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      return Response.json({ error: "Already voted on this matchup" }, { status: 409 });
    }
    throw err;
  }

  // Recompute denormalized win rates. Derived + idempotent, so it's fine that
  // this runs after (not inside) the atomic batch — a later vote recomputes it.
  await updateWinRatesForMatchup(db, matchupId);

  // Win rate is displayed on the home/explore listings and both hypothesis
  // detail pages; drop their cached snapshots so the vote is reflected.
  await Promise.all([
    invalidateCached("home:data"),
    invalidateCached("explore:data"),
    invalidateCached(`hypothesis:${matchup.hypothesisAId}`),
    invalidateCached(`hypothesis:${matchup.hypothesisBId}`),
  ]);

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
