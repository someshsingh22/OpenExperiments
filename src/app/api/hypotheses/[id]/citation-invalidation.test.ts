import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  validateCitation: vi.fn(),
  update: vi.fn(),
  invalidateHypothesisCaches: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/validation", () => ({ validateCitation: mocks.validateCitation }));
vi.mock("@/lib/edge-cache", () => ({
  invalidateHypothesisCaches: mocks.invalidateHypothesisCaches,
}));
vi.mock("@/db", () => ({
  getDB: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ id: "h-1", submittedBy: "author-1", citationDois: [] }],
        }),
      }),
    }),
    update: () => ({ set: () => ({ where: mocks.update }) }),
  }),
}));

describe("citation cache invalidation", () => {
  beforeEach(() => {
    mocks.getSession.mockResolvedValue({ id: "author-1" });
    mocks.validateCitation.mockReturnValue(true);
    mocks.update.mockResolvedValue(undefined);
    mocks.invalidateHypothesisCaches.mockResolvedValue(undefined);
  });

  const patch = () =>
    PATCH(
      new Request("https://example.test/api/hypotheses/h-1", {
        method: "PATCH",
        body: JSON.stringify({ addCitation: "10.1234/example" }),
      }),
      { params: Promise.resolve({ id: "h-1" }) },
    );

  it("invalidates dependent hypothesis caches after a successful citation update", async () => {
    const response = await patch();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: { citationDois: ["10.1234/example"] },
    });
    expect(mocks.invalidateHypothesisCaches).toHaveBeenCalledExactlyOnceWith("h-1");
    expect(mocks.update.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.invalidateHypothesisCaches.mock.invocationCallOrder[0],
    );
  });

  it("does not invalidate caches when authentication or persistence fails", async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    expect((await patch()).status).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.invalidateHypothesisCaches).not.toHaveBeenCalled();

    mocks.update.mockRejectedValueOnce(new Error("write failed"));
    await expect(patch()).rejects.toThrow("write failed");
    expect(mocks.invalidateHypothesisCaches).not.toHaveBeenCalled();
  });
});
