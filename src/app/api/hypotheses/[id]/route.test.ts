import { beforeEach, describe, expect, it, vi } from "vitest";
import { hypotheses, experiments, experimentResults, comments } from "@/db/schema";
import { GET } from "./route";
import type { SQL } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";

const mocks = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("@/db", () => ({ getDB: () => ({ select: mocks.select }) }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const hypothesis = {
  id: "h-1",
  statement: "Statement",
  rationale: "Rationale",
  source: "human",
  agentName: null,
  domains: ["psychology"],
  problemStatement: "Problem",
  status: "proposed",
  phase: "live",
  submittedAt: 0,
  submittedBy: "author-1",
  isAnonymous: 1,
  arenaElo: 1500,
  winRate: null,
  evidenceScore: null,
  pValue: null,
  effectSize: null,
  citationDois: [],
  relatedHypothesisIds: [],
};
const experiment = {
  id: "e-1",
  hypothesisId: "h-1",
  type: "observational",
  status: "completed",
  datasetName: "Dataset",
  methodology: null,
  startedAt: 0,
  completedAt: null,
  osfLink: null,
};
const result = {
  experimentId: "e-1",
  pValue: 0.01,
  effectSize: 0.2,
  confidenceIntervalLow: 0.1,
  confidenceIntervalHigh: 0.3,
  sampleSize: 100,
  summary: "Summary",
  uplift: null,
};
const comment = {
  id: "c-1",
  hypothesisId: "h-1",
  body: "Comment",
  doi: null,
  createdAt: 0,
  parentId: null,
};

interface DetailResponse {
  data: { submittedBy: string | null; isAnonymous: boolean; commentCount: number };
  experiments: { id: string; completedAt?: string; results?: { summary: string | null } }[];
  comments: unknown[];
}

describe("hypothesis detail GET", () => {
  let rows: Map<unknown, Promise<unknown[]>>;
  let started: unknown[];
  let resultParameters: unknown[][];
  const dialect = new SQLiteSyncDialect();

  beforeEach(() => {
    rows = new Map<unknown, Promise<unknown[]>>([
      [hypotheses, Promise.resolve([hypothesis])],
      [experiments, Promise.resolve([])],
      [experimentResults, Promise.resolve([])],
      [comments, Promise.resolve([])],
    ]);
    started = [];
    resultParameters = [];
    mocks.select.mockImplementation(() => ({
      from: (table: unknown) => {
        started.push(table);
        return {
          where: (predicate: SQL) => {
            let response = rows.get(table) ?? Promise.resolve([]);
            if (table === experimentResults) {
              const parameters = dialect.sqlToQuery(predicate).params;
              resultParameters.push(parameters);
              response = response.then((values) =>
                values.filter((value) =>
                  parameters.includes((value as { experimentId: string }).experimentId),
                ),
              );
            }
            return { limit: () => response, then: response.then.bind(response) };
          },
        };
      },
    }));
  });

  const get = () =>
    GET(new Request("https://example.test/api/hypotheses/h-1"), {
      params: Promise.resolve({ id: "h-1" }),
    });

  it("keeps the missing-hypothesis guard to one SELECT", async () => {
    rows.set(hypotheses, Promise.resolve([]));
    const response = await get();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(started).toEqual([hypotheses]);
    expect(mocks.select).toHaveBeenCalledTimes(1);
  });

  it("starts independent reads together and results before comments finish, preserving JSON", async () => {
    const pendingHypothesis = deferred<unknown[]>();
    const pendingExperiments = deferred<unknown[]>();
    const pendingComments = deferred<unknown[]>();
    rows.set(hypotheses, pendingHypothesis.promise);
    rows.set(experiments, pendingExperiments.promise);
    rows.set(comments, pendingComments.promise);
    rows.set(experimentResults, Promise.resolve([result]));

    const responsePromise = get();
    await vi.waitFor(() => expect(started).toEqual([hypotheses]));
    pendingHypothesis.resolve([hypothesis]);
    await vi.waitFor(() => expect(started).toEqual([hypotheses, experiments, comments]));
    pendingExperiments.resolve([experiment]);
    await vi.waitFor(() =>
      expect(started).toEqual([hypotheses, experiments, comments, experimentResults]),
    );
    pendingComments.resolve([comment]);

    const response = await responsePromise;
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=120, s-maxage=600");
    expect(await response.json()).toEqual({
      data: {
        id: "h-1",
        statement: "Statement",
        rationale: "Rationale",
        source: "human",
        agentName: null,
        domain: ["psychology"],
        problemStatement: "Problem",
        status: "proposed",
        phase: "live",
        submittedAt: "1970-01-01",
        submittedBy: null,
        isAnonymous: true,
        arenaElo: 1500,
        winRate: null,
        evidenceScore: null,
        pValue: null,
        effectSize: null,
        commentCount: 1,
        citationDois: [],
        relatedHypothesisIds: [],
      },
      experiments: [
        {
          id: "e-1",
          hypothesisId: "h-1",
          type: "observational",
          status: "completed",
          datasetName: "Dataset",
          methodology: null,
          startedAt: "1970-01-01",
          osfLink: null,
          results: {
            pValue: 0.01,
            effectSize: 0.2,
            confidenceInterval: [0.1, 0.3],
            sampleSize: 100,
            summary: "Summary",
            uplift: null,
          },
        },
      ],
      comments: [
        {
          id: "c-1",
          hypothesisId: "h-1",
          body: "Comment",
          doi: null,
          createdAt: "1970-01-01",
          parentId: null,
        },
      ],
    });
    expect(mocks.select).toHaveBeenCalledTimes(4);
  });

  it("skips the results SELECT without experiments and preserves a nonanonymous author", async () => {
    rows.set(hypotheses, Promise.resolve([{ ...hypothesis, isAnonymous: 0 }]));
    const response = await get();
    const body = (await response.json()) as DetailResponse;
    expect(body.experiments).toEqual([]);
    expect(body.comments).toEqual([]);
    expect(body.data).toMatchObject({
      submittedBy: "author-1",
      isAnonymous: false,
      commentCount: 0,
    });
    expect(started).toEqual([hypotheses, experiments, comments]);
    expect(mocks.select).toHaveBeenCalledTimes(3);
  });

  it("omits missing results and includes completed dates without changing experiment order", async () => {
    rows.set(
      experiments,
      Promise.resolve([{ ...experiment, id: "e-2", completedAt: 86400 }, experiment]),
    );
    rows.set(experimentResults, Promise.resolve([result]));
    const response = await get();
    const body = (await response.json()) as DetailResponse;
    expect(body.experiments.map((entry) => entry.id)).toEqual(["e-2", "e-1"]);
    expect(body.experiments[0]).toMatchObject({ completedAt: "1970-01-02" });
    expect(body.experiments[0]).not.toHaveProperty("results");
    expect(body.experiments[1]).toHaveProperty("results.summary", "Summary");
    expect(mocks.select).toHaveBeenCalledTimes(4);
  });

  it("returns all experiments and results above D1's 100-parameter limit", async () => {
    const largeExperiments = Array.from({ length: 205 }, (_, index) => ({
      ...experiment,
      id: `e-${index}`,
    }));
    rows.set(experiments, Promise.resolve(largeExperiments));
    rows.set(
      experimentResults,
      Promise.resolve(
        largeExperiments.map((entry) => ({
          ...result,
          experimentId: entry.id,
          summary: entry.id,
        })),
      ),
    );
    const response = await get();
    const body = (await response.json()) as DetailResponse;
    expect(body.experiments.map((entry) => entry.id)).toEqual(
      largeExperiments.map((entry) => entry.id),
    );
    for (const entry of body.experiments) {
      expect(entry.results?.summary).toBe(entry.id);
    }
    expect(resultParameters.map((parameters) => parameters.length)).toEqual([100, 100, 5]);
    expect(resultParameters.flat()).toEqual(largeExperiments.map((entry) => entry.id));
    expect(mocks.select).toHaveBeenCalledTimes(6);
  });
});
