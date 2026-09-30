export const runtime = "edge";

import { getDB } from "@/db";
import { mcpTokens } from "@/db/schema";
import { getSessionWithSource } from "@/lib/auth";
import { and, eq } from "drizzle-orm";

function json(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionWithSource(request);
  if (!session || session.source !== "cookie") {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const db = getDB();
  const rows = await db
    .delete(mcpTokens)
    .where(and(eq(mcpTokens.id, id), eq(mcpTokens.userId, session.user.id)))
    .returning({ id: mcpTokens.id });

  if (rows.length === 0) {
    return json({ error: "Token not found" }, { status: 404 });
  }

  return json({ ok: true });
}
