import { Hono } from "hono";
import type { OAuthHelpers, AuthRequest } from "@cloudflare/workers-oauth-provider";

type Bindings = {
  OPENEXPERIMENTS_API_URL: string;
  MCP_SERVER_SECRET: string;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/authorize", async (c) => {
  const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  if (!oauthReqInfo.clientId) {
    return c.text("Invalid OAuth request", 400);
  }

  const state = btoa(JSON.stringify(oauthReqInfo));
  const workerOrigin = new URL(c.req.url).origin;
  const redirectUri = `${workerOrigin}/callback`;
  const dest = new URL(`${c.env.OPENEXPERIMENTS_API_URL}/api/auth/mcp/authorize`);
  dest.searchParams.set("redirect_uri", redirectUri);
  dest.searchParams.set("state", state);
  return c.redirect(dest.toString());
});

app.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  if (!code || !state) return c.text("Missing code or state", 400);

  let oauthReqInfo: AuthRequest;
  try {
    oauthReqInfo = JSON.parse(atob(state)) as AuthRequest;
  } catch {
    return c.text("Invalid state parameter", 400);
  }

  const res = await fetch(`${c.env.OPENEXPERIMENTS_API_URL}/api/auth/mcp/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-MCP-Secret": c.env.MCP_SERVER_SECRET,
    },
    body: JSON.stringify({ code }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return c.text(`Token exchange failed: ${errText}`, 400);
  }

  const { token, userId } = (await res.json()) as {
    token: string;
    userId: string;
  };

  const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthReqInfo,
    userId,
    metadata: {},
    scope: oauthReqInfo.scope || [],
    props: { userId, appToken: token },
  });

  return c.redirect(redirectTo);
});

app.all("*", (c) => c.text("Not found", 404));

export default app;
