import { drizzle } from "drizzle-orm/sqlite-proxy";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDB: vi.fn(), getAllWinRates: vi.fn() }));
vi.mock("@/db", () => ({ getDB: mocks.getDB }));
vi.mock("@/lib/arena-stats", () => ({ getAllWinRates: mocks.getAllWinRates }));

import { GET, runtime } from "./route";

type Row = (string | number | null)[];
const cacheControl = "public, max-age=120, s-maxage=300";

function mockDatabase(results: Row[][]) {
  const query = vi.fn(async () => {
    const rows = results.shift();
    if (!rows) throw new Error("Unexpected database statement");
    return { rows };
  });
  mocks.getDB.mockReturnValue(drizzle(query));
  return query;
}

describe("arena rankings GET", () => {
  beforeEach(() => {
    mocks.getDB.mockReset();
    mocks.getAllWinRates.mockReset();
  });

  it("returns empty rankings without invoking shared aggregation", async () => {
    const query = mockDatabase([[], []]);

    const response = await GET();

    expect(await response.json()).toEqual({ data: [] });
    expect(response.headers.get("Cache-Control")).toBe(cacheControl);
    expect(query).toHaveBeenCalledTimes(2);
    expect(mocks.getAllWinRates).not.toHaveBeenCalled();
    expect(runtime).toBe("edge");
  });

  it("keeps the denormalized fast path to one statement", async () => {
    const query = mockDatabase([[["h-a", "Statement", '["persuasion"]', 75]]]);

    const response = await GET();

    expect(await response.json()).toEqual({
      data: [{ id: "h-a", statement: "Statement", domain: ["persuasion"], winRate: 75 }],
    });
    expect(response.headers.get("Cache-Control")).toBe(cacheControl);
    expect(query).toHaveBeenCalledTimes(1);
    expect(mocks.getAllWinRates).not.toHaveBeenCalled();
  });

  it("keeps fallback ranking, zero defaults and Elo-ordered ties", async () => {
    const query = mockDatabase([
      [],
      [
        ["h-a", "A", "[]"],
        ["h-b", "B", "[]"],
        ["h-c", "C", "[]"],
        ["h-d", "D", "[]"],
      ],
    ]);
    mocks.getAllWinRates.mockResolvedValue(
      new Map([
        ["h-a", 50],
        ["h-b", 75],
        ["h-c", 50],
      ]),
    );

    const response = await GET();

    expect(await response.json()).toEqual({
      data: [
        { id: "h-b", statement: "B", domain: [], winRate: 75 },
        { id: "h-a", statement: "A", domain: [], winRate: 50 },
        { id: "h-c", statement: "C", domain: [], winRate: 50 },
        { id: "h-d", statement: "D", domain: [], winRate: 0 },
      ],
    });
    expect(response.headers.get("Cache-Control")).toBe(cacheControl);
    expect(query).toHaveBeenCalledTimes(2);
    expect(mocks.getAllWinRates).toHaveBeenCalledTimes(1);
    expect(mocks.getAllWinRates).toHaveBeenCalledWith(mocks.getDB.mock.results[0].value);
  });
});
