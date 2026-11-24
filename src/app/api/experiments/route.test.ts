import type { D1Database } from "@cloudflare/workers-types";
import { getTableColumns, type Table } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { experiments, experimentResults, experimentVersions } from "@/db/schema";
import { GET as getCollection, POST } from "./route";
import { GET as getDetail, PATCH } from "./[id]/route";

const mocks = vi.hoisted(() => ({
  getDB: vi.fn(),
  getSession: vi.fn(),
  invalidateExperimentCaches: vi.fn(),
}));
vi.mock("@/db", () => ({ getDB: mocks.getDB }));
vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/edge-cache", () => ({
  invalidateExperimentCaches: mocks.invalidateExperimentCaches,
}));

type Row = Record<string, unknown>;
type Statement = { sql: string; params: unknown[] };

function mockDB(singleResults: Row[][], batchResults: Row[][][]) {
  const statements: Statement[] = [];
  const raw = vi.fn((statement: Statement) => {
    if (!statement.sql.startsWith("select ")) throw new Error("Write outside db.batch");
    const rows = singleResults.shift();
    if (!rows) throw new Error("Unexpected standalone query");
    return Promise.resolve(rows.map((row) => Object.values(row)));
  });
  const batch = vi.fn((queries: Statement[]) => {
    const rows = batchResults.shift();
    if (!rows || rows.length !== queries.length) throw new Error("Unexpected batch shape");
    return Promise.resolve(rows.map((results) => ({ success: true, results })));
  });
  const binding = {
    prepare: vi.fn((sql: string) => {
      const statement = {
        sql,
        params: [] as unknown[],
        bind: (...params: unknown[]) => {
          statement.params = params;
          return statement;
        },
        raw: () => raw(statement),
        run: () => {
          throw new Error("Write outside db.batch");
        },
      };
      statements.push(statement);
      return statement;
    }),
    batch,
  };
  mocks.getDB.mockReturnValue(drizzle(binding as unknown as D1Database));
  return { raw, batch, statements };
}

function databaseRow(table: Table, row: Row): Row {
  return Object.fromEntries(
    Object.entries(getTableColumns(table)).map(([key, column]) => [column.name, row[key]]),
  );
}

function experiment(overrides: Row = {}): Row {
  return {
    id: "exp",
    hypothesisId: "hyp",
    problemStatementId: null,
    type: "observational",
    status: "planned",
    datasetId: null,
    datasetName: "Example",
    methodology: "Original method",
    analysisPlan: "Original analysis",
    startedAt: 100,
    completedAt: null,
    osfLink: null,
    submittedBy: "author",
    version: 1,
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}

function result(overrides: Row = {}): Row {
  return {
    experimentId: "exp",
    pValue: 0.05,
    effectSize: 0.7,
    confidenceIntervalLow: 0.2,
    confidenceIntervalHigh: 0.9,
    sampleSize: 20,
    summary: "Existing summary",
    uplift: "+5%",
    createdAt: 100,
    ...overrides,
  };
}

function version(overrides: Row = {}): Row {
  return {
    id: "v1",
    experimentId: "exp",
    version: 1,
    status: "planned",
    methodology: "Original method",
    analysisPlan: "Original analysis",
    osfLink: null,
    pValue: 0.05,
    effectSize: 0.7,
    sampleSize: 20,
    confidenceIntervalLow: 0.2,
    confidenceIntervalHigh: 0.9,
    summary: "Historical summary",
    changeSummary: "Initial submission",
    createdAt: 100,
    ...overrides,
  };
}

function history(row = version()): Row {
  return Object.fromEntries(
    [
      "version",
      "status",
      "methodology",
      "analysisPlan",
      "osfLink",
      "changeSummary",
      "createdAt",
    ].map((key) => [key, row[key]]),
  );
}

const params = { params: Promise.resolve({ id: "exp" }) };
const request = (path = "/api/experiments") => new Request(`https://example.com${path}`);
const patch = (body: Row) =>
  PATCH(
    new Request("https://example.com/api/experiments/exp", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
    params,
  );

function projectedValues(statement: Statement): Row {
  const select = statement.sql.split(" select ")[1]?.split(" from ")[0];
  if (!select) throw new Error("Expected insert-select");
  const aliases = [...select.matchAll(/\? as "([^"]+)"/g)].map((match) => match[1]);
  return Object.fromEntries(aliases.map((key, i) => [key, statement.params[i]]));
}

beforeEach(() => {
  mocks.getDB.mockReset();
  mocks.getSession.mockReset().mockResolvedValue({ id: "author" });
  mocks.invalidateExperimentCaches.mockReset().mockResolvedValue(undefined);
});

describe("experiment collection", () => {
  it.each([
    "limit=-1",
    "limit=0",
    "limit=1.5",
    "limit=Infinity",
    "limit=NaN",
    "limit=",
    "offset=-1",
    "offset=1.5",
    "offset=Infinity",
    "offset=",
    "limit=9007199254740992",
  ])("rejects %s before creating a DB client", async (query) => {
    expect((await getCollection(request(`/api/experiments?${query}`))).status).toBe(400);
    expect(mocks.getDB).not.toHaveBeenCalled();
  });

  it("validates pagination even for legacy filtered requests", async () => {
    expect(
      (await getCollection(request("/api/experiments?hypothesisId=hyp&limit=-1"))).status,
    ).toBe(400);
    expect(mocks.getDB).not.toHaveBeenCalled();
  });

  it("does not issue enrichment queries for an empty page", async () => {
    const db = mockDB([[]], []);
    const response = await getCollection(request());
    expect(await response.json()).toEqual({ data: [] });
    expect(db.raw).toHaveBeenCalledTimes(1);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("batches results and deduplicated submitters and preserves response fields", async () => {
    const db = mockDB(
      [[databaseRow(experiments, experiment())]],
      [
        [
          [databaseRow(experimentResults, result())],
          [{ id: "author", name: "Author", avatarUrl: null }],
        ],
      ],
    );
    const response = await getCollection(request());
    expect(await response.json()).toMatchObject({
      data: [
        {
          id: "exp",
          submitter: { id: "author", name: "Author", avatarUrl: null },
          results: { pValue: 0.05, confidenceInterval: [0.2, 0.9], uplift: "+5%" },
        },
      ],
    });
    expect(db.raw).toHaveBeenCalledTimes(1);
    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(db.batch.mock.calls[0][0]).toHaveLength(2);
  });

  it("omits the submitter query when all submitters are null", async () => {
    const db = mockDB([[databaseRow(experiments, experiment({ submittedBy: null }))]], [[[]]]);
    expect(await (await getCollection(request())).json()).toMatchObject({
      data: [{ submitter: null }],
    });
    expect(db.batch.mock.calls[0][0]).toHaveLength(1);
  });

  it("preserves unpaginated legacy filtering and chunks enrichment bindings", async () => {
    const rows = Array.from({ length: 101 }, (_, i) =>
      databaseRow(experiments, experiment({ id: `exp-${i}`, submittedBy: `author-${i}` })),
    );
    const db = mockDB([rows], [[[], [], [], []]]);
    const response = await getCollection(request("/api/experiments?hypothesisId=hyp"));
    const body = (await response.json()) as { data: Row[] };
    expect(body.data).toHaveLength(101);
    expect(db.raw.mock.calls[0][0].sql).not.toContain(" limit ");
    expect(db.batch.mock.calls[0][0]).toHaveLength(4);
    expect(db.batch.mock.calls[0][0].every((statement) => statement.params.length <= 100)).toBe(
      true,
    );
  });

  it("opts filtered requests into capped pagination when explicitly requested", async () => {
    const db = mockDB([[]], []);
    await getCollection(request("/api/experiments?hypothesisId=hyp&limit=200&offset=3"));
    expect(db.raw.mock.calls[0][0].sql).toContain(" limit ? offset ?");
    expect(db.raw.mock.calls[0][0].params).toEqual(["hyp", 100, 3]);
  });

  it("allows offset-only opt-in and retains the default page size", async () => {
    const db = mockDB([[]], []);
    await getCollection(request("/api/experiments?hypothesisId=hyp&offset=0"));
    expect(db.raw.mock.calls[0][0].params).toEqual(["hyp", 100]);
    expect(db.raw.mock.calls[0][0].sql).toContain(" limit ?");
  });

  it("retains POST's atomic experiment/results/initial snapshot batch", async () => {
    const db = mockDB([], [[[], [], []]]);
    const response = await POST(
      new Request("https://example.com/api/experiments", {
        method: "POST",
        body: JSON.stringify({
          hypothesisId: "hyp",
          type: "observational",
          datasetName: "Example",
          results: { pValue: 0, summary: "Initial result" },
        }),
      }),
    );
    expect(response.status).toBe(201);
    expect(db.raw).not.toHaveBeenCalled();
    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(db.batch.mock.calls[0][0]).toHaveLength(3);
    expect(mocks.invalidateExperimentCaches).toHaveBeenCalledExactlyOnceWith("hyp");
  });
});

describe("experiment detail", () => {
  it("batches dependencies and projects ordered history without dropping response fields", async () => {
    const db = mockDB(
      [[databaseRow(experiments, experiment())]],
      [
        [
          [history()],
          [{ id: "hyp", statement: "Hypothesis", status: "proposed", phase: null, domains: "[]" }],
          [databaseRow(experimentResults, result())],
          [{ id: "author", name: "Author", avatarUrl: null }],
        ],
      ],
    );
    const response = await getDetail(request("/api/experiments/exp"), params);
    expect(await response.json()).toMatchObject({
      data: { results: { summary: "Existing summary", uplift: "+5%" } },
      versions: [
        { methodology: "Original method", analysisPlan: "Original analysis", osfLink: null },
      ],
    });
    expect(db.raw).toHaveBeenCalledTimes(1);
    expect(db.batch).toHaveBeenCalledTimes(1);
    const historyQuery = db.batch.mock.calls[0][0][0].sql;
    expect(historyQuery).toContain('order by "experiment_versions"."version" asc');
    expect(historyQuery).not.toContain('"summary"');
    expect(historyQuery).not.toContain('"p_value"');
  });

  it("does not read current results when selecting a historical version", async () => {
    const db = mockDB(
      [[databaseRow(experiments, experiment({ version: 2 }))]],
      [[[history()], [], [databaseRow(experimentVersions, version())], []]],
    );
    expect(
      await (await getDetail(request("/api/experiments/exp?version=1"), params)).json(),
    ).toMatchObject({
      data: { version: 1, totalVersions: 2, results: { summary: "Historical summary" } },
    });
    expect(
      db.batch.mock.calls[0][0].some((statement) => statement.sql.includes("experiment_results")),
    ).toBe(false);
    expect(db.batch.mock.calls[0][0][2].params).toEqual(["exp", 1, 1]);
  });

  it("preserves synthetic v1 and null submitters without a results read", async () => {
    const db = mockDB(
      [[databaseRow(experiments, experiment({ submittedBy: null }))]],
      [[[], [], []]],
    );
    const body = (await (
      await getDetail(request("/api/experiments/exp?version=1"), params)
    ).json()) as Row;
    expect(body.data).toMatchObject({
      version: 1,
      methodology: "Original method",
      submitter: null,
    });
    expect(body.data).not.toHaveProperty("results");
    expect(body.versions).toEqual([
      {
        version: 1,
        status: "planned",
        methodology: "Original method",
        analysisPlan: "Original analysis",
        osfLink: null,
        changeSummary: "Initial submission",
        createdAt: new Date(100_000).toISOString(),
      },
    ]);
    expect(db.batch.mock.calls[0][0]).toHaveLength(3);
  });

  it("returns 404 for a missing historical version", async () => {
    mockDB([[databaseRow(experiments, experiment())]], [[[history()], [], [], []]]);
    expect((await getDetail(request("/api/experiments/exp?version=9"), params)).status).toBe(404);
  });

  it("returns 404 for a missing experiment without batching dependencies", async () => {
    const db = mockDB([[]], []);
    expect((await getDetail(request("/api/experiments/missing"), params)).status).toBe(404);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("does not query a nonnumeric requested version", async () => {
    const db = mockDB([[databaseRow(experiments, experiment())]], []);
    expect((await getDetail(request("/api/experiments/exp?version=invalid"), params)).status).toBe(
      404,
    );
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("keeps the existing omission of zero-valued historical results", async () => {
    const zeroVersion = version({
      pValue: 0,
      effectSize: 0,
      sampleSize: 0,
      confidenceIntervalLow: 0,
      confidenceIntervalHigh: 0,
      summary: "",
    });
    mockDB(
      [[databaseRow(experiments, experiment())]],
      [[[history(zeroVersion)], [], [databaseRow(experimentVersions, zeroVersion)], []]],
    );
    const body = (await (
      await getDetail(request("/api/experiments/exp?version=1"), params)
    ).json()) as { data: Row };
    expect(body.data).not.toHaveProperty("results");
  });
});

describe("experiment PATCH", () => {
  it("reads results once and atomically merges zero/null/omitted fields into the snapshot", async () => {
    const db = mockDB(
      [[databaseRow(experiments, experiment({ status: "completed", completedAt: 150 }))]],
      [
        [[databaseRow(experimentResults, result())], [{ id: "v1" }]],
        [[], [{ id: "exp" }], []],
      ],
    );
    const response = await patch({
      methodology: null,
      status: "planned",
      results: { pValue: 0, effectSize: null, summary: null },
    });
    expect(await response.json()).toEqual({ data: { id: "exp", version: 2 } });
    expect(db.raw).toHaveBeenCalledTimes(1);
    expect(db.batch).toHaveBeenCalledTimes(2);
    expect(db.batch.mock.calls[0][0]).toHaveLength(2);
    const writes = db.batch.mock.calls[1][0];
    expect(writes).toHaveLength(3);
    expect(projectedValues(writes[0])).toMatchObject({
      version: 2,
      methodology: null,
      pValue: 0,
      effectSize: 0.7,
      sampleSize: 20,
      confidenceIntervalLow: 0.2,
      summary: "Existing summary",
    });
    expect(writes[1].params).toContain(150);
    expect(writes[2].params.slice(0, 6)).toEqual([0, 0.7, 0.2, 0.9, 20, "Existing summary"]);
    expect(writes[2].sql).not.toContain('"uplift" =');
    expect(writes[2].sql).not.toContain('"created_at" =');
    expect(mocks.invalidateExperimentCaches).toHaveBeenCalledExactlyOnceWith("hyp");
  });

  it("backfills legacy state and inserts new results in the same guarded transaction", async () => {
    const db = mockDB(
      [[databaseRow(experiments, experiment())]],
      [
        [[], []],
        [[], [{ id: "exp" }], [], []],
      ],
    );
    expect((await patch({ results: { sampleSize: 0 } })).status).toBe(200);
    const writes = db.batch.mock.calls[1][0];
    expect(writes).toHaveLength(4);
    expect(projectedValues(writes[0])).toMatchObject({ version: 2, sampleSize: 0, summary: "" });
    expect(projectedValues(writes[2])).toMatchObject({
      version: 1,
      status: "planned",
      pValue: null,
      sampleSize: null,
      summary: null,
      changeSummary: "Initial submission",
      createdAt: 100,
    });
    expect(projectedValues(writes[3])).toMatchObject({
      experimentId: "exp",
      pValue: 0,
      effectSize: 0,
      sampleSize: 0,
      summary: "",
      uplift: null,
    });
    const markerId = projectedValues(writes[0]).id;
    expect(writes[0].sql).toContain('"experiments"."version" = ?');
    expect(writes[0].params.slice(-2)).toEqual(["exp", 1]);
    for (const statement of writes.slice(1)) {
      expect(statement.sql).toContain("exists (select");
      expect(statement.params).toContain(markerId);
    }
  });

  it("reuses the existing result for completed validation and backfill", async () => {
    const db = mockDB(
      [[databaseRow(experiments, experiment())]],
      [
        [[databaseRow(experimentResults, result())], []],
        [[], [{ id: "exp" }], []],
      ],
    );
    expect((await patch({ status: "completed" })).status).toBe(200);
    const writes = db.batch.mock.calls[1][0];
    expect(projectedValues(writes[0])).toMatchObject({ summary: "Existing summary" });
    expect(projectedValues(writes[2])).toMatchObject({ summary: "Existing summary", version: 1 });
    expect(db.raw).toHaveBeenCalledTimes(1);
  });

  it("leaves results unchanged for confidence-interval-only input as before", async () => {
    const db = mockDB(
      [[databaseRow(experiments, experiment())]],
      [
        [[databaseRow(experimentResults, result())], [{ id: "v1" }]],
        [[], [{ id: "exp" }]],
      ],
    );
    await patch({ results: { confidenceIntervalLow: 0 } });
    expect(db.batch.mock.calls[1][0]).toHaveLength(2);
    expect(projectedValues(db.batch.mock.calls[1][0][0])).toMatchObject({
      confidenceIntervalLow: 0.2,
    });
  });

  it("retains null snapshot results when no results row exists and no results are supplied", async () => {
    const db = mockDB(
      [[databaseRow(experiments, experiment({ version: 3 }))]],
      [
        [[], [{ id: "v1" }]],
        [[], [{ id: "exp" }]],
      ],
    );
    expect(await (await patch({ osfLink: null })).json()).toEqual({
      data: { id: "exp", version: 4 },
    });
    expect(db.batch.mock.calls[1][0]).toHaveLength(2);
    expect(projectedValues(db.batch.mock.calls[1][0][0])).toMatchObject({
      version: 4,
      osfLink: null,
      pValue: null,
      effectSize: null,
      sampleSize: null,
      summary: null,
    });
  });

  it("preserves the completed validation and explicit empty-summary merge behavior", async () => {
    const db = mockDB(
      [[databaseRow(experiments, experiment({ status: "completed" }))]],
      [
        [[databaseRow(experimentResults, result())], [{ id: "v1" }]],
        [[], [{ id: "exp" }], []],
      ],
    );
    expect((await patch({ results: { pValue: 0, summary: "" } })).status).toBe(200);
    expect(projectedValues(db.batch.mock.calls[1][0][0])).toMatchObject({
      pValue: 0,
      summary: "",
    });
  });

  it("does not issue writes when completed summary validation fails", async () => {
    const db = mockDB([[databaseRow(experiments, experiment())]], [[[], [{ id: "v1" }]]]);
    expect((await patch({ status: "completed" })).status).toBe(400);
    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(
      db.batch.mock.calls[0][0].every((statement) => statement.sql.startsWith("select ")),
    ).toBe(true);
    expect(mocks.invalidateExperimentCaches).not.toHaveBeenCalled();
  });

  it("reports a stale version when the guarded update affects no rows", async () => {
    const db = mockDB(
      [[databaseRow(experiments, experiment())]],
      [
        [[], [{ id: "v1" }]],
        [[], []],
      ],
    );
    expect((await patch({ changeSummary: "Stale edit" })).status).toBe(409);
    const writes = db.batch.mock.calls[1][0];
    expect(writes[1].sql).toContain('"experiments"."version" = ?');
    expect(writes[1].sql).toContain('returning "id"');
    expect(mocks.invalidateExperimentCaches).not.toHaveBeenCalled();
  });

  it("propagates a transactional failure without retrying writes outside the batch", async () => {
    const db = mockDB([[databaseRow(experiments, experiment())]], [[[], []]]);
    db.batch
      .mockImplementationOnce((queries) => {
        expect(queries).toHaveLength(2);
        return Promise.resolve([
          { success: true, results: [] },
          { success: true, results: [] },
        ]);
      })
      .mockRejectedValueOnce(new Error("Injected snapshot/result failure"));
    await expect(patch({ results: { sampleSize: 0 } })).rejects.toThrow(
      "Injected snapshot/result failure",
    );
    expect(db.batch).toHaveBeenCalledTimes(2);
    expect(db.batch.mock.calls[1][0]).toHaveLength(4);
    expect(db.raw).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateExperimentCaches).not.toHaveBeenCalled();
  });
});
