export const runtime = "edge";

import { getDB } from "@/db";
import { comments, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getSession, requireSession } from "@/lib/auth";

export async function GET(request: Request) {
  const db = getDB();
  const url = new URL(request.url);
  const hypothesisId = url.searchParams.get("hypothesisId");

  if (!hypothesisId) {
    return Response.json({ error: "hypothesisId query param required" }, { status: 400 });
  }

  const rows = await db
    .select({
      id: comments.id,
      hypothesisId: comments.hypothesisId,
      body: comments.body,
      doi: comments.doi,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
      authorName: users.name,
      authorAvatar: users.avatarUrl,
      authorId: users.id,
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.hypothesisId, hypothesisId));

  return Response.json(
    {
      data: rows.map((c) => ({
        id: c.id,
        hypothesisId: c.hypothesisId,
        body: c.body,
        doi: c.doi,
        createdAt: new Date(c.createdAt * 1000).toISOString().split("T")[0],
        parentId: c.parentId,
        author: c.authorId
          ? { id: c.authorId, name: c.authorName, avatarUrl: c.authorAvatar }
          : null,
      })),
    },
    {
      headers: { "Cache-Control": "public, max-age=30, s-maxage=120" },
    },
  );
}

export async function POST(request: Request) {
  const user = await getSession(request);
  const unauthorized = requireSession(user);
  if (unauthorized) return unauthorized;

  const db = getDB();
  const body = await request.json();

  const { validateComment } = await import("@/lib/validation");
  const result = validateComment(body as Record<string, unknown>);
  if (!result.ok) {
    return Response.json({ errors: result.errors }, { status: 400 });
  }

  const { hypothesisId, content, doi, parentId } = result.data;

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.insert(comments).values({
    id,
    hypothesisId,
    userId: user!.id,
    body: content,
    doi: doi || null,
    parentId: parentId || null,
    createdAt: now,
    updatedAt: now,
  });

  // Increment comment count
  await db.run(
    sql`UPDATE hypotheses SET comment_count = comment_count + 1, updated_at = ${now} WHERE id = ${hypothesisId}`,
  );

  return Response.json(
    {
      data: {
        id,
        hypothesisId,
        body: content,
        doi: doi || null,
        parentId: parentId || null,
        createdAt: new Date(now * 1000).toISOString().split("T")[0],
        author: { id: user!.id, name: user!.name, avatarUrl: user!.avatarUrl },
      },
    },
    { status: 201 },
  );
}
