export const runtime = "edge";

import { getDB } from "@/db";
import { stars } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getSession, requireSession } from "@/lib/auth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession(request);
  const { id } = await params;
  const db = getDB();

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(stars)
    .where(eq(stars.hypothesisId, id));

  let starred = false;
  if (user) {
    const [existing] = await db
      .select()
      .from(stars)
      .where(and(eq(stars.userId, user.id), eq(stars.hypothesisId, id)))
      .limit(1);
    starred = !!existing;
  }

  return Response.json(
    { data: { count, starred } },
    {
      headers: { "Cache-Control": "private, max-age=60" },
    },
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession(request);
  const unauthorized = requireSession(user);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const db = getDB();

  const [existing] = await db
    .select()
    .from(stars)
    .where(and(eq(stars.userId, user!.id), eq(stars.hypothesisId, id)))
    .limit(1);

  const now = Math.floor(Date.now() / 1000);

  if (existing) {
    // Unstar
    await db.delete(stars).where(and(eq(stars.userId, user!.id), eq(stars.hypothesisId, id)));
  } else {
    // Star
    await db.insert(stars).values({
      userId: user!.id,
      hypothesisId: id,
      createdAt: now,
    });
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(stars)
    .where(eq(stars.hypothesisId, id));

  return Response.json({ data: { count, starred: !existing } });
}
