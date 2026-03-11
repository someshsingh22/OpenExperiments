import { getDB } from "@/db";
import { sessions, users } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  profileCompleted: boolean;
}

export async function getSession(request: Request): Promise<SessionUser | null> {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return null;

  const sessionId = match[1];
  const db = getDB();
  const now = Math.floor(Date.now() / 1000);

  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      profileCompleted: users.profileCompleted,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
    .limit(1);

  if (rows.length === 0) return null;

  return {
    id: rows[0].userId,
    email: rows[0].email,
    name: rows[0].name,
    avatarUrl: rows[0].avatarUrl,
    profileCompleted: rows[0].profileCompleted === 1,
  };
}

export function requireSession(user: SessionUser | null): Response | null {
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
