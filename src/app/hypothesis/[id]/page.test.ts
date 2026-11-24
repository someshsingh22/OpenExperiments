import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { hypotheses, experiments, experimentResults, comments } from "@/db/schema";
import type { Hypothesis, Experiment } from "@/lib/types";
import HypothesisDetailPage from "./page";

const mocks = vi.hoisted(() => ({ select: vi.fn(), row: vi.fn(), notFound: vi.fn() }));
vi.mock("@/db", () => ({ getDB: () => ({ select: mocks.select }) }));
vi.mock("@/lib/hypothesis-detail-row", () => ({ getHypothesisDetailRow: mocks.row }));
vi.mock("@/lib/edge-cache", () => ({
  cachedQuery: (_key: string, _ttl: number, load: () => Promise<unknown>) => load(),
}));
vi.mock("@/components/hypothesis-detail-content", () => ({
  HypothesisDetailContent: () => null,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

const row = {
  id: "h-1",
  statement: "Statement",
  rationale: "Rationale",
  source: "human",
  domains: ["psychology"],
  status: "proposed",
  phase: "live",
  submittedAt: 0,
  isAnonymous: 0,
  submittedBy: "author",
  citationDois: [],
  relatedHypothesisIds: [],
};

describe("hypothesis detail page D1 bounds", () => {
  beforeEach(() => {
    mocks.notFound.mockImplementation(() => {
      throw new Error("not found");
    });
    mocks.row.mockResolvedValue(row);
  });

  it("loads all related rows and experiment results using bounded IN queries", async () => {
    const ids = Array.from({ length: 205 }, (_, index) => `related-${index}`);
    const expRows = ids.map((id) => ({
      id: `experiment-${id}`,
      hypothesisId: row.id,
      type: "observational",
      status: "completed",
      datasetName: "Dataset",
      startedAt: 0,
    }));
    mocks.row.mockResolvedValue({ ...row, relatedHypothesisIds: [...ids, ids[0]] });
    const parameters = new Map<unknown, unknown[][]>();
    const dialect = new SQLiteSyncDialect();
    mocks.select.mockImplementation(() => ({
      from: (table: unknown) => ({
        where: (predicate: SQL) => {
          const params = dialect.sqlToQuery(predicate).params;
          const calls = parameters.get(table) ?? [];
          calls.push(params);
          parameters.set(table, calls);
          if (table === experiments) return Promise.resolve(expRows);
          if (table === comments) return Promise.resolve([]);
          if (table === hypotheses) {
            return Promise.resolve(params.map((id) => ({ ...row, id })));
          }
          if (table === experimentResults) {
            return Promise.resolve(
              params.map((id) => ({
                experimentId: id,
                summary: id,
                confidenceIntervalLow: 0,
                confidenceIntervalHigh: 1,
              })),
            );
          }
          throw new Error("unexpected table");
        },
      }),
    }));

    const element = await HypothesisDetailPage({ params: Promise.resolve({ id: row.id }) });
    const props = element.props as { related: Hypothesis[]; experiments: Experiment[] };
    expect(props.related.map((entry) => entry.id)).toEqual(ids);
    expect(props.experiments.map((entry) => entry.id)).toEqual(expRows.map((entry) => entry.id));
    for (const entry of props.experiments) {
      expect(entry.results?.summary).toBe(entry.id);
    }
    expect(parameters.get(hypotheses)?.map((params) => params.length)).toEqual([100, 100, 5]);
    expect(parameters.get(experimentResults)?.map((params) => params.length)).toEqual([
      100, 100, 5,
    ]);
    expect(mocks.select).toHaveBeenCalledTimes(8);
  });

  it("preserves the existence guard without starting dependent queries", async () => {
    mocks.row.mockResolvedValue(null);
    await expect(HypothesisDetailPage({ params: Promise.resolve({ id: row.id }) })).rejects.toThrow(
      "not found",
    );
    expect(mocks.select).not.toHaveBeenCalled();
  });
});
