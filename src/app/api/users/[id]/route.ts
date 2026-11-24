export const runtime = "edge";

import { getDB } from "@/db";
import { users, hypotheses, comments, stars, experiments, arenaVotes } from "@/db/schema";
import { and, eq, ne, desc } from "drizzle-orm";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const hypothesisFields = {
  id: hypotheses.id,
  statement: hypotheses.statement,
  status: hypotheses.status,
  phase: hypotheses.phase,
  domains: hypotheses.domains,
  isAnonymous: hypotheses.isAnonymous,
  submittedAt: hypotheses.submittedAt,
};

const editableProfileFields = {
  name: users.name,
  position: users.position,
  scholarUrl: users.scholarUrl,
  website: users.website,
  bio: users.bio,
  orcid: users.orcid,
  twitterHandle: users.twitterHandle,
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { getSession } = await import("@/lib/auth");
  const viewer = await getSession(request);
  const { id } = await params;
  const db = getDB();
  const isOwner = viewer?.id === id;

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      affiliation: users.affiliation,
      position: users.position,
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

  const visibility = and(
    eq(hypotheses.submittedBy, id),
    isOwner ? undefined : ne(hypotheses.isAnonymous, 1),
  );
  const [visibleHypotheses, [stats], starredHypotheses] = await Promise.all([
    db
      .select(hypothesisFields)
      .from(hypotheses)
      .where(visibility)
      .orderBy(desc(hypotheses.createdAt), desc(hypotheses.id))
      .limit(50),
    db
      .select({
        hypothesisCount: db.$count(hypotheses, visibility),
        commentCount: db.$count(comments, eq(comments.userId, id)),
        experimentCount: db.$count(experiments, eq(experiments.submittedBy, id)),
        voteCount: db.$count(arenaVotes, eq(arenaVotes.userId, id)),
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1),
    // Keep full collection access until the UI supports paginated stars.
    db
      .select(hypothesisFields)
      .from(stars)
      .innerJoin(hypotheses, eq(stars.hypothesisId, hypotheses.id))
      .where(eq(stars.userId, id))
      .orderBy(desc(hypotheses.createdAt), desc(hypotheses.id)),
  ]);

  // Derive affiliation from email domain
  const emailAffiliation = user.email ? extractAffiliation(user.email) : null;

  return Response.json(
    {
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: isOwner ? user.email : null,
          avatarUrl: user.avatarUrl,
          affiliation: emailAffiliation,
          position: user.position,
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
        starredHypotheses: starredHypotheses.map((h) => ({
          id: h.id,
          statement: h.statement,
          status: h.status,
          phase: h.phase,
          domain: h.domains,
          submittedAt: new Date(h.submittedAt * 1000).toISOString().split("T")[0],
        })),
        stats,
        isOwner,
      },
    },
    {
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await enforceRateLimit(request, RATE_LIMITS.write);
  if (limited) return limited;
  const { getSession, requireSession } = await import("@/lib/auth");
  const viewer = await getSession(request);
  const unauthorized = requireSession(viewer);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  if (viewer!.id !== id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getDB();
  const body = (await request.json()) as Record<string, unknown>;

  const { validateProfile } = await import("@/lib/validation");
  const nameValue = body.name || viewer!.name || "";
  const result = validateProfile({ ...body, name: nameValue });
  if (!result.ok) {
    return Response.json({ errors: result.errors }, { status: 400 });
  }

  const { name, position, scholarUrl, website, bio, orcid, twitterHandle } = result.data;
  const now = Math.floor(Date.now() / 1000);

  const [updatedProfile] = await db
    .update(users)
    .set({
      name,
      position: position || null,
      scholarUrl: scholarUrl || null,
      website: website || null,
      bio: bio || null,
      orcid: orcid || null,
      twitterHandle: twitterHandle || null,
      updatedAt: now,
    })
    .where(eq(users.id, id))
    .returning(editableProfileFields);

  if (!updatedProfile) {
    return Response.json(
      { error: "User not found" },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  return Response.json(
    { ok: true, data: updatedProfile },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

function extractAffiliation(email: string): string | null {
  const domain = email.split("@")[1];
  if (!domain) return null;
  // Common email providers → no affiliation
  const generic = [
    "gmail.com",
    "yahoo.com",
    "hotmail.com",
    "outlook.com",
    "protonmail.com",
    "icloud.com",
    "mail.com",
    "aol.com",
  ];
  if (generic.includes(domain.toLowerCase())) return null;
  // Return the domain without TLD as affiliation hint
  const parts = domain.split(".");
  if (parts.length >= 2) {
    // e.g., cs.stanford.edu → stanford, google.com → google
    const name = parts.length > 2 ? parts[parts.length - 2] : parts[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return domain;
}
