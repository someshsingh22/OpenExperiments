export const runtime = "edge";

import { Google } from "arctic";
import { getRequestContext } from "@cloudflare/next-on-pages";

export async function GET() {
  const { env } = getRequestContext();
  const google = new Google(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    `${env.APP_URL}/api/auth/google/callback`,
  );

  const state = crypto.randomUUID();
  const codeVerifier = crypto.randomUUID() + crypto.randomUUID();
  const url = google.createAuthorizationURL(state, codeVerifier, ["openid", "profile", "email"]);

  const headers = new Headers();
  headers.set("Location", url.toString());
  headers.append(
    "Set-Cookie",
    `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  );
  headers.append(
    "Set-Cookie",
    `code_verifier=${codeVerifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  );

  return new Response(null, { status: 302, headers });
}
