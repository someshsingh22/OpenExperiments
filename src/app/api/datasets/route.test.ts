import { getTableName, type Table } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { describe, expect, it, vi } from "vitest";
import DataPage from "@/app/data/page";
import { GET as getCollection } from "./route";
import { GET as getDetail } from "./[id]/route";
import type { Dataset } from "@/lib/types";

const mocks = vi.hoisted(() => ({ getDB: vi.fn() }));
vi.mock("@/db", () => ({ getDB: mocks.getDB }));
vi.mock("@/lib/edge-cache", () => ({
  cachedQuery: (_key: string, _ttl: number, load: () => Promise<unknown>) => load(),
  invalidateCached: vi.fn(),
}));
vi.mock("@/components/data-content", () => ({ DataContent: () => null }));

type Row = Record<string, unknown>;
type Result = Row[] | Promise<Row[]>;

function mockDB(results: Result[]) {
  const started: string[] = [];
  const queries: {
    table?: string;
    projection?: Record<string, unknown>;
    where: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
  }[] = [];
  const select = vi.fn((projection?: Record<string, unknown>) => {
    const result = results.shift();
    if (!result) throw new Error("Unexpected extra DB query");
    const query = {
      table: undefined as string | undefined,
      projection,
      where: vi.fn(),
      groupBy: vi.fn(),
    };
    queries.push(query);
    const chain = {
      from: vi.fn((table: Table) => {
        query.table = getTableName(table);
        return chain;
      }),
      where: query.where,
      groupBy: query.groupBy,
      innerJoin: vi.fn(),
      limit: vi.fn(),
      then: (resolve: (rows: Row[]) => unknown, reject: (reason: unknown) => unknown) => {
        started.push(query.table!);
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    chain.where.mockReturnValue(chain);
    chain.groupBy.mockReturnValue(chain);
    chain.innerJoin.mockReturnValue(chain);
    chain.limit.mockReturnValue(chain);
    return chain;
  });
  mocks.getDB.mockReturnValue({ select });
  return { select, queries, started };
}

function dataset(id: string, overrides: Row = {}): Row {
  return {
    id,
    name: `Dataset ${id}`,
    huggingfaceUrl: `https://huggingface.co/datasets/${id}`,
    taskDescription: "Legacy task",
    dataColumnNames: ["text"],
    targetColumnName: "score",
    description: null,
    domain: "persuasion",
    license: "CC0",
    foreknowledgeStatus: "data_unobserved",
    unitOfAnalysis: "A participant",
    createdAt: 0,
    ...overrides,
  };
}

function deferredRows() {
  let resolve!: (rows: Row[]) => void;
  const promise = new Promise<Row[]>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function initialDatasets(): Promise<Dataset[]> {
  const page = await DataPage();
  return page.props.initialDatasets as Dataset[];
}

const request = (path = "/api/datasets") => new Request(`https://example.com${path}`);
const detailParams = { params: Promise.resolve({ id: "a" }) };

describe("dataset collection and SSR reads", () => {
  it.each([1, 8, 101])("uses exactly three grouped queries for %i SSR datasets", async (size) => {
    const rows = Array.from({ length: size }, (_, index) => dataset(String(index)));
    const db = mockDB([rows, [{ datasetId: "0", count: 2 }], [{ datasetId: "0", count: 3 }]]);
    const data = await initialDatasets();
    expect(db.select).toHaveBeenCalledTimes(3);
    expect(db.queries.slice(1).every((query) => query.groupBy.mock.calls.length === 1)).toBe(true);
    expect(data.find((row) => row.id === "0")).toMatchObject({
      problemStatementCount: 2,
      experimentCount: 3,
      unitOfAnalysis: "A participant",
      license: "CC0",
      foreknowledgeStatus: "data_unobserved",
    });
    expect(
      data.filter((row) => row.id !== "0").every((row) => row.problemStatementCount === 0),
    ).toBe(true);
    if (size > 1) expect(data.at(-1)?.id).toBe("0");
  });

  it("skips aggregate queries for an empty SSR collection", async () => {
    const db = mockDB([[]]);
    expect(await initialDatasets()).toEqual([]);
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it("skips aggregate queries for an empty API collection", async () => {
    const db = mockDB([[]]);
    const response = await getCollection(request());
    expect(await response.json()).toEqual({ data: [] });
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=600, s-maxage=1800");
  });

  it("preserves API fields, exact counts, ordering, and SSR summary/metadata parity", async () => {
    const rows = [
      dataset("a"),
      dataset("b", {
        taskDescription: null,
        dataColumnNames: null,
        targetColumnName: null,
        domain: null,
        license: null,
        unitOfAnalysis: null,
        foreknowledgeStatus: null,
      }),
    ];
    const results = () => [
      rows,
      [{ datasetId: "a", count: 2 }],
      [
        { datasetId: "a", count: 3 },
        { datasetId: null, count: 10 },
      ],
    ];
    const db = mockDB(results());
    const response = await getCollection(request());
    const { data } = (await response.json()) as { data: Row[] };
    expect(db.select).toHaveBeenCalledTimes(3);
    expect(data).toEqual([
      { ...rows[1], createdAt: "1970-01-01", problemStatementCount: 0, experimentCount: 0 },
      { ...rows[0], createdAt: "1970-01-01", problemStatementCount: 2, experimentCount: 3 },
    ]);
    expect(db.queries[0].projection).not.toHaveProperty("osfCharacterization");
    expect(db.queries[0].projection).not.toHaveProperty("submittedBy");
    mockDB(results());
    const initial = await initialDatasets();
    expect(JSON.parse(JSON.stringify(initial))).toEqual(
      data.map((row: Row) =>
        Object.fromEntries(
          Object.entries(row).filter(
            ([key, value]) =>
              value !== null ||
              ![
                "description",
                "domain",
                "license",
                "foreknowledgeStatus",
                "unitOfAnalysis",
              ].includes(key),
          ),
        ),
      ),
    );
  });

  it.each(["all", "persuasion"])("preserves the %s domain predicate", async (domain) => {
    const db = mockDB([[]]);
    await getCollection(request(`/api/datasets?domain=${domain}`));
    if (domain === "all") {
      expect(db.queries[0].where).not.toHaveBeenCalled();
    } else {
      const predicate = db.queries[0].where.mock.calls[0][0];
      expect(new SQLiteSyncDialect().sqlToQuery(predicate).params).toEqual(["persuasion"]);
    }
  });

  it.each(["SSR", "API"])("starts both %s aggregates before either completes", async (source) => {
    const ps = deferredRows();
    const exp = deferredRows();
    const db = mockDB([[dataset("a")], ps.promise, exp.promise]);
    const pending = source === "SSR" ? initialDatasets() : getCollection(request());
    await vi.waitFor(() => expect(db.started).toHaveLength(3));
    ps.resolve([{ datasetId: "a", count: 2 }]);
    exp.resolve([{ datasetId: "a", count: 3 }]);
    await pending;
  });
});

describe("dataset detail GET", () => {
  it("keeps the missing-dataset fast path at one query", async () => {
    const db = mockDB([[]]);
    const response = await getDetail(request("/api/datasets/missing"), {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Dataset not found" });
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it("preserves the full OSF detail and linked response with explicit projections", async () => {
    const row = dataset("a", { osfCharacterization: { provenance: "Source", tags: ["research"] } });
    const ps = [{ id: "ps", question: "Why?", domain: "persuasion", hypothesisCount: 4 }];
    const exp = [
      {
        id: "exp",
        hypothesisId: "h",
        type: "survey",
        status: "planned",
        methodology: null,
        startedAt: 0,
      },
    ];
    const db = mockDB([[row], ps, exp]);
    const response = await getDetail(request("/api/datasets/a"), detailParams);
    expect(await response.json()).toEqual({
      data: { ...row, createdAt: "1970-01-01" },
      problemStatements: ps,
      experiments: [{ ...exp[0], startedAt: "1970-01-01" }],
    });
    expect(db.select).toHaveBeenCalledTimes(3);
    expect(Object.keys(db.queries[2].projection!)).toEqual([
      "id",
      "hypothesisId",
      "type",
      "status",
      "methodology",
      "startedAt",
    ]);
    expect(db.queries[0].projection).toHaveProperty("osfCharacterization");
    expect(db.queries[0].projection).not.toHaveProperty("submittedBy");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=600, s-maxage=1800");
  });

  it("starts both linked reads together and preserves empty sections", async () => {
    const ps = deferredRows();
    const exp = deferredRows();
    const db = mockDB([[dataset("a")], ps.promise, exp.promise]);
    const pending = getDetail(request("/api/datasets/a"), detailParams);
    await vi.waitFor(() => expect(db.started).toHaveLength(3));
    ps.resolve([]);
    exp.resolve([]);
    expect(await (await pending).json()).toMatchObject({ problemStatements: [], experiments: [] });
  });
});
