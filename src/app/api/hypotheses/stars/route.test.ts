import { createRequire } from "node:module";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, runtime } from "./route";
import { GET as getSingle, POST as toggleSingle } from "../[id]/star/route";
import { STAR_BATCH_LIMIT } from "@/lib/star-batch";

type SQLiteValue = string | number | bigint | null | Uint8Array;
interface SQLiteConnection {
  exec(sql: string): void;
  close(): void;
  prepare(sql: string): {
    all(...params: SQLiteValue[]): Record<string, SQLiteValue>[];
    run(...params: SQLiteValue[]): unknown;
  };
}
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => SQLiteConnection;
};

const mocks = vi.hoisted(() => ({
  getDB: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock("@/db", () => ({ getDB: mocks.getDB }));
vi.mock("@/lib/auth", () => ({
  getSession: mocks.getSession,
  requireSession: (user: unknown) =>
    user ? undefined : Response.json({ error: "Unauthorized" }, { status: 401 }),
}));

describe("star queries against SQLite", () => {
  let sqlite: SQLiteConnection;
  let statements: { sql: string; params: unknown[] }[];

  beforeEach(() => {
    statements = [];
    mocks.getSession.mockReset().mockResolvedValue(null);
    mocks.getDB.mockReset();
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
      CREATE TABLE stars (
        user_id TEXT, hypothesis_id TEXT, created_at INTEGER,
        PRIMARY KEY(user_id, hypothesis_id)
      );
      INSERT INTO stars VALUES
        ('viewer', 'h-1', 0), ('other', 'h-1', 0), ('third', 'h-1', 0),
        ('other', 'h-2', 0);
    `);
    mocks.getDB.mockReturnValue(
      drizzle(async (sql, params, method) => {
        statements.push({ sql, params });
        const query = sqlite.prepare(sql);
        if (method === "run") {
          query.run(...(params as SQLiteValue[]));
          return { rows: [] };
        }
        return { rows: query.all(...(params as SQLiteValue[])).map((row) => Object.values(row)) };
      }),
    );
  });

  afterEach(() => sqlite.close());

  function batch(ids?: string[]) {
    const url = new URL("https://example.test/api/hypotheses/stars");
    if (ids) url.searchParams.set("ids", ids.join(","));
    return GET(new Request(url));
  }

  function single() {
    return getSingle(new Request("https://example.test/api/hypotheses/h-1/star"), {
      params: Promise.resolve({ id: "h-1" }),
    });
  }

  it.each([undefined, [], Array.from({ length: 100 }, (_, i) => `h-${i}`)])(
    "rejects missing/oversized input before session or database access: %j",
    async (ids) => {
      const response = await batch(ids);
      expect(response.status).toBe(400);
      expect(mocks.getSession).not.toHaveBeenCalled();
      expect(mocks.getDB).not.toHaveBeenCalled();
      expect(statements).toHaveLength(0);
    },
  );

  it("returns comma-only empty input without accessing session or database", async () => {
    const response = await batch(["", "", ""]);
    expect(await response.json()).toEqual({ data: {} });
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.getDB).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=60");
  });

  it.each([null, { id: "viewer" }, { id: "another-viewer" }])(
    "gets counts and membership in one statement for %j",
    async (viewer) => {
      mocks.getSession.mockResolvedValue(viewer);
      const response = await batch(["h-1", "h-2", "missing", "h-1"]);
      expect(await response.json()).toEqual({
        data: {
          "h-1": { count: 3, starred: viewer?.id === "viewer" },
          "h-2": { count: 1, starred: false },
          missing: { count: 0, starred: false },
        },
      });
      expect(statements).toHaveLength(1);
      expect(statements[0].params).toHaveLength(viewer ? 4 : 3);
      expect(response.headers.get("Cache-Control")).toBe("private, max-age=60");
      expect(runtime).toBe("edge");
    },
  );

  it("accepts 99 unique IDs with exactly 100 authenticated bind parameters", async () => {
    mocks.getSession.mockResolvedValue({ id: "viewer" });
    const response = await batch(Array.from({ length: STAR_BATCH_LIMIT }, (_, i) => `h-${i}`));
    expect(response.status).toBe(200);
    expect(statements).toHaveLength(1);
    expect(statements[0].params).toHaveLength(100);
  });

  it("bounds unique IDs rather than repeated duplicate parameters", async () => {
    const response = await batch(Array(150).fill("h-1"));
    expect(await response.json()).toEqual({ data: { "h-1": { count: 3, starred: false } } });
    expect(statements[0].params).toEqual(["h-1"]);
  });

  it.each([null, { id: "viewer" }, { id: "another-viewer" }])(
    "gets individual count and membership in one statement for %j",
    async (viewer) => {
      mocks.getSession.mockResolvedValue(viewer);
      const response = await single();
      expect(await response.json()).toEqual({
        data: { count: 3, starred: viewer?.id === "viewer" },
      });
      expect(statements).toHaveLength(1);
      expect(response.headers.get("Cache-Control")).toBe("private, max-age=60");
    },
  );

  it("returns count zero and false membership when an individual has no stars", async () => {
    mocks.getSession.mockResolvedValue({ id: "viewer" });
    sqlite.exec("DELETE FROM stars");
    expect(await (await single()).json()).toEqual({ data: { count: 0, starred: false } });
    expect(statements).toHaveLength(1);
  });

  it("preserves toggle semantics and three statements per successful mutation", async () => {
    mocks.getSession.mockResolvedValue({ id: "viewer" });
    const toggle = () =>
      toggleSingle(
        new Request("https://example.test/api/hypotheses/h-1/star", { method: "POST" }),
        {
          params: Promise.resolve({ id: "h-1" }),
        },
      );
    expect(await (await toggle()).json()).toEqual({ data: { count: 2, starred: false } });
    expect(statements).toHaveLength(3);
    statements = [];
    expect(await (await toggle()).json()).toEqual({ data: { count: 3, starred: true } });
    expect(statements).toHaveLength(3);
  });
});
