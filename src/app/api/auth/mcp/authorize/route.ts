export const runtime = "edge";

import { getDB } from "@/db";
import { getSession } from "@/lib/auth";
import { createAuthCode } from "@/lib/mcp-tokens";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state") || "";

  if (!redirectUri) {
    return Response.json({ error: "redirect_uri is required" }, { status: 400 });
  }

  const parsed = new URL(redirectUri);
  const isLocalhost = parsed.protocol === "http:" && parsed.hostname === "localhost";
  const isHttps = parsed.protocol === "https:";
  if (!isLocalhost && !isHttps) {
    return Response.json(
      { error: "redirect_uri must be https or http://localhost" },
      { status: 400 },
    );
  }

  const user = await getSession(request);

  if (!user) {
    const returnTo = url.pathname + url.search;
    const loginUrl = `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
    return new Response(null, {
      status: 302,
      headers: { Location: loginUrl },
    });
  }

  const db = getDB();
  const code = await createAuthCode(db, user.id);

  const target = new URL(redirectUri);
  target.searchParams.set("code", code);
  if (state) target.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: { Location: target.toString() },
  });
}
