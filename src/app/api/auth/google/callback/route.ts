export const runtime = "edge";

import { Google } from "arctic";
import { getRequestContext } from "@cloudflare/next-on-pages";
import { getDB } from "@/db";
import { users, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";

function getCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : null;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

export async function GET(request: Request) {
  const { env } = getRequestContext();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = getCookie(request, "oauth_state");
  const codeVerifier = getCookie(request, "code_verifier");

  if (!code || !state || state !== storedState || !codeVerifier) {
    return new Response("Invalid OAuth callback", { status: 400 });
  }

  const google = new Google(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    `${env.APP_URL}/api/auth/google/callback`,
  );

  let tokens;
  try {
    tokens = await google.validateAuthorizationCode(code, codeVerifier);
  } catch {
    return new Response("Failed to exchange authorization code", { status: 400 });
  }

  // Fetch Google user info
  const googleUserRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.accessToken()}` },
  });
  if (!googleUserRes.ok) {
    return new Response("Failed to fetch user info", { status: 500 });
  }
  const googleUser: GoogleUserInfo = await googleUserRes.json();

  const db = getDB();
  const now = Math.floor(Date.now() / 1000);

  // Upsert user
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.googleId, googleUser.sub))
    .limit(1);

  let userId: string;
  let isNewUser = false;
  if (existing) {
    userId = existing.id;
    await db
      .update(users)
      .set({
        name: googleUser.name,
        avatarUrl: googleUser.picture,
        email: googleUser.email,
        updatedAt: now,
      })
      .where(eq(users.id, userId));
    isNewUser = existing.profileCompleted === 0;
  } else {
    userId = crypto.randomUUID();
    isNewUser = true;
    await db.insert(users).values({
      id: userId,
      googleId: googleUser.sub,
      email: googleUser.email,
      name: googleUser.name,
      avatarUrl: googleUser.picture,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Create session
  const sessionId = crypto.randomUUID();
  const expiresAt = now + 30 * 24 * 60 * 60; // 30 days

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
    createdAt: now,
  });

  // Clear OAuth cookies + set session cookie
  const redirectTo = isNewUser ? `${env.APP_URL}/complete-profile` : env.APP_URL;
  const headers = new Headers();
  headers.set("Location", redirectTo);
  headers.append(
    "Set-Cookie",
    `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`,
  );
  headers.append("Set-Cookie", `oauth_state=; Path=/; HttpOnly; Max-Age=0`);
  headers.append("Set-Cookie", `code_verifier=; Path=/; HttpOnly; Max-Age=0`);

  return new Response(null, { status: 302, headers });
}
