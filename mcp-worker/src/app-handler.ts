import { Hono } from "hono";
import type {
  AuthRequest,
  ClientInfo,
  OAuthHelpers,
} from "@cloudflare/workers-oauth-provider";

type Bindings = {
  OPENEXPERIMENTS_API_URL: string;
  OPENEXPERIMENTS_SITE_URL?: string;
  MCP_SERVER_SECRET: string;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
};

type StoredOAuthState = {
  oauthReqInfo: AuthRequest;
  csrfToken: string;
  createdAt: number;
};

type TokenExchangeResponse = {
  token: string;
  userId: string;
};

const AUTH_STATE_TTL_SECONDS = 600;
const STATE_COOKIE = "__Host-oe_mcp_state";
const CSRF_COOKIE = "__Host-oe_mcp_csrf";
const AUTH_STATE_PREFIX = "oauth-state:";
const AUTH_HELP =
  "Your OpenExperiments connection has expired or was revoked — reconnect the OpenExperiments connector in your AI assistant's settings.";

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
  const origin = new URL(c.req.url).origin;
  return html(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OpenExperiments MCP Connector</title>
  <style>
    body { color: #17202a; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.6; margin: 2rem auto; max-width: 760px; padding: 0 1rem; }
    code { background: #f3f4f6; border-radius: 0.25rem; padding: 0.1rem 0.25rem; }
    .card { border: 1px solid #d8dee9; border-radius: 0.75rem; padding: 1rem 1.25rem; }
  </style>
</head>
<body>
  <h1>OpenExperiments MCP Connector</h1>
  <div class="card">
    <p>Use this remote MCP connector to connect OpenExperiments to AI assistants.</p>
    <ul>
      <li>Streamable HTTP: <code>${escapeHtml(origin)}/mcp</code></li>
      <li>Legacy SSE: <code>${escapeHtml(origin)}/sse</code></li>
    </ul>
    <p>When prompted, sign in to OpenExperiments and approve the connector.</p>
  </div>
</body>
</html>`,
    200,
  );
});

app.get("/health", (c) => c.json({ ok: true }));

app.get("/authorize", async (c) => {
  if (!c.env.MCP_SERVER_SECRET) {
    return c.text("OpenExperiments MCP connector is not configured", 500);
  }

  const oauthReqInfo = await parseOAuthRequest(c.env.OAUTH_PROVIDER, c.req.raw);
  if (!oauthReqInfo?.clientId) {
    return c.text("Invalid OAuth request", 400);
  }

  const client = await c.env.OAUTH_PROVIDER.lookupClient(oauthReqInfo.clientId);
  if (!client) {
    return c.text("Unknown OAuth client", 400);
  }

  const nonce = randomBase64Url(32);
  const csrfToken = randomBase64Url(32);
  const storedState: StoredOAuthState = {
    oauthReqInfo,
    csrfToken,
    createdAt: Math.floor(Date.now() / 1000),
  };
  await c.env.OAUTH_KV.put(stateKey(nonce), JSON.stringify(storedState), {
    expirationTtl: AUTH_STATE_TTL_SECONDS,
  });

  const response = consentPage(oauthReqInfo, client, nonce, csrfToken);
  response.headers.append(
    "Set-Cookie",
    cookie(CSRF_COOKIE, `${nonce}.${csrfToken}`, AUTH_STATE_TTL_SECONDS),
  );
  return response;
});

app.post("/authorize", async (c) => {
  if (!c.env.MCP_SERVER_SECRET) {
    return c.text("OpenExperiments MCP connector is not configured", 500);
  }

  const form = await c.req.raw.formData().catch(() => null);
  if (!form) return c.text("Invalid form submission", 400);

  const nonce = stringFormValue(form, "nonce");
  const csrfToken = stringFormValue(form, "csrf_token");
  const decision = stringFormValue(form, "decision");
  if (!nonce || !csrfToken || !decision) {
    return c.text("Missing authorization form fields", 400);
  }

  const csrfCookie = getCookie(c.req.raw, CSRF_COOKIE);
  if (csrfCookie !== `${nonce}.${csrfToken}`) {
    return c.text("Invalid CSRF token", 403);
  }

  const storedState = await loadStoredState(c.env.OAUTH_KV, nonce);
  if (!storedState || storedState.csrfToken !== csrfToken) {
    return c.text("Expired or invalid authorization request", 400);
  }

  if (decision === "deny") {
    await c.env.OAUTH_KV.delete(stateKey(nonce));
    const denyUrl = new URL(storedState.oauthReqInfo.redirectUri);
    denyUrl.searchParams.set("error", "access_denied");
    denyUrl.searchParams.set(
      "error_description",
      "The OpenExperiments connector was not approved.",
    );
    if (storedState.oauthReqInfo.state) {
      denyUrl.searchParams.set("state", storedState.oauthReqInfo.state);
    }
    return redirectWithCookies(denyUrl.toString(), [
      clearCookie(CSRF_COOKIE),
      clearCookie(STATE_COOKIE),
    ]);
  }

  if (decision !== "approve") {
    return c.text("Invalid authorization decision", 400);
  }

  const workerOrigin = new URL(c.req.url).origin;
  const redirectUri = `${workerOrigin}/callback`;
  const dest = new URL(`${trimTrailingSlash(c.env.OPENEXPERIMENTS_API_URL)}/api/auth/mcp/authorize`);
  dest.searchParams.set("redirect_uri", redirectUri);
  dest.searchParams.set("state", nonce);

  return redirectWithCookies(dest.toString(), [
    cookie(STATE_COOKIE, nonce, AUTH_STATE_TTL_SECONDS),
    clearCookie(CSRF_COOKIE),
  ]);
});

app.get("/callback", async (c) => {
  if (!c.env.MCP_SERVER_SECRET) {
    return c.text("OpenExperiments MCP connector is not configured", 500);
  }

  const code = c.req.query("code");
  const nonce = c.req.query("state");
  if (!code || !nonce) return c.text("Missing code or state", 400);

  const nonceCookie = getCookie(c.req.raw, STATE_COOKIE);
  if (nonceCookie !== nonce) {
    return textClearingState("Invalid OAuth state", 400);
  }

  const storedState = await loadStoredState(c.env.OAUTH_KV, nonce);
  await c.env.OAUTH_KV.delete(stateKey(nonce));
  if (!storedState) {
    return textClearingState("Expired or invalid OAuth state", 400);
  }

  const tokenExchange = await exchangeCodeForToken(
    c.env.OPENEXPERIMENTS_API_URL,
    c.env.MCP_SERVER_SECRET,
    code,
  );
  if (!tokenExchange.ok) {
    return textClearingState(tokenExchange.message, tokenExchange.status);
  }

  const { token, userId } = tokenExchange.value;
  const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
    request: storedState.oauthReqInfo,
    userId,
    metadata: { clientId: storedState.oauthReqInfo.clientId },
    scope: storedState.oauthReqInfo.scope || [],
    props: { userId, appToken: token },
  });

  return redirectWithCookies(redirectTo, [clearCookie(STATE_COOKIE)]);
});

app.all("*", (c) => c.text("Not found", 404));

async function parseOAuthRequest(
  oauthProvider: OAuthHelpers,
  request: Request,
): Promise<AuthRequest | null> {
  try {
    return await oauthProvider.parseAuthRequest(request);
  } catch {
    return null;
  }
}

function consentPage(
  oauthReqInfo: AuthRequest,
  client: ClientInfo,
  nonce: string,
  csrfToken: string,
): Response {
  const clientName = client.clientName || client.clientId || "an MCP client";
  const clientUri = client.clientUri || "Not provided";
  const redirectUri = oauthReqInfo.redirectUri;
  const requestedScopes = oauthReqInfo.scope.length > 0 ? oauthReqInfo.scope.join(", ") : "default connector access";

  return html(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Approve OpenExperiments Connector</title>
  <style>
    body { color: #17202a; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.6; margin: 2rem auto; max-width: 760px; padding: 0 1rem; }
    .panel { border: 1px solid #d8dee9; border-radius: 0.75rem; padding: 1.25rem; }
    dt { font-weight: 700; margin-top: 0.75rem; }
    dd { margin-left: 0; overflow-wrap: anywhere; }
    button { border: 0; border-radius: 0.5rem; cursor: pointer; font-weight: 700; margin-right: 0.75rem; padding: 0.7rem 1rem; }
    .approve { background: #0f766e; color: white; }
    .deny { background: #e5e7eb; color: #111827; }
  </style>
</head>
<body>
  <h1>Approve OpenExperiments access?</h1>
  <div class="panel">
    <p><strong>${escapeHtml(clientName)}</strong> is requesting access to your OpenExperiments account.</p>
    <dl>
      <dt>Client website</dt>
      <dd>${escapeHtml(clientUri)}</dd>
      <dt>OAuth redirect URI</dt>
      <dd>${escapeHtml(redirectUri)}</dd>
      <dt>Requested scopes</dt>
      <dd>${escapeHtml(requestedScopes)}</dd>
    </dl>
    <p>This grants the connector permission to act as you on OpenExperiments: read data, submit hypotheses, experiments, and datasets, comment, vote, star, and edit your profile.</p>
    <form method="post" action="/authorize">
      <input type="hidden" name="nonce" value="${escapeHtml(nonce)}">
      <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}">
      <button class="approve" type="submit" name="decision" value="approve">Approve connector</button>
      <button class="deny" type="submit" name="decision" value="deny">Deny</button>
    </form>
  </div>
</body>
</html>`,
    200,
  );
}

async function exchangeCodeForToken(
  apiUrl: string,
  secret: string,
  code: string,
): Promise<
  | { ok: true; value: TokenExchangeResponse }
  | { ok: false; status: number; message: string }
> {
  let response: Response;
  try {
    response = await fetch(`${trimTrailingSlash(apiUrl)}/api/auth/mcp/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-MCP-Secret": secret,
      },
      body: JSON.stringify({ code }),
    });
  } catch {
    return {
      ok: false,
      status: 502,
      message: "OpenExperiments token exchange is unavailable",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status >= 500 ? 502 : 400,
      message: `OpenExperiments token exchange failed (${response.status})`,
    };
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!isTokenExchangeResponse(payload)) {
    return {
      ok: false,
      status: 502,
      message: "OpenExperiments token exchange returned an invalid response",
    };
  }

  return { ok: true, value: payload };
}

function isTokenExchangeResponse(value: unknown): value is TokenExchangeResponse {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.token === "string" && typeof record.userId === "string";
}

async function loadStoredState(
  kv: KVNamespace,
  nonce: string,
): Promise<StoredOAuthState | null> {
  const raw = await kv.get(stateKey(nonce));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredOAuthState;
  } catch {
    return null;
  }
}

function stateKey(nonce: string): string {
  return `${AUTH_STATE_PREFIX}${nonce}`;
}

function stringFormValue(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === "string" ? value : undefined;
}

function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function getCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) return rawValue.join("=");
  }
  return undefined;
}

function cookie(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function clearCookie(name: string): string {
  return `${name}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function redirectWithCookies(location: string, cookies: string[]): Response {
  const headers = new Headers({ Location: location });
  for (const value of cookies) headers.append("Set-Cookie", value);
  return new Response(null, { status: 302, headers });
}

function textClearingState(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "Set-Cookie": clearCookie(STATE_COOKIE) },
  });
}

function html(markup: string, status: number): Response {
  return new Response(markup, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, "");
}

export { AUTH_HELP };
export default app;
