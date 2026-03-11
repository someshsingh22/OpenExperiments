export const runtime = "edge";

import { getDB } from "@/db";
import { users, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/password";

export async function POST(request: Request) {
  const db = getDB();
  const body = await request.json() as { email: string; password: string; name: string };
  const { email, password, name } = body;

  if (!email || !password || !name) {
    return Response.json({ error: "Email, password, and name are required" }, { status: 400 });
  }

  if (password.length < 6) {
    return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  // Check if email already exists
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return Response.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const now = Math.floor(Date.now() / 1000);
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  await db.insert(users).values({
    id: userId,
    email,
    name,
    passwordHash,
    createdAt: now,
    updatedAt: now,
  });

  // Create session
  const sessionId = crypto.randomUUID();
  const expiresAt = now + 30 * 24 * 60 * 60;

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
    createdAt: now,
  });

  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append(
    "Set-Cookie",
    `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`
  );

  return new Response(
    JSON.stringify({ user: { id: userId, name, email, avatarUrl: null } }),
    { status: 201, headers }
  );
}
