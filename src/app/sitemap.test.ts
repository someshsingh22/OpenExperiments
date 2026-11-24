import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDB: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  cachedQuery: vi.fn(),
}));

vi.mock("@/db", () => ({ getDB: mocks.getDB }));
vi.mock("@/lib/edge-cache", () => ({ cachedQuery: mocks.cachedQuery }));

import sitemap from "./sitemap";
import { SITE_CONFIG } from "@/lib/constants";
import { hypotheses } from "@/db/schema";

describe("sitemap", () => {
  beforeEach(() => {
    mocks.getDB.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ from: mocks.from });
    mocks.from.mockResolvedValue([{ id: "h-1", updatedAt: 1700000000 }]);
    mocks.cachedQuery.mockImplementation(
      (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher(),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("omits unknown static dates and retains real hypothesis dates across request times", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const first = await sitemap();
    vi.setSystemTime(new Date("2026-02-01T00:00:00Z"));
    const second = await sitemap();
    expect(second).toEqual(first);
    expect(first.slice(0, 7).map((page) => page.url)).toEqual(
      ["", "/explore", "/arena", "/submit", "/data", "/about", "/contribute"].map(
        (path) => `${SITE_CONFIG.url}${path}`,
      ),
    );
    for (const page of first.slice(0, 7)) expect(page).not.toHaveProperty("lastModified");
    expect(first[7]).toEqual({
      url: `${SITE_CONFIG.url}/hypothesis/h-1`,
      lastModified: new Date(1700000000 * 1000),
      changeFrequency: "weekly",
      priority: 0.8,
    });
    expect(mocks.cachedQuery).toHaveBeenCalledWith("sitemap:hyps", 3600, expect.any(Function));
    expect(mocks.select).toHaveBeenCalledWith({
      id: hypotheses.id,
      updatedAt: hypotheses.updatedAt,
    });
    expect(mocks.from).toHaveBeenCalledWith(hypotheses);
  });

  it("returns static pages and a redacted log when the query fails", async () => {
    mocks.from.mockRejectedValueOnce(new Error("private database details"));
    const pages = await sitemap();
    expect(pages).toHaveLength(7);
    expect(pages.every((page) => !("lastModified" in page))).toBe(true);
    expect(console.error).toHaveBeenCalledExactlyOnceWith(
      "[sitemap] Failed to load hypotheses; returning static pages only.",
    );
  });

  it("reuses cached rows without constructing a database query", async () => {
    mocks.cachedQuery.mockResolvedValueOnce([{ id: "cached-h", updatedAt: 1700000000 }]);
    const pages = await sitemap();
    expect(pages[7].url).toBe(`${SITE_CONFIG.url}/hypothesis/cached-h`);
    expect(mocks.getDB).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
  });
});
