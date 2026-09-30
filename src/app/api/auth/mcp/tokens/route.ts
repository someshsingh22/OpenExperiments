export const runtime = "edge";

import { getDB } from "@/db";
import { mcpTokens } from "@/db/schema";
import { getSessionWithSource } from "@/lib/auth";
import { createMcpToken } from "@/lib/mcp-tokens";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";

const ACTIVE_TOKEN_LIMIT = 25;
const ALLOWED_EXPIRY_DAYS = [7, 30, 90, 365] as const;

function json(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function toIso(seconds: number | null): string | null {
  return seconds === null ? null : new Date(seconds * 1000).toISOString();
}

async function getCookieUser(request: Request): Promise<{ id: string } | null> {
  const session = await getSessionWithSource(request);
  if (!session || session.source !== "cookie") return null;
  return { id: session.user.id };
}

function activeTokenPredicate(userId: string, now: number) {
  return and(
    eq(mcpTokens.userId, userId),
    or(isNull(mcpTokens.expiresAt), gt(mcpTokens.expiresAt, now)),
  );
}

export async function GET(request: Request) {
  const user = await getCookieUser(request);
  if (!user) return json({ error: "Unauthorized" }, { status: 401 });

  const now = Math.floor(Date.now() / 1000);
  const db = getDB();
  const rows = await db
    .select({
      id: mcpTokens.id,
      label: mcpTokens.label,
      source: mcpTokens.source,
      createdAt: mcpTokens.createdAt,
      lastUsedAt: mcpTokens.lastUsedAt,
      expiresAt: mcpTokens.expiresAt,
    })
    .from(mcpTokens)
    .where(activeTokenPredicate(user.id, now))
    .orderBy(desc(mcpTokens.createdAt));

  return json({
    data: rows.map((row) => ({
      id: row.id,
      label: row.label,
      source: row.source,
      createdAt: toIso(row.createdAt),
      lastUsedAt: toIso(row.lastUsedAt),
      expiresAt: toIso(row.expiresAt),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCookieUser(request);
  if (!user) return json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (typeof body !== "object" || body === null) {
    return json({ error: "Request body must be an object" }, { status: 400 });
  }

  const parsed = body as { label?: unknown; expiresInDays?: unknown };
  let label: string | null = null;
  if (parsed.label !== undefined && parsed.label !== null) {
    if (typeof parsed.label !== "string") {
      return json({ error: "label must be a string" }, { status: 400 });
    }
    const trimmed = parsed.label.trim();
    if (trimmed.length > 100) {
      return json({ error: "label must be at most 100 characters" }, { status: 400 });
    }
    label = trimmed.length > 0 ? trimmed : null;
  }

  let expiresInDays: (typeof ALLOWED_EXPIRY_DAYS)[number] | null = null;
  if (parsed.expiresInDays !== undefined && parsed.expiresInDays !== null) {
    if (
      typeof parsed.expiresInDays !== "number" ||
      !ALLOWED_EXPIRY_DAYS.includes(parsed.expiresInDays as (typeof ALLOWED_EXPIRY_DAYS)[number])
    ) {
      return json(
        { error: "expiresInDays must be one of 7, 30, 90, 365, or null" },
        { status: 400 },
      );
    }
    expiresInDays = parsed.expiresInDays as (typeof ALLOWED_EXPIRY_DAYS)[number];
  }

  const now = Math.floor(Date.now() / 1000);
  const db = getDB();
  const activeRows = await db
    .select({ id: mcpTokens.id })
    .from(mcpTokens)
    .where(activeTokenPredicate(user.id, now))
    .limit(ACTIVE_TOKEN_LIMIT);

  if (activeRows.length >= ACTIVE_TOKEN_LIMIT) {
    return json({ error: "Active MCP token limit reached" }, { status: 409 });
  }

  const expiresAt = expiresInDays === null ? null : now + expiresInDays * 24 * 60 * 60;
  const created = await createMcpToken(db, user.id, {
    label,
    source: "personal",
    expiresAt,
  });

  return json(
    {
      token: created.token,
      id: created.id,
      label: created.label,
      source: created.source,
      createdAt: toIso(created.createdAt),
      expiresAt: toIso(created.expiresAt),
    },
    { status: 201 },
  );
}
