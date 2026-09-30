import { eq, and, gt } from "drizzle-orm";
import { mcpAuthCodes, mcpTokens, users } from "@/db/schema";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "@/db/schema";

type DB = DrizzleD1Database<typeof schema>;

export type McpTokenSource = "oauth" | "personal";

export interface CreatedMcpToken {
  id: string;
  token: string;
  label: string | null;
  source: McpTokenSource;
  createdAt: number;
  expiresAt: number | null;
}

const AUTH_CODE_TTL_SECONDS = 10 * 60;
const LAST_USED_UPDATE_INTERVAL_SECONDS = 5 * 60;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes: number): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return bytesToHex(value);
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return bytesToHex(new Uint8Array(digest));
}

export async function hashMcpSecret(secret: string): Promise<string> {
  return sha256Hex(secret);
}

export function generateMcpBearerToken(): string {
  return `oe_${randomHex(32)}`;
}

export async function createAuthCode(db: DB, userId: string): Promise<string> {
  const code = randomHex(32);
  const codeHash = await hashMcpSecret(code);
  const now = Math.floor(Date.now() / 1000);
  await db.insert(mcpAuthCodes).values({
    codeHash,
    userId,
    expiresAt: now + AUTH_CODE_TTL_SECONDS,
    createdAt: now,
  });
  return code;
}

export async function consumeAuthCode(db: DB, code: string): Promise<string | null> {
  const codeHash = await hashMcpSecret(code);
  const now = Math.floor(Date.now() / 1000);
  const rows = await db
    .delete(mcpAuthCodes)
    .where(and(eq(mcpAuthCodes.codeHash, codeHash), gt(mcpAuthCodes.expiresAt, now)))
    .returning({ userId: mcpAuthCodes.userId });

  return rows[0]?.userId ?? null;
}

export async function createMcpToken(
  db: DB,
  userId: string,
  options: {
    label?: string | null;
    source: McpTokenSource;
    expiresAt?: number | null;
  },
): Promise<CreatedMcpToken> {
  const token = generateMcpBearerToken();
  const tokenHash = await hashMcpSecret(token);
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  const label = options.label ?? null;
  const expiresAt = options.expiresAt ?? null;

  await db.insert(mcpTokens).values({
    id,
    tokenHash,
    userId,
    label,
    source: options.source,
    expiresAt,
    createdAt: now,
  });

  return {
    id,
    token,
    label,
    source: options.source,
    createdAt: now,
    expiresAt,
  };
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
  const tokenHash = await hashMcpSecret(token);
  const now = Math.floor(Date.now() / 1000);
  const rows = await db
    .select({
      tokenId: mcpTokens.id,
      userId: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      profileCompleted: users.profileCompleted,
      tokenExpiresAt: mcpTokens.expiresAt,
      lastUsedAt: mcpTokens.lastUsedAt,
    })
    .from(mcpTokens)
    .innerJoin(users, eq(mcpTokens.userId, users.id))
    .where(eq(mcpTokens.tokenHash, tokenHash))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  if (row.tokenExpiresAt !== null && row.tokenExpiresAt <= now) return null;

  if (row.lastUsedAt === null || row.lastUsedAt <= now - LAST_USED_UPDATE_INTERVAL_SECONDS) {
    await db.update(mcpTokens).set({ lastUsedAt: now }).where(eq(mcpTokens.id, row.tokenId));
  }

  return {
    id: row.userId,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatarUrl,
    profileCompleted: row.profileCompleted,
  };
}
