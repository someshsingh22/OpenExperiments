export const runtime = "edge";

import { getRequestContext } from "@cloudflare/next-on-pages";
import { getDB } from "@/db";
import { getSessionWithSource } from "@/lib/auth";
import { createAuthCode } from "@/lib/mcp-tokens";

function isAllowedRedirectUri(redirectUri: string, workerUrl?: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    throw new Error("invalid-url");
  }

  const normalizedWorkerUrl = workerUrl?.trim().replace(/\/+$/, "");
  if (normalizedWorkerUrl) {
    return redirectUri === `${normalizedWorkerUrl}/callback`;
  }

  return (
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
    parsed.port !== "" &&
    parsed.pathname === "/callback" &&
    parsed.search === "" &&
    parsed.hash === "" &&
    parsed.username === "" &&
    parsed.password === ""
  );
}

export async function GET(request: Request) {
  const { env } = getRequestContext();
  const url = new URL(request.url);
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state") || "";

  if (!redirectUri) {
    return Response.json({ error: "redirect_uri is required" }, { status: 400 });
  }

  try {
    if (!isAllowedRedirectUri(redirectUri, env.MCP_WORKER_URL)) {
      return Response.json({ error: "redirect_uri is not allowed" }, { status: 400 });
    }
  } catch {
    return Response.json({ error: "redirect_uri is invalid" }, { status: 400 });
  }

  const session = await getSessionWithSource(request);

  if (!session || session.source !== "cookie") {
    const returnTo = url.pathname + url.search;
    const loginUrl = `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
    return new Response(null, {
      status: 302,
      headers: { Location: loginUrl },
    });
  }

  const db = getDB();
  const code = await createAuthCode(db, session.user.id);

  const target = new URL(redirectUri);
  target.searchParams.set("code", code);
  if (state) target.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: { Location: target.toString() },
  });
}
