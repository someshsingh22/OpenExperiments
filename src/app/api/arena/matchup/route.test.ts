import { drizzle } from "drizzle-orm/sqlite-proxy";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDB: vi.fn() }));
vi.mock("@/db", () => ({ getDB: mocks.getDB }));

import { GET, runtime } from "./route";

type Row = (string | number | null)[];

function mockDatabase(results: Row[][]) {
  const query = vi.fn<(sql: string, params: unknown[]) => Promise<{ rows: Row[] }>>(async () => {
    const rows = results.shift();
    if (!rows) throw new Error("Unexpected database statement");
    return { rows };
  });
  mocks.getDB.mockReturnValue(drizzle(query));
  return query;
}

const hypothesis = {
  id: "h-a",
  statement: "Hypothesis A",
  domain: ["persuasion"],
  arenaElo: null,
  source: "human",
  agentName: null,
};
const hypothesisRow: Row = [
  hypothesis.id,
  hypothesis.statement,
  JSON.stringify(hypothesis.domain),
  hypothesis.arenaElo,
  hypothesis.source,
  hypothesis.agentName,
];
const missingHypothesis: Row = [null, null, null, null, null, null];
const counters = { id: "m-1", totalVotes: 8, votesA: 3, votesB: 2, votesTie: 1 };
const matchupRow: Row = Object.values(counters);

describe("arena matchup GET", () => {
  beforeEach(() => {
    mocks.getDB.mockReset();
  });

  it("returns 404 after only the count when there are no matchups", async () => {
    const query = mockDatabase([[[0]]]);

    const response = await GET();

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "No matchups available" });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("count(*)");
    expect(runtime).toBe("edge");
  });

  it("returns 404 if the selected matchup disappears", async () => {
    const query = mockDatabase([[[1]], []]);

    const response = await GET();

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "No matchups available" });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it.each([
    [0, 0],
    [0.49, 1],
    [0.999, 3],
  ])("retains random OFFSET sampling for random=%s", async (random, offset) => {
    vi.spyOn(Math, "random").mockReturnValue(random);
    const query = mockDatabase([[[4]], [[...matchupRow, ...hypothesisRow, ...hypothesisRow]]]);

    const response = await GET();

    expect(await response.json()).toEqual({
      data: { ...counters, hypothesisA: hypothesis, hypothesisB: hypothesis },
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(query).toHaveBeenCalledTimes(2);
    const [sql, params] = query.mock.calls[1];
    expect(params).toEqual(offset === 0 ? [1] : [1, offset]);
    expect(sql).toMatch(/from \(select .* from "arena_matchups" limit \?( offset \?)?\)/);
    expect(sql).toContain('"selected_matchup" left join "hypotheses" "hypothesis_a"');
    expect(sql).toContain('left join "hypotheses" "hypothesis_b"');
    expect(sql).not.toMatch(/select \*/);
    expect(sql).not.toContain('"rationale"');
  });

  it.each([
    [true, false],
    [false, true],
    [true, true],
  ])("preserves missing-hypothesis nulls (A=%s, B=%s)", async (missingA, missingB) => {
    const query = mockDatabase([
      [[1]],
      [
        [
          ...matchupRow,
          ...(missingA ? missingHypothesis : hypothesisRow),
          ...(missingB ? missingHypothesis : hypothesisRow),
        ],
      ],
    ]);

    const response = await GET();

    expect(await response.json()).toEqual({
      data: {
        ...counters,
        hypothesisA: missingA ? null : hypothesis,
        hypothesisB: missingB ? null : hypothesis,
      },
    });
    expect(query).toHaveBeenCalledTimes(2);
  });
});
