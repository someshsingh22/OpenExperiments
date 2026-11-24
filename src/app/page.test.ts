import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import type { SQL } from "drizzle-orm";

const mocks = vi.hoisted(() => ({
  getDB: vi.fn(),
  cachedQuery: vi.fn(),
}));

vi.mock("@/db", () => ({ getDB: mocks.getDB }));
vi.mock("@/lib/edge-cache", () => ({ cachedQuery: mocks.cachedQuery }));
vi.mock("@/components/home-dynamic-sections", () => ({
  HomeDynamicSections: () => null,
}));

import HomePage from "./page";
import { HomeDynamicSections } from "@/components/home-dynamic-sections";
import { comments, datasetProblemStatements, hypotheses, problemStatements } from "@/db/schema";

const dialect = new SQLiteSyncDialect();

function createDatabase(emptyHypotheses = false, emptyProblems = false, proposalsOnly = false) {
  const queries: {
    table?: unknown;
    fields: Record<string, unknown>;
    limit?: number;
    params?: unknown[];
    started: boolean;
  }[] = [];
  const rows = {
    hypotheses: Array.from({ length: emptyHypotheses && !proposalsOnly ? 0 : 6 }, (_, i) => ({
      id: `h-${i}`,
      statement: `Statement ${i}`,
      source: "ai_agent",
      agentName: "Agent",
      domains: ["persuasion"],
      status: proposalsOnly ? "proposed" : "data_tested",
      phase: proposalsOnly ? "live" : "completed",
      submittedAt: 1700000000,
      winRate: proposalsOnly ? null : 75,
    })),
    problems: Array.from({ length: emptyProblems ? 0 : 7 }, (_, i) => ({
      id: `ps-${i}`,
      question: `Question ${i}`,
      description: `Description ${i}`,
      domain: "persuasion",
      hypothesisCount: 12,
    })),
  };
  const select = vi.fn((fields: Record<string, unknown>) => {
    const record: (typeof queries)[number] = { fields, started: false };
    queries.push(record);
    const query = {
      from: (table: unknown) => {
        record.table = table;
        return query;
      },
      where: (condition: SQL) => {
        record.params = dialect.sqlToQuery(condition).params;
        return query;
      },
      orderBy: () => query,
      innerJoin: () => query,
      groupBy: () => query,
      limit: (limit: number) => {
        record.limit = limit;
        return query;
      },
      then: (resolve: (data: unknown[]) => unknown) => {
        record.started = true;
        if (record.table === hypotheses) {
          const data = proposalsOnly && record.params?.[0] === "completed" ? [] : rows.hypotheses;
          return Promise.resolve(resolve(data));
        }
        if (record.table === problemStatements) {
          return Promise.resolve(resolve(rows.problems.slice(0, record.limit)));
        }
        expect(queries.slice(0, 2).every((q) => q.started)).toBe(true);
        if (record.table === comments) {
          return Promise.resolve(
            resolve((record.params ?? []).map((id) => ({ hypothesisId: id, count: 2 }))),
          );
        }
        return Promise.resolve(
          resolve(
            (record.params ?? []).map((id) => ({
              problemStatementId: id,
              name: `Dataset ${id}`,
            })),
          ),
        );
      },
    };
    return query;
  });
  mocks.getDB.mockReturnValue({ select });
  return { queries };
}

function dataProps(tree: React.ReactNode): React.ComponentProps<typeof HomeDynamicSections> {
  const children = (tree as React.ReactElement<{ children: React.ReactNode }>).props.children;
  const section = React.Children.toArray(children).find(
    (child) => React.isValidElement(child) && child.type === HomeDynamicSections,
  );
  if (!React.isValidElement<React.ComponentProps<typeof HomeDynamicSections>>(section)) {
    throw new Error("Missing homepage data section");
  }
  return section.props;
}

describe("homepage data integration", () => {
  beforeEach(() => {
    mocks.cachedQuery.mockImplementation(
      (_key: string, _ttl: number, loader: () => Promise<unknown>) => loader(),
    );
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  it("uses four projected queries and aggregates only featured/visible IDs", async () => {
    const { queries } = createDatabase();
    const props = dataProps(await HomePage());
    expect(queries).toHaveLength(4);
    expect(queries.map((q) => q.table)).toEqual([
      hypotheses,
      problemStatements,
      comments,
      datasetProblemStatements,
    ]);
    expect(queries[0].limit).toBe(6);
    expect(queries[1].limit).toBe(4);
    expect(queries[2].params).toEqual(["h-0", "h-1", "h-2"]);
    expect(queries[3].params).toEqual(["ps-0", "ps-1", "ps-2", "ps-3"]);
    expect(Object.keys(queries[0].fields)).toEqual([
      "id",
      "statement",
      "source",
      "agentName",
      "domains",
      "status",
      "phase",
      "submittedAt",
      "winRate",
    ]);
    expect(Object.keys(queries[3].fields)).toEqual(["problemStatementId", "name"]);
    expect(props.initialHypotheses).toHaveLength(3);
    expect(props.initialHypotheses[0]).toMatchObject({
      statement: "Statement 0",
      agentName: "Agent",
      source: "ai_agent",
      submittedAt: "2023-11-14",
      commentCount: 2,
    });
    expect(props.initialHypotheses[0]).not.toHaveProperty("rationale");
    expect(props.initialProblems).toHaveLength(4);
    expect(props.initialProblems[0].datasets).toEqual([{ name: "Dataset ps-0" }]);
    expect(mocks.cachedQuery).toHaveBeenCalledWith("home:data", 300, expect.any(Function));
  });

  it.each([
    [true, false, 4],
    [false, true, 3],
    [true, true, 3],
  ])("skips empty dependent reads (%s, %s)", async (emptyHyps, emptyPs, count) => {
    const { queries } = createDatabase(emptyHyps, emptyPs);
    await HomePage();
    expect(queries).toHaveLength(count);
  });

  it("features live proposals when there are no completed hypotheses without inventing evidence", async () => {
    const { queries } = createDatabase(true, false, true);
    const props = dataProps(await HomePage());
    expect(queries[0].params).toEqual(["completed"]);
    expect(queries[2].params).toEqual(["live"]);
    expect(props.initialHypotheses).toHaveLength(3);
    expect(props.initialHypotheses[0]).toMatchObject({
      status: "proposed",
      phase: "live",
      winRate: null,
    });
  });
});
