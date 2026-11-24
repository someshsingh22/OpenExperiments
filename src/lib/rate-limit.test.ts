import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/sqlite-proxy";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", () => ({ getDB: () => state.db }));
vi.unmock("@/lib/rate-limit");

import { enforceRateLimit } from "./rate-limit";

const policy = { bucket: "test", limit: 2, windowSeconds: 60 };
const request = (ip: string) =>
  new Request("https://x.test", { headers: { "cf-connecting-ip": ip } });

let sqlite: DatabaseSync;
beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    readFileSync(new URL("../../drizzle/migrations/0009_rate_limits.sql", import.meta.url), "utf8")
      .split("--> statement-breakpoint")
      .join("\n"),
  );
  state.db = drizzle(async (query, params, method) => {
    const stmt = sqlite.prepare(query);
    if (method === "run") {
      stmt.run(...(params as never[]));
      return { rows: [] };
    }
    const rows = stmt.all(...(params as never[])).map((row) => Object.values(row));
    return { rows: method === "get" ? rows[0] : rows };
  });
});

describe("enforceRateLimit", () => {
  it("allows up to the limit per IP, then returns 429 with Retry-After", async () => {
    const now = 1_000_040;
    expect(await enforceRateLimit(request("1.1.1.1"), policy, now)).toBeNull();
    expect(await enforceRateLimit(request("1.1.1.1"), policy, now)).toBeNull();
    const blocked = await enforceRateLimit(request("1.1.1.1"), policy, now);
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toBe("40");
    expect(await enforceRateLimit(request("2.2.2.2"), policy, now)).toBeNull();
  });

  it("resets in the next window and never stores raw IPs", async () => {
    for (let i = 0; i < 3; i++) await enforceRateLimit(request("1.1.1.1"), policy, 1_000_040);
    expect(await enforceRateLimit(request("1.1.1.1"), policy, 1_000_100)).toBeNull();
    const keys = sqlite.prepare("SELECT key, count FROM rate_limits").all();
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatchObject({ count: 1 });
    expect(String(keys[0].key)).not.toContain("1.1.1.1");
  });

  it("fails open when the counter store is unavailable", async () => {
    state.db = null;
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await enforceRateLimit(request("1.1.1.1"), policy, 1_000_040)).toBeNull();
  });
});
