"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Bot, Check, Copy, KeyRound, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createMcpToken, getMcpTokens, revokeMcpToken } from "@/lib/api";
import type { CreatedMcpToken, McpTokenSummary } from "@/lib/types";

const mcpWorkerUrl = process.env.NEXT_PUBLIC_MCP_WORKER_URL?.replace(/\/+$/, "") ?? "";

function formatDate(value: string | null): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function sourceLabel(source: McpTokenSummary["source"]): string {
  return source === "oauth" ? "Remote connector" : "Personal";
}

export function McpSettingsClient() {
  const { user, loading: authLoading, setShowAuthModal } = useAuth();
  const [tokens, setTokens] = useState<McpTokenSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [label, setLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<"7" | "30" | "90" | "365" | "none">("90");
  const [creating, setCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState<CreatedMcpToken | null>(null);
  const [copied, setCopied] = useState(false);
  const [siteOrigin, setSiteOrigin] = useState("https://openexperiments.pages.dev");

  useEffect(() => {
    setSiteOrigin(window.location.origin);
  }, []);

  const tokenPlaceholder = createdToken?.token ?? "<paste-token-shown-once>";

  const desktopConfig = useMemo(
    () =>
      JSON.stringify(
        {
          mcpServers: {
            openexperiments: {
              command: "node",
              args: ["/path/to/mcp-server/dist/index.js"],
              env: {
                OPENEXPERIMENTS_API_URL: siteOrigin,
                OPENEXPERIMENTS_TOKEN: tokenPlaceholder,
              },
            },
          },
        },
        null,
        2,
      ),
    [siteOrigin, tokenPlaceholder],
  );

  const claudeCodeCommand = `claude mcp add openexperiments -e OPENEXPERIMENTS_TOKEN=${tokenPlaceholder} -e OPENEXPERIMENTS_API_URL=${siteOrigin} -- npx -y @openexperiments/mcp-server`;

  const loadTokens = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const res = await getMcpTokens();
      setTokens(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load MCP tokens");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      void loadTokens();
    }
  }, [loadTokens, user]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setError("");
    setCreatedToken(null);
    try {
      const expires =
        expiresInDays === "none" ? null : (Number(expiresInDays) as 7 | 30 | 90 | 365);
      const token = await createMcpToken({
        label: label.trim() || undefined,
        expiresInDays: expires,
      });
      setCreatedToken(token);
      setLabel("");
      await loadTokens();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create MCP token");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleRevoke = async (id: string) => {
    setError("");
    try {
      await revokeMcpToken(id);
      setTokens((current) => current.filter((token) => token.id !== id));
      if (createdToken?.id === id) setCreatedToken(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke MCP token");
    }
  };

  if (authLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <KeyRound className="mx-auto mb-4 h-10 w-10 text-stone-300" />
        <h1 className="mb-2 text-2xl font-semibold text-stone-900">AI / MCP access</h1>
        <p className="mb-6 text-sm text-stone-500">
          Sign in to create and manage tokens for AI assistants.
        </p>
        <button
          onClick={() => setShowAuthModal(true)}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <Bot className="h-5 w-5 text-stone-500" />
          <h1 className="text-2xl font-semibold text-stone-900">AI / MCP access</h1>
        </div>
        <p className="text-sm text-stone-500">
          Create tokens for local tools or connect through the hosted remote MCP connector.
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {createdToken && (
        <section className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="mb-2 text-sm font-semibold text-amber-900">Copy your token now</h2>
          <p className="mb-3 text-sm text-amber-800">
            This plaintext token is shown once. Store it securely before leaving this page.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-white px-3 py-2 text-xs text-stone-800">
              {createdToken.token}
            </code>
            <button
              onClick={() => handleCopy(createdToken.token)}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </section>
      )}

      <section className="mb-8 rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold text-stone-900">Personal tokens</h2>
        <form onSubmit={handleCreate} className="mb-6 grid gap-3 md:grid-cols-[1fr_160px_auto]">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={100}
            placeholder="Label (optional)"
            className="rounded-md border border-stone-200 px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:border-stone-300 focus:ring-1 focus:ring-stone-300 focus:outline-none"
          />
          <select
            value={expiresInDays}
            onChange={(event) =>
              setExpiresInDays(event.target.value as "7" | "30" | "90" | "365" | "none")
            }
            className="rounded-md border border-stone-200 px-3 py-2 text-sm text-stone-800 focus:border-stone-300 focus:ring-1 focus:ring-stone-300 focus:outline-none"
          >
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="365">365 days</option>
            <option value="none">No expiry</option>
          </select>
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? "Creating..." : "Create token"}
          </button>
        </form>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
          </div>
        ) : tokens.length === 0 ? (
          <p className="rounded-lg bg-stone-50 px-4 py-6 text-center text-sm text-stone-500">
            No active MCP tokens yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-stone-200">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="grid gap-3 border-b border-stone-100 p-4 last:border-b-0 md:grid-cols-[1fr_auto]"
              >
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-medium text-stone-900">{token.label || "Untitled"}</span>
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                      {sourceLabel(token.source)}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500">
                    Created {formatDate(token.createdAt)} · Last used {formatDate(token.lastUsedAt)}{" "}
                    · Expires {token.expiresAt ? formatDate(token.expiresAt) : "Never"}
                  </p>
                </div>
                <button
                  onClick={() => handleRevoke(token.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-200 px-3 py-2 text-sm font-medium text-stone-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-5 rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-stone-900">Connect your AI assistant</h2>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-stone-700">Remote connector</h3>
          {mcpWorkerUrl ? (
            <div className="space-y-2">
              <code className="block overflow-x-auto rounded-md bg-stone-50 px-3 py-2 text-xs text-stone-700">
                {mcpWorkerUrl}/sse
              </code>
              <code className="block overflow-x-auto rounded-md bg-stone-50 px-3 py-2 text-xs text-stone-700">
                {mcpWorkerUrl}/mcp
              </code>
            </div>
          ) : (
            <p className="rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-500">
              Set NEXT_PUBLIC_MCP_WORKER_URL at build time to display hosted connector URLs.
            </p>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-stone-700">Claude Code local stdio</h3>
          <pre className="overflow-x-auto rounded-md bg-stone-950 p-3 text-xs text-stone-100">
            {claudeCodeCommand}
          </pre>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-stone-700">Claude Desktop JSON config</h3>
          <pre className="overflow-x-auto rounded-md bg-stone-950 p-3 text-xs text-stone-100">
            {desktopConfig}
          </pre>
        </div>
      </section>
    </div>
  );
}
