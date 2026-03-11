export const runtime = "edge";

import { getDB } from "@/db";
import { users, hypotheses, comments } from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { getSession } = await import("@/lib/auth");
  const viewer = await getSession(request);
  const { id } = await params;
  const db = getDB();
  const isOwner = viewer?.id === id;

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
      affiliation: users.affiliation,
      scholarUrl: users.scholarUrl,
      website: users.website,
      bio: users.bio,
      orcid: users.orcid,
      twitterHandle: users.twitterHandle,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const allHypotheses = await db
    .select()
    .from(hypotheses)
    .where(eq(hypotheses.submittedBy, id))
    .orderBy(desc(hypotheses.createdAt))
    .limit(50);

  const [{ commentCount }] = await db
    .select({ commentCount: sql<number>`count(*)` })
    .from(comments)
    .where(eq(comments.userId, id));

  // Filter hypotheses based on viewer: owner sees all, others only non-anonymous
  const visibleHypotheses = isOwner
    ? allHypotheses
    : allHypotheses.filter((h) => h.isAnonymous !== 1);

  return Response.json({
    data: {
      user: {
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        affiliation: user.affiliation,
        scholarUrl: user.scholarUrl,
        website: user.website,
        bio: user.bio,
        orcid: user.orcid,
        twitterHandle: user.twitterHandle,
        joinedAt: new Date(user.createdAt * 1000).toISOString().split("T")[0],
      },
      hypotheses: visibleHypotheses.map((h) => ({
        id: h.id,
        statement: h.statement,
        status: h.status,
        phase: h.phase,
        domain: h.domains,
        isAnonymous: h.isAnonymous === 1,
        submittedAt: new Date(h.submittedAt * 1000).toISOString().split("T")[0],
      })),
      stats: {
        hypothesisCount: allHypotheses.length,
        commentCount,
      },
      isOwner,
    },
  });
}
