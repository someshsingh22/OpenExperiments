import { createRequire } from "node:module";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH } from "./route";

interface FixtureDatabase {
  exec(query: string): void;
  close(): void;
  prepare(query: string): {
    run(...params: unknown[]): unknown;
    all(...params: unknown[]): Record<string, unknown>[];
    get(...params: unknown[]): Record<string, unknown> | undefined;
  };
}

// Runtime Node supports SQLite; the project's Node 20 types predate its declarations.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => FixtureDatabase;
};

const mocks = vi.hoisted(() => ({
  db: null as unknown,
  viewer: null as { id: string; name: string } | null,
}));
vi.mock("@/db", () => ({ getDB: () => mocks.db }));
vi.mock("@/lib/auth", () => ({
  getSession: async () => mocks.viewer,
  requireSession: (viewer: unknown) =>
    viewer ? undefined : Response.json({ error: "Unauthorized" }, { status: 401 }),
}));

interface ProfileResponse {
  data: {
    user: { id: string; name: string; email: string | null; joinedAt: string };
    hypotheses: { id: string; isAnonymous: boolean }[];
    starredHypotheses: { id: string; statement: string }[];
    stats: {
      hypothesisCount: number;
      experimentCount: number;
      commentCount: number;
      voteCount: number;
    };
    isOwner: boolean;
  };
}

describe("profile queries against SQLite", () => {
  let sqlite: FixtureDatabase;
  let statements: string[];
  let pauseFirstCollection: Promise<void> | undefined;

  beforeEach(() => {
    mocks.viewer = null;
    statements = [];
    pauseFirstCollection = undefined;
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY, name TEXT, email TEXT, avatar_url TEXT, affiliation TEXT,
        position TEXT, scholar_url TEXT, website TEXT, bio TEXT, orcid TEXT,
        twitter_handle TEXT, created_at INTEGER, updated_at INTEGER
      );
      CREATE TABLE hypotheses (
        id TEXT PRIMARY KEY, statement TEXT, status TEXT, phase TEXT, domains TEXT,
        is_anonymous INTEGER NOT NULL, submitted_at INTEGER, created_at INTEGER,
        submitted_by TEXT
      );
      CREATE TABLE stars (user_id TEXT, hypothesis_id TEXT, PRIMARY KEY(user_id, hypothesis_id));
      CREATE TABLE comments (user_id TEXT);
      CREATE TABLE experiments (submitted_by TEXT);
      CREATE TABLE arena_votes (user_id TEXT);
      INSERT INTO users VALUES (
        'author', 'Ada', 'ada@stanford.edu', NULL, 'Stored affiliation',
        'Scientist', NULL, NULL, 'Bio', NULL, NULL, 0, 0
      );
      INSERT INTO comments VALUES ('author'), ('author'), ('other');
      INSERT INTO experiments VALUES ('author'), ('other');
      INSERT INTO arena_votes VALUES ('author'), ('author'), ('author'), ('other');
    `);
    mocks.db = drizzle(async (query, params, method) => {
      statements.push(query);
      if (statements.length === 2 && pauseFirstCollection) await pauseFirstCollection;
      const prepared = sqlite.prepare(query);
      if (method === "run") {
        prepared.run(...params);
        return { rows: [] };
      }
      const rows = prepared.all(...params).map((row) => Object.values(row));
      return { rows };
    });
  });

  afterEach(() => sqlite.close());

  function hypothesis(id: string, anonymous = 0, createdAt = 0, author = "author") {
    sqlite
      .prepare("INSERT INTO hypotheses VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(
        id,
        `Statement ${id}`,
        "proposed",
        "live",
        '["psychology"]',
        anonymous,
        0,
        createdAt,
        author,
      );
  }

  const get = (id = "author") =>
    GET(new Request(`https://example.test/api/users/${id}`), {
      params: Promise.resolve({ id }),
    });
  const patch = (body: Record<string, unknown>, id = "author") =>
    PATCH(
      new Request(`https://example.test/api/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id }) },
    );

  it("returns a missing profile with only one SELECT", async () => {
    const response = await get("missing");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "User not found" });
    expect(statements).toHaveLength(1);
  });

  it.each([null, { id: "other", name: "Other" }])(
    "filters anonymous rows before LIMIT and excludes them from totals for viewer %j",
    async (viewer) => {
      mocks.viewer = viewer;
      for (let i = 0; i < 55; i++) hypothesis(`public-${i}`, 0, i);
      for (let i = 0; i < 60; i++) hypothesis(`private-${i}`, 1, 100 + i);
      hypothesis("unrelated", 0, 1000, "other");
      const response = await get();
      const body = (await response.json()) as ProfileResponse;
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(body.data.user.email).toBeNull();
      expect(body.data.isOwner).toBe(false);
      expect(body.data.hypotheses).toHaveLength(50);
      expect(body.data.hypotheses.every((row) => !row.isAnonymous)).toBe(true);
      expect(body.data.hypotheses[0].id).toBe("public-54");
      expect(body.data.hypotheses.at(-1)?.id).toBe("public-5");
      expect(body.data.stats).toEqual({
        hypothesisCount: 55,
        experimentCount: 1,
        commentCount: 2,
        voteCount: 3,
      });
      expect(statements).toHaveLength(4);
      expect(statements[1]).toMatch(/is_anonymous.*<>.*limit/i);
      expect(statements[2]).toMatch(/count\(\*\).*is_anonymous/i);
    },
  );

  it("lets the owner see anonymous rows and full totals beyond the list limit", async () => {
    mocks.viewer = { id: "author", name: "Ada" };
    for (let i = 0; i < 55; i++) hypothesis(`public-${i}`, 0, i);
    for (let i = 0; i < 60; i++) hypothesis(`private-${i}`, 1, 100 + i);
    const response = await get();
    const body = (await response.json()) as ProfileResponse;
    expect(body.data.user.email).toBe("ada@stanford.edu");
    expect(body.data.isOwner).toBe(true);
    expect(body.data.hypotheses).toHaveLength(50);
    expect(body.data.hypotheses.every((row) => row.isAnonymous)).toBe(true);
    expect(body.data.stats.hypothesisCount).toBe(115);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(statements).toHaveLength(4);
  });

  it("does not change any public response when hidden contributions are added", async () => {
    hypothesis("public");
    const before = await (await get()).json();
    for (let i = 0; i < 70; i++) hypothesis(`hidden-${i}`, 1, 100 + i);
    expect(await (await get()).json()).toEqual(before);
    expect(statements).toHaveLength(8);
  });

  it("preserves the response shape and starred access with one projected join", async () => {
    hypothesis("public", 0, 0);
    hypothesis("starred-anonymous", 1, 1, "other");
    sqlite.exec(`
      INSERT INTO stars VALUES ('author', 'public'), ('author', 'starred-anonymous'),
        ('author', 'missing'), ('other', 'public');
    `);
    const response = await get();
    expect(await response.json()).toEqual({
      data: {
        user: {
          id: "author",
          name: "Ada",
          email: null,
          avatarUrl: null,
          affiliation: "Stanford",
          position: "Scientist",
          scholarUrl: null,
          website: null,
          bio: "Bio",
          orcid: null,
          twitterHandle: null,
          joinedAt: "1970-01-01",
        },
        hypotheses: [
          {
            id: "public",
            statement: "Statement public",
            status: "proposed",
            phase: "live",
            domain: ["psychology"],
            isAnonymous: false,
            submittedAt: "1970-01-01",
          },
        ],
        starredHypotheses: ["starred-anonymous", "public"].map((id) => ({
          id,
          statement: `Statement ${id}`,
          status: "proposed",
          phase: "live",
          domain: ["psychology"],
          submittedAt: "1970-01-01",
        })),
        stats: { hypothesisCount: 1, experimentCount: 1, commentCount: 2, voteCount: 3 },
        isOwner: false,
      },
    });
    expect(statements).toHaveLength(4);
    expect(statements[3]).toMatch(/inner join/i);
    expect(statements[3]).not.toMatch(/select \*| limit | in \(/i);
  });

  it("retains every star without an IN parameter list or silent cap", async () => {
    for (let i = 0; i < 1200; i++) {
      hypothesis(`star-${i}`, i % 2, i, "other");
      sqlite.prepare("INSERT INTO stars VALUES ('author', ?)").run(`star-${i}`);
    }
    const body = (await (await get()).json()) as ProfileResponse;
    expect(body.data.starredHypotheses).toHaveLength(1200);
    expect(body.data.starredHypotheses[0].id).toBe("star-1199");
    expect(body.data.stats.hypothesisCount).toBe(0);
    expect(statements).toHaveLength(4);
  });

  it("starts all independent collection and aggregate reads before the first resolves", async () => {
    let release!: () => void;
    pauseFirstCollection = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = get();
    await vi.waitFor(() => expect(statements).toHaveLength(4));
    release();
    expect((await pending).status).toBe(200);
  });

  it("updates once and returns only canonical editable fields, preserving stored read-only fields", async () => {
    mocks.viewer = { id: "author", name: "Ada" };
    const response = await patch({
      name: "  Grace  ",
      position: "  Researcher  ",
      bio: "  New bio  ",
      scholarUrl: "",
      website: "https://example.test",
      orcid: "",
      twitterHandle: "",
      email: "changed@example.test",
      affiliation: "Changed",
      avatarUrl: "changed",
      id: "other",
    });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      ok: true,
      data: {
        name: "Grace",
        position: "Researcher",
        scholarUrl: null,
        website: "https://example.test",
        bio: "New bio",
        orcid: null,
        twitterHandle: null,
      },
    });
    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatch(/^update .* returning /i);
    expect(
      sqlite.prepare("SELECT id, email, affiliation, avatar_url, created_at FROM users").get(),
    ).toEqual({
      id: "author",
      email: "ada@stanford.edu",
      affiliation: "Stored affiliation",
      avatar_url: null,
      created_at: 0,
    });
  });

  it("does not update for a non-owner or an invalid profile", async () => {
    mocks.viewer = { id: "other", name: "Other" };
    expect((await patch({ name: "Grace" })).status).toBe(403);
    mocks.viewer = { id: "author", name: "Ada" };
    expect((await patch({ name: "x" })).status).toBe(400);
    expect(statements).toHaveLength(0);
  });

  it("does not report a successful save when the owner row no longer exists", async () => {
    mocks.viewer = { id: "author", name: "Ada" };
    sqlite.exec("DELETE FROM users");
    const response = await patch({ name: "Grace" });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "User not found" });
    expect(statements).toHaveLength(1);
  });
});
