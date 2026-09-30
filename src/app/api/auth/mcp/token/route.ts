export const runtime = "edge";

import { getRequestContext } from "@cloudflare/next-on-pages";
import { getDB } from "@/db";
import { consumeAuthCode, createMcpToken } from "@/lib/mcp-tokens";

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

async function sha256Bytes(value: string): Promise<Uint8Array> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return new Uint8Array(digest);
}

async function isValidSecret(
  candidate: string | null,
  expected: string | undefined,
): Promise<boolean> {
  if (candidate === null || !expected) return false;

  const [candidateHash, expectedHash] = await Promise.all([
    sha256Bytes(candidate),
    sha256Bytes(expected),
  ]);
  return constantTimeEqual(candidateHash, expectedHash);
}

export async function POST(request: Request) {
  const { env } = getRequestContext();

  if (!env.MCP_SERVER_SECRET) {
    return Response.json({ error: "MCP token exchange is not configured" }, { status: 503 });
  }

  const secret = request.headers.get("x-mcp-secret");
  if (!(await isValidSecret(secret, env.MCP_SERVER_SECRET))) {
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

  const created = await createMcpToken(db, userId, {
    label: "Remote MCP connector",
    source: "oauth",
  });
  return Response.json({ token: created.token, userId });
}
