export const runtime = "edge";

import { getRequestContext } from "@cloudflare/next-on-pages";
import { getDB } from "@/db";
import { consumeAuthCode, createMcpToken } from "@/lib/mcp-tokens";

export async function POST(request: Request) {
  const { env } = getRequestContext();

  const secret = request.headers.get("x-mcp-secret");
  if (!secret || secret !== env.MCP_SERVER_SECRET) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: unknown = await request.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("code" in body) ||
    typeof (body as Record<string, unknown>).code !== "string"
  ) {
    return Response.json({ error: "Request body must include a string `code`" }, { status: 400 });
  }

  const { code } = body as { code: string };
  const db = getDB();

  const userId = await consumeAuthCode(db, code);
  if (!userId) {
    return Response.json({ error: "Invalid or expired authorization code" }, { status: 400 });
  }

  const token = await createMcpToken(db, userId, "mcp-remote");
  return Response.json({ token, userId });
}
