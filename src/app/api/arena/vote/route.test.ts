import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDB: vi.fn(),
  getSession: vi.fn(),
  updateWinRatesForMatchup: vi.fn(),
  invalidateCached: vi.fn(),
}));
vi.mock("@/db", () => ({ getDB: mocks.getDB }));
vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/arena-stats", () => ({
  updateWinRatesForMatchup: mocks.updateWinRatesForMatchup,
}));
vi.mock("@/lib/edge-cache", () => ({ invalidateCached: mocks.invalidateCached }));

import { POST, runtime } from "./route";

const url = "https://openexperiments.example/api/arena/vote";
const origin = new URL(url).origin;
const validBody = JSON.stringify({ matchupId: "m-1", vote: "a" });
const matchup = {
  id: "m-1",
  hypothesisAId: "h-a",
  hypothesisBId: "h-b",
  totalVotes: 5,
  votesA: 2,
  votesB: 1,
  votesTie: 1,
};

function request(body = validBody, headers: Record<string, string> = {}) {
  const requestHeaders = new Headers({ "Content-Type": "application/json" });
  for (const [name, value] of Object.entries(headers)) {
    requestHeaders.set(name, value);
  }
  return new Request(url, {
    method: "POST",
    headers: requestHeaders,
    body,
  });
}

function mockDatabase(results: object[][] = [[], [matchup], [{ ...matchup, totalVotes: 6 }]]) {
  const limit = vi.fn(async () => {
    const rows = results.shift();
    if (!rows) throw new Error("Unexpected database read");
    return rows;
  });
  const selectWhere = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where: selectWhere }));
  const values = vi.fn(() => ({ operation: "insert" }));
  const updateWhere = vi.fn(() => ({ operation: "update" }));
  const set = vi.fn<(counters: object) => { where: typeof updateWhere }>(() => ({
    where: updateWhere,
  }));
  const db = {
    select: vi.fn(() => ({ from })),
    insert: vi.fn(() => ({ values })),
    update: vi.fn(() => ({ set })),
    batch: vi.fn(async () => []),
  };
  mocks.getDB.mockReturnValue(db);
  return { db, values, set };
}

function expectNoDatabaseWork(db: ReturnType<typeof mockDatabase>["db"]) {
  expect(mocks.getDB).not.toHaveBeenCalled();
  expect(mocks.getSession).not.toHaveBeenCalled();
  expect(db.select).not.toHaveBeenCalled();
  expect(db.insert).not.toHaveBeenCalled();
  expect(db.update).not.toHaveBeenCalled();
  expect(db.batch).not.toHaveBeenCalled();
  expect(mocks.updateWinRatesForMatchup).not.toHaveBeenCalled();
  expect(mocks.invalidateCached).not.toHaveBeenCalled();
}

describe("arena vote request policy", () => {
  beforeEach(() => {
    mocks.getDB.mockReset();
    mocks.getSession.mockReset().mockResolvedValue(null);
    mocks.updateWinRatesForMatchup.mockReset().mockResolvedValue(undefined);
    mocks.invalidateCached.mockReset().mockResolvedValue(undefined);
  });

  it.each([
    [
      "cross-origin anonymous text/plain",
      { "Content-Type": "text/plain", Origin: "https://evil.example" },
      415,
    ],
    ["cross-origin JSON", { Origin: "https://evil.example" }, 403],
    ["opaque origin", { Origin: "null" }, 403],
    ["cross-site fetch metadata without Origin", { "Sec-Fetch-Site": "cross-site" }, 403],
    [
      "cross-site metadata despite same Origin",
      { Origin: origin, "Sec-Fetch-Site": "Cross-Site" },
      403,
    ],
    ["different scheme", { Origin: origin.replace("https:", "http:") }, 403],
    ["different port", { Origin: `${origin}:8443` }, 403],
    [
      "forwarded origin spoof",
      {
        Origin: "https://evil.example",
        "X-Forwarded-Host": "evil.example",
        "X-Forwarded-Proto": "https",
        Host: "evil.example",
      },
      403,
    ],
    ["non-JSON media", { "Content-Type": "application/jsonp" }, 415],
    ["empty media", { "Content-Type": "" }, 415],
  ] as const)(
    "rejects %s before parsing, authentication or any DB access",
    async (_name, headers, status) => {
      const { db } = mockDatabase();
      const incoming = request(validBody, headers);
      const parse = vi.spyOn(incoming, "json");

      const response = await POST(incoming);

      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({
        error:
          status === 415
            ? "Content-Type must be application/json"
            : "Cross-site requests are not allowed",
      });
      expect(parse).not.toHaveBeenCalled();
      expectNoDatabaseWork(db);
    },
  );

  it("requires the media header even on an origin-absent client", async () => {
    const { db } = mockDatabase();
    const incoming = request();
    incoming.headers.delete("Content-Type");

    expect((await POST(incoming)).status).toBe(415);
    expectNoDatabaseWork(db);
  });

  it.each([
    ["{", "Invalid JSON body"],
    ["", "Invalid JSON body"],
    ["null", "Body must be a JSON object"],
    ['"string"', "Body must be a JSON object"],
    ["1", "Body must be a JSON object"],
    ["true", "Body must be a JSON object"],
    ["[]", "Body must be a JSON object"],
  ])("returns explicit 400 for body %s without auth/DB work", async (body, error) => {
    const { db } = mockDatabase();

    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error });
    expectNoDatabaseWork(db);
  });

  it.each([
    {},
    { matchupId: "m-1" },
    { matchupId: 1, vote: "a" },
    { matchupId: "m-1", vote: ["a"] },
    { matchupId: "", vote: "a" },
    { matchupId: "m-1", vote: "invalid" },
  ])("rejects invalid vote fields before auth/DB work: %j", async (body) => {
    const { db } = mockDatabase();

    expect((await POST(request(JSON.stringify(body)))).status).toBe(400);
    expectNoDatabaseWork(db);
  });

  it.each([
    ["same-origin browser", { Origin: origin, "Sec-Fetch-Site": "same-origin" }],
    ["origin-absent MCP/server", {}],
    [
      "header case and charset",
      {
        "CONTENT-TYPE": "Application/JSON; Charset=UTF-8",
        ORIGIN: origin,
        "SEC-FETCH-SITE": "SAME-ORIGIN",
      },
    ],
    [
      "origin-absent client with untrusted forwarded headers",
      { "X-Forwarded-Host": "evil.example", "X-Forwarded-Proto": "http" },
    ],
  ] as const)("preserves successful anonymous voting for %s", async (_name, headers) => {
    const { db, values } = mockDatabase();

    const response = await POST(request(validBody, headers));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: { id: "m-1", totalVotes: 6, votesA: 2, votesB: 1, votesTie: 1 },
    });
    expect(mocks.getSession).toHaveBeenCalledTimes(1);
    expect(db.select).toHaveBeenCalledTimes(3);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        matchupId: "m-1",
        userId: null,
        voterIpHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        vote: "a",
      }),
    );
    expect(db.batch).toHaveBeenCalledExactlyOnceWith([
      { operation: "insert" },
      { operation: "update" },
    ]);
    expect(mocks.updateWinRatesForMatchup).toHaveBeenCalledExactlyOnceWith(db, "m-1");
    expect(mocks.invalidateCached.mock.calls).toEqual([
      ["home:data"],
      ["explore:data"],
      ["hypothesis:h-a"],
      ["hypothesis:h-b"],
    ]);
    expect(runtime).toBe("edge");
  });

  it.each([
    ["a", "votesA"],
    ["b", "votesB"],
    ["tie", "votesTie"],
    ["both_weak", null],
  ])("preserves authenticated %s counter updates", async (vote, counter) => {
    mocks.getSession.mockResolvedValue({ id: "user-1" });
    const { db, values, set } = mockDatabase();

    expect((await POST(request(JSON.stringify({ matchupId: "m-1", vote })))).status).toBe(200);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        voterIpHash: null,
        vote,
      }),
    );
    expect(Object.keys(set.mock.calls[0][0]).sort()).toEqual(
      ["totalVotes", "updatedAt", ...(counter ? [counter] : [])].sort(),
    );
    expect(db.batch).toHaveBeenCalledTimes(1);
  });

  it("keeps duplicate-vote rejection ahead of matchup lookup", async () => {
    const { db } = mockDatabase([[{ id: "existing-vote" }]]);

    expect((await POST(request())).status).toBe(409);
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(db.batch).not.toHaveBeenCalled();
    expect(mocks.updateWinRatesForMatchup).not.toHaveBeenCalled();
  });

  it("keeps missing-matchup rejection before writes", async () => {
    const { db } = mockDatabase([[], []]);

    expect((await POST(request())).status).toBe(404);
    expect(db.select).toHaveBeenCalledTimes(2);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("keeps concurrent unique-conflict handling", async () => {
    const { db } = mockDatabase([[], [matchup]]);
    db.batch.mockRejectedValue(new Error("UNIQUE constraint failed"));

    expect((await POST(request())).status).toBe(409);
    expect(mocks.updateWinRatesForMatchup).not.toHaveBeenCalled();
    expect(mocks.invalidateCached).not.toHaveBeenCalled();
  });

  it("does not swallow unexpected database failures", async () => {
    const { db } = mockDatabase([[], [matchup]]);
    const error = new Error("D1 unavailable");
    db.batch.mockRejectedValue(error);

    await expect(POST(request())).rejects.toBe(error);
  });
});
