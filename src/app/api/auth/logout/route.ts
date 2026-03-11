export const runtime = "edge";

import { getDB } from "@/db";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/session=([^;]+)/);

  if (match) {
    const db = getDB();
    await db.delete(sessions).where(eq(sessions.id, match[1]));
  }

  const headers = new Headers();
  headers.set("Set-Cookie", `session=; Path=/; HttpOnly; Max-Age=0`);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers,
  });
}
