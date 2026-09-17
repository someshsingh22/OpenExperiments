import { eq, and, gt } from "drizzle-orm";
import { mcpAuthCodes, mcpTokens, users } from "@/db/schema";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "@/db/schema";

type DB = DrizzleD1Database<typeof schema>;

const AUTH_CODE_TTL_SECONDS = 10 * 60;

export async function createAuthCode(db: DB, userId: string): Promise<string> {
  const code = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await db.insert(mcpAuthCodes).values({
    code,
    userId,
    expiresAt: now + AUTH_CODE_TTL_SECONDS,
    createdAt: now,
  });
  return code;
}

export async function consumeAuthCode(db: DB, code: string): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  const rows = await db
    .select({ userId: mcpAuthCodes.userId })
    .from(mcpAuthCodes)
    .where(and(eq(mcpAuthCodes.code, code), gt(mcpAuthCodes.expiresAt, now)))
    .limit(1);

  if (rows.length === 0) return null;

  await db.delete(mcpAuthCodes).where(eq(mcpAuthCodes.code, code));
  return rows[0].userId;
}

export async function createMcpToken(db: DB, userId: string, label?: string): Promise<string> {
  const token = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await db.insert(mcpTokens).values({
    token,
    userId,
    label: label ?? null,
    createdAt: now,
  });
  return token;
}

export async function resolveMcpToken(db: DB, token: string): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  const rows = await db
    .select({ userId: mcpTokens.userId, expiresAt: mcpTokens.expiresAt })
    .from(mcpTokens)
    .where(eq(mcpTokens.token, token))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  if (row.expiresAt !== null && row.expiresAt <= now) return null;

  await db.update(mcpTokens).set({ lastUsedAt: now }).where(eq(mcpTokens.token, token));

  return row.userId;
}

export async function resolveTokenToUser(
  db: DB,
  token: string,
): Promise<{
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  profileCompleted: number;
} | null> {
  const now = Math.floor(Date.now() / 1000);
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      profileCompleted: users.profileCompleted,
      tokenExpiresAt: mcpTokens.expiresAt,
    })
    .from(mcpTokens)
    .innerJoin(users, eq(mcpTokens.userId, users.id))
    .where(eq(mcpTokens.token, token))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  if (row.tokenExpiresAt !== null && row.tokenExpiresAt <= now) return null;

  await db.update(mcpTokens).set({ lastUsedAt: now }).where(eq(mcpTokens.token, token));

  return {
    id: row.userId,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatarUrl,
    profileCompleted: row.profileCompleted,
  };
}
