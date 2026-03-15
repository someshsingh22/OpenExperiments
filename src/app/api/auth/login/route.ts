export const runtime = "edge";

import { getDB } from "@/db";
import { users, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/password";

export async function POST(request: Request) {
  const db = getDB();
  const body = (await request.json()) as { email: string; password: string };
  const { email, password } = body;

  if (!email || !password) {
    return Response.json({ error: "Email and password are required" }, { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user || !user.passwordHash) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);
  const sessionId = crypto.randomUUID();
  const expiresAt = now + 30 * 24 * 60 * 60;

  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    expiresAt,
    createdAt: now,
  });

  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append(
    "Set-Cookie",
    `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`,
  );

  return new Response(
    JSON.stringify({
      user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
    }),
    { status: 200, headers },
  );
}
