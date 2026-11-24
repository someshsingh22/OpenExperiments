import { drizzle } from "drizzle-orm/sqlite-proxy";
import { describe, expect, it, vi } from "vitest";
import { arenaMatchups, hypotheses } from "@/db/schema";
import { getAllWinRates, getSourceWinRates } from "./arena-stats";

type Matchup = Pick<
  typeof arenaMatchups.$inferSelect,
  "hypothesisAId" | "hypothesisBId" | "votesA" | "votesB" | "votesTie" | "totalVotes"
>;
type Source = Pick<typeof hypotheses.$inferSelect, "id" | "source" | "agentName">;
type DB = Parameters<typeof getAllWinRates>[0];

function matchup(
  hypothesisAId: string,
  hypothesisBId: string,
  votesA: number,
  votesB: number,
  votesTie = 0,
  totalVotes = votesA + votesB + votesTie,
): Matchup {
  return { hypothesisAId, hypothesisBId, votesA, votesB, votesTie, totalVotes };
}

function mockDatabase(matchups: Matchup[], sources: Source[] = []) {
  const query = vi.fn(async (sql: string) => {
    const joined = sql.includes("inner join");
    return {
      rows: matchups.flatMap((m) => {
        const values = [m.hypothesisAId, m.hypothesisBId, m.votesA, m.votesB, m.votesTie];
        if (!joined) return [values];
        const a = sources.find((source) => source.id === m.hypothesisAId);
        const b = sources.find((source) => source.id === m.hypothesisBId);
        if (!a || !b) return [];
        return [[...values, a.source, a.agentName, b.source, b.agentName]];
      }),
    };
  });
  return { db: drizzle(query) as unknown as DB, query };
}

function expectProjectedRead(query: ReturnType<typeof mockDatabase>["query"], joined: boolean) {
  expect(query).toHaveBeenCalledTimes(1);
  const sql = query.mock.calls[0][0];
  expect(sql).not.toContain("total_votes");
  expect(sql).not.toContain("created_at");
  expect(sql).not.toContain("updated_at");
  expect(sql).not.toContain("*");
  expect(sql.match(/inner join/g) ?? []).toHaveLength(joined ? 2 : 0);
  if (joined) {
    expect(sql).toContain(
      'inner join "hypotheses" "hypothesis_a" on "arena_matchups"."hypothesis_a_id" = "hypothesis_a"."id"',
    );
    expect(sql).toContain(
      'inner join "hypotheses" "hypothesis_b" on "arena_matchups"."hypothesis_b_id" = "hypothesis_b"."id"',
    );
    expect(sql).not.toMatch(/\bin\s*\(/i);
    expect(sql).toContain('"hypothesis_a"."source"');
    expect(sql).toContain('"hypothesis_b"."source"');
    expect(sql).toContain('"hypothesis_a"."agent_name"');
    expect(sql).toContain('"hypothesis_b"."agent_name"');
  }
}

describe("getAllWinRates", () => {
  it("uses one projected read for empty input", async () => {
    const { db, query } = mockDatabase([]);
    expect(await getAllWinRates(db)).toEqual(new Map());
    expectProjectedRead(query, false);
  });

  it("weights ties, rounds once and excludes both-weak votes from the denominator", async () => {
    const { db, query } = mockDatabase([
      matchup("a", "b", 3, 1, 2, 100),
      matchup("b", "zero-only", 0, 0, 0, 40),
      matchup("a", "missing-source", 1, 0),
    ]);
    expect(await getAllWinRates(db)).toEqual(
      new Map([
        ["a", 71],
        ["b", 33],
        ["missing-source", 0],
      ]),
    );
    expectProjectedRead(query, false);
  });

  it("counts both sides of a self-match", async () => {
    const { db, query } = mockDatabase([matchup("self", "self", 3, 1, 2, 20)]);
    expect(await getAllWinRates(db)).toEqual(new Map([["self", 50]]));
    expectProjectedRead(query, false);
  });
});

describe("getSourceWinRates", () => {
  it("uses one joined read for empty input", async () => {
    const { db, query } = mockDatabase([]);
    expect(await getSourceWinRates(db)).toEqual([]);
    expectProjectedRead(query, true);
  });

  it("preserves ties, rounding, descending rates and meaningful-vote denominators", async () => {
    const { db, query } = mockDatabase(
      [matchup("human", "agent", 3, 1, 2, 100)],
      [
        { id: "human", source: "human", agentName: "ignored" },
        { id: "agent", source: "ai_agent", agentName: "Model" },
      ],
    );
    expect(await getSourceWinRates(db)).toEqual([
      { source: "Human", sourceType: "human", winRate: 67, hypothesisCount: 1, matchups: 1 },
      { source: "Model", sourceType: "ai_agent", winRate: 33, hypothesisCount: 1, matchups: 1 },
    ]);
    expectProjectedRead(query, true);
  });

  it("omits zero-meaningful-vote and missing-source matchups on either side", async () => {
    const { db, query } = mockDatabase(
      [
        matchup("human", "agent", 0, 0, 0, 30),
        matchup("human", "missing", 4, 0),
        matchup("missing", "agent", 0, 4),
      ],
      [
        { id: "human", source: "human", agentName: null },
        { id: "agent", source: "ai_agent", agentName: "Model" },
      ],
    );
    expect(await getSourceWinRates(db)).toEqual([]);
    expectProjectedRead(query, true);
  });

  it("combines shared labels and counts same-source matches twice with distinct hypotheses", async () => {
    const { db, query } = mockDatabase(
      [
        matchup("human-1", "agent-1", 3, 1, 2),
        matchup("human-2", "agent-2", 0, 2),
        matchup("human-1", "human-2", 1, 3),
      ],
      [
        { id: "human-1", source: "human", agentName: null },
        { id: "human-2", source: "human", agentName: null },
        { id: "agent-1", source: "ai_agent", agentName: "Model" },
        { id: "agent-2", source: "ai_agent", agentName: "Model" },
      ],
    );
    expect(await getSourceWinRates(db)).toEqual([
      { source: "Human", sourceType: "human", winRate: 50, hypothesisCount: 2, matchups: 4 },
      { source: "Model", sourceType: "ai_agent", winRate: 50, hypothesisCount: 2, matchups: 2 },
    ]);
    expectProjectedRead(query, true);
  });

  it("uses the same fallback label for null and empty agent names", async () => {
    const { db, query } = mockDatabase(
      [matchup("a", "b", 3, 1)],
      [
        { id: "a", source: "ai_agent", agentName: null },
        { id: "b", source: "ai_agent", agentName: "" },
      ],
    );
    expect(await getSourceWinRates(db)).toEqual([
      { source: "AI Agent", sourceType: "ai_agent", winRate: 50, hypothesisCount: 2, matchups: 2 },
    ]);
    expectProjectedRead(query, true);
  });

  it("retains label-only grouping even when a label spans source types", async () => {
    const { db, query } = mockDatabase(
      [matchup("human", "agent", 3, 1)],
      [
        { id: "human", source: "human", agentName: null },
        { id: "agent", source: "ai_agent", agentName: "Human" },
      ],
    );
    expect(await getSourceWinRates(db)).toEqual([
      { source: "Human", sourceType: "human", winRate: 50, hypothesisCount: 2, matchups: 2 },
    ]);
    expectProjectedRead(query, true);
  });

  it("counts self-match participation twice but its hypothesis only once", async () => {
    const { db, query } = mockDatabase(
      [matchup("self", "self", 3, 1, 2)],
      [{ id: "self", source: "ai_agent", agentName: "Model" }],
    );
    expect(await getSourceWinRates(db)).toEqual([
      { source: "Model", sourceType: "ai_agent", winRate: 50, hypothesisCount: 1, matchups: 2 },
    ]);
    expectProjectedRead(query, true);
  });
});
