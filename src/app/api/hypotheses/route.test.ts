import { createRequire } from "node:module";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { getDB } from "@/db";
import * as schema from "@/db/schema";
import { cachedQuery, invalidateHypothesisCaches } from "@/lib/edge-cache";
import ExplorePage from "@/app/explore/page";
import { GET, POST } from "./route";

vi.mock("@/db", () => ({ getDB: vi.fn() }));
vi.mock("@/lib/edge-cache", () => ({
  invalidateHypothesisCaches: vi.fn(async () => {}),
  cachedQuery: vi.fn((_key: string, _ttl: number, loader: () => Promise<unknown>) => loader()),
}));
vi.mock("@/components/explore-content", () => ({ ExploreContent: () => null }));
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(async () => ({ id: "author" })),
  requireSession: vi.fn(() => null),
}));

type SQLiteValue = string | number | bigint | null | Uint8Array;
interface SQLiteConnection {
  exec(sql: string): void;
  close(): void;
  prepare(sql: string): {
    all(...params: SQLiteValue[]): Record<string, SQLiteValue>[];
    run(...params: SQLiteValue[]): unknown;
  };
}

// Node's built-in SQLite keeps these D1 SQL tests entirely in memory.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => SQLiteConnection;
};

interface ListResponse {
  data: { id: string; commentCount: number; experimentCount: number; submittedBy: string | null }[];
  total: number;
}

let sqlite: SQLiteConnection;
let db: ReturnType<typeof getDB>;
let queries: { sql: string; params: SQLiteValue[] }[];

class PreparedStatement {
  constructor(
    private readonly sql: string,
    private readonly params: SQLiteValue[] = [],
  ) {}

  bind(...params: SQLiteValue[]) {
    return new PreparedStatement(this.sql, params);
  }

  execute() {
    queries.push({ sql: this.sql, params: this.params });
    return { results: sqlite.prepare(this.sql).all(...this.params), success: true };
  }

  async raw() {
    return this.execute().results.map((row) => Object.values(row));
  }
}

const batch = vi.fn(async (statements: PreparedStatement[]) =>
  statements.map((statement) => statement.execute()),
);

function seedHypothesis(
  id: string,
  overrides: Partial<typeof schema.hypotheses.$inferInsert> = {},
) {
  const query = db
    .insert(schema.hypotheses)
    .values({
      id,
      statement: "A needle hypothesis",
      rationale: "Reason",
      source: "human",
      domains: ["persuasion"],
      problemStatement: "Target question",
      status: "proposed",
      phase: "live",
      submittedAt: 1_000,
      citationDois: [],
      relatedHypothesisIds: [],
      createdAt: 1_000,
      updatedAt: 1_000,
      ...overrides,
    })
    .toSQL();
  sqlite.prepare(query.sql).run(...(query.params as SQLiteValue[]));
}

async function list(query = "") {
  const response = await GET(new Request(`https://example.test/api/hypotheses${query}`));
  expect(response.status).toBe(200);
  return (await response.json()) as ListResponse;
}

beforeEach(() => {
  vi.stubGlobal("React", React);
  sqlite = new DatabaseSync(":memory:");
  queries = [];
  for (const table of [
    schema.hypotheses,
    schema.problemStatements,
    schema.comments,
    schema.experiments,
  ]) {
    const config = getTableConfig(table);
    sqlite.exec(
      `CREATE TABLE "${config.name}" (${config.columns
        .map((column) => `"${column.name}" ${column.getSQLType()}`)
        .join(", ")})`,
    );
  }
  const client = {
    prepare: (sql: string) => new PreparedStatement(sql),
    batch,
  };
  db = drizzle(client as unknown as D1Database, { schema });
  vi.mocked(getDB).mockReturnValue(db);
  sqlite.exec(`
    INSERT INTO problem_statements (id, question) VALUES ('ps-target', 'Target question');
    INSERT INTO problem_statements (id, question) VALUES ('ps-other', 'Other question');
  `);
  for (let i = 0; i < 60; i++) {
    seedHypothesis(`other-${String(i).padStart(2, "0")}`, {
      problemStatement: "Other question",
      submittedAt: 2_000,
      domains: ["memorability"],
      statement: "Unrelated",
    });
  }
  for (let i = 0; i < 55; i++) {
    seedHypothesis(`target-${String(i).padStart(2, "0")}`);
  }
});

afterEach(() => {
  sqlite.close();
  vi.unstubAllGlobals();
});

describe("Explore server pagination data", () => {
  it("supplies the exact initial total with five statements in two batches", async () => {
    const element = await ExplorePage({ searchParams: Promise.resolve({}) });
    expect(element.props).toMatchObject({
      initialTotal: 115,
      initialHypotheses: expect.arrayContaining([expect.objectContaining({ id: "other-59" })]),
    });

    expect(element.props.initialHypotheses).toHaveLength(50);
    expect(batch.mock.calls.map(([statements]) => statements.length)).toEqual([3, 2]);
    expect(queries).toHaveLength(5);
  });

  it("applies the deep-linked problem statement before the SSR limit", async () => {
    const element = await ExplorePage({
      searchParams: Promise.resolve({ ps: "ps-target" }),
    });
    expect(element.props).toMatchObject({
      initialPsId: "ps-target",
      initialTotal: 55,
      initialHypotheses: expect.arrayContaining([expect.objectContaining({ id: "target-54" })]),
    });
    expect(element.props.initialHypotheses).toHaveLength(50);
    expect(cachedQuery).not.toHaveBeenCalled();
    expect(queries).toHaveLength(5);
  });

  it("refreshes pre-pagination cache entries rather than hiding further pages", async () => {
    vi.mocked(cachedQuery).mockResolvedValueOnce({ hypotheses: [], problemStatements: [] });
    const element = await ExplorePage({ searchParams: Promise.resolve({}) });
    expect(element.props.initialTotal).toBe(115);
    expect(element.props.initialHypotheses).toHaveLength(50);
  });
});

it("invalidates home, explore and sitemap listings after creating a hypothesis", async () => {
  const response = await POST(
    new Request("https://example.test/api/hypotheses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        statement: "A newly submitted test hypothesis",
        rationale: "A sufficiently detailed test rationale",
        problemStatement: "Target question",
        domains: ["persuasion"],
        source: "human",
      }),
    }),
  );
  expect(response.status).toBe(201);
  expect(vi.mocked(invalidateHypothesisCaches).mock.calls).toEqual([[]]);
  const body = (await response.json()) as { data: { id: string } };
  expect(sqlite.prepare("SELECT id FROM hypotheses WHERE id = ?").all(body.data.id)).toEqual([
    { id: body.data.id },
  ]);
});

describe("hypotheses collection pagination", () => {
  it.each([
    "limit=-1",
    "limit=0",
    "limit=101",
    "limit=Infinity",
    "limit=NaN",
    "limit=1.5",
    "limit=50junk",
    "limit=",
    "limit=9007199254740992",
    "offset=-1",
    "offset=Infinity",
    "offset=NaN",
    "offset=0.5",
    "offset=10junk",
    "offset=",
    "offset=9007199254740992",
  ])("rejects %s before accessing the database", async (query) => {
    const response = await GET(new Request(`https://example.test/api/hypotheses?${query}`));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid pagination parameters",
      errors: [
        {
          field: query.split("=")[0],
          message: query.startsWith("limit")
            ? "limit must be an integer between 1 and 100."
            : "offset must be a nonnegative safe integer.",
        },
      ],
    });
    expect(getDB).not.toHaveBeenCalled();
    expect(batch).not.toHaveBeenCalled();
    expect(queries).toHaveLength(0);
  });

  it("reports both invalid fields", async () => {
    const response = await GET(
      new Request("https://example.test/api/hypotheses?limit=-1&offset=-1"),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { errors: { field: string }[] };
    expect(body.errors.map((error) => error.field)).toEqual(["limit", "offset"]);
    expect(getDB).not.toHaveBeenCalled();
  });

  it("defaults to 50 rows and uses four statements in two batches", async () => {
    const body = await list();
    expect(body.data).toHaveLength(50);
    expect(body.total).toBe(115);
    expect(batch.mock.calls.map(([statements]) => statements.length)).toEqual([2, 2]);
    expect(queries).toHaveLength(4);
    expect(body.data[0].id).toBe("other-59");
    expect(body.data.at(-1)?.id).toBe("other-10");
  });

  it("accepts the maximum limit and zero offset without silently capping", async () => {
    const body = await list("?limit=100&offset=0");
    expect(body.data).toHaveLength(100);
    expect(body.total).toBe(115);
  });

  it("filters by problem-statement ID before pagination and counts all matches", async () => {
    const first = await list("?problemStatementId=ps-target");
    const second = await list("?problemStatementId=ps-target&offset=50");
    expect(first.total).toBe(55);
    expect(second.total).toBe(55);
    expect(first.data).toHaveLength(50);
    expect(second.data).toHaveLength(5);
    expect(first.data[0].id).toBe("target-54");
    expect(second.data.map((row) => row.id)).toEqual([
      "target-04",
      "target-03",
      "target-02",
      "target-01",
      "target-00",
    ]);
    expect(new Set([...first.data, ...second.data].map((row) => row.id)).size).toBe(55);
    expect(queries[0].sql).toContain('select "question" from "problem_statements"');
    expect(queries[0].params).toContain("ps-target");
  });

  it.each(["?problemStatementId=unknown", "?offset=115"])(
    "uses only the first batch when %s returns no rows",
    async (query) => {
      const body = await list(query);
      expect(body.data).toEqual([]);
      expect(body.total).toBe(query.includes("unknown") ? 0 : 115);
      expect(batch).toHaveBeenCalledTimes(1);
      expect(queries).toHaveLength(2);
    },
  );

  it("combines exact PS, phase, status, JSON domain and substring filters", async () => {
    seedHypothesis("special-match", {
      statement: "No match in statement",
      rationale: "A preNEEDLEpost explanation",
      phase: "completed",
      status: "field_validated",
    });
    seedHypothesis("wrong-domain", {
      rationale: "needle",
      phase: "completed",
      status: "field_validated",
      domains: ["other-persuasion"],
    });
    const body = await list(
      "?problemStatementId=ps-target&domain=persuasion&phase=completed&status=field_validated&search=needle&limit=1",
    );
    expect(body.total).toBe(1);
    expect(body.data.map((row) => row.id)).toEqual(["special-match"]);
  });

  it("keeps LIKE wildcard and problem-statement substring semantics", async () => {
    const body = await list("?search=Tar%question&domain=persuasion");
    expect(body.total).toBe(55);
  });

  it("returns live grouped counts and hides anonymous authors", async () => {
    seedHypothesis("counted", {
      submittedAt: 3_000,
      commentCount: 99,
      isAnonymous: 1,
      submittedBy: "hidden-author",
    });
    sqlite.exec(`
      INSERT INTO comments (id, hypothesis_id) VALUES ('c1', 'counted'), ('c2', 'counted');
      INSERT INTO experiments (id, hypothesis_id) VALUES ('e1', 'counted');
    `);
    const body = await list("?limit=1");
    expect(body.data[0]).toMatchObject({
      id: "counted",
      commentCount: 2,
      experimentCount: 1,
      submittedBy: null,
    });
    expect(queries).toHaveLength(4);
  });

  it("sorts top-rated by live win rate with stable ID ties and NULLs last", async () => {
    seedHypothesis("rated-a", { winRate: 80, arenaElo: 1_000 });
    seedHypothesis("rated-b", { winRate: 80, arenaElo: 500 });
    seedHypothesis("rated-c", { winRate: 20, arenaElo: 5_000 });
    const body = await list("?sort=top_rated&limit=4");
    expect(body.data.slice(0, 3).map((row) => row.id)).toEqual(["rated-b", "rated-a", "rated-c"]);
    expect(body.data[3].id).toBe("target-54");
  });

  it("sorts most-discussed by live counts rather than denormalized counters", async () => {
    seedHypothesis("discussed-a", { commentCount: 0 });
    seedHypothesis("discussed-b", { commentCount: 0 });
    seedHypothesis("stale-counter", { commentCount: 999 });
    sqlite.exec(`
      INSERT INTO comments (id, hypothesis_id)
      VALUES ('a1', 'discussed-a'), ('a2', 'discussed-a'),
             ('b1', 'discussed-b'), ('b2', 'discussed-b');
    `);
    const body = await list("?sort=most_discussed&limit=2");
    expect(body.data.map((row) => [row.id, row.commentCount])).toEqual([
      ["discussed-b", 2],
      ["discussed-a", 2],
    ]);
    expect(queries).toHaveLength(4);
  });
});
