import { afterEach, describe, expect, it, vi } from "vitest";
import { getHypotheses } from "@/lib/api";
import type { Hypothesis } from "@/lib/types";
import { createHypothesisChoicesLoader, createLatestRequest } from "./experiment-ui-requests";

vi.mock("@/lib/api", () => ({ getHypotheses: vi.fn() }));

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(getHypotheses).mockReset();
});

describe("latest experiment UI requests", () => {
  it("allows only the newest selection or detail transition to publish results", async () => {
    const tracker = createLatestRequest();
    const writes: string[] = [];
    let resolveOld!: () => void;
    const oldResponse = new Promise<void>((resolve) => {
      resolveOld = resolve;
    });
    const old = tracker.start();
    const pending = oldResponse.then(() => {
      if (old()) writes.push("old");
    });
    const latest = tracker.start();
    if (latest()) writes.push("latest");
    resolveOld();
    await pending;
    expect(writes).toEqual(["latest"]);
  });

  it("invalidates success, error and finally callbacks on cleanup", () => {
    const tracker = createLatestRequest();
    const request = tracker.start();
    const save = tracker.capture();
    tracker.invalidate();
    expect(request()).toBe(false);
    expect(save()).toBe(false);
    expect(tracker.start()()).toBe(true);
  });
});

describe("public hypothesis choices", () => {
  const first: Hypothesis[] = [];

  it("reuses A after A → B → A, keyed by both selection and search question", async () => {
    vi.mocked(getHypotheses).mockResolvedValue({ data: first, total: 0 });
    const choices = createHypothesisChoicesLoader();
    await choices.load("a", "Question A");
    await choices.load("b", "Question B");
    expect(await choices.load("a", "Question A")).toBe(first);
    expect(getHypotheses).toHaveBeenCalledTimes(2);
    await choices.load("a", "Updated question A");
    expect(getHypotheses).toHaveBeenCalledTimes(3);
    expect(getHypotheses).toHaveBeenLastCalledWith({
      search: "Updated question A",
      limit: 50,
    });
  });

  it("expires cached choices and does not share data across form instances", async () => {
    vi.useFakeTimers();
    vi.mocked(getHypotheses).mockResolvedValue({ data: first, total: 0 });
    const choices = createHypothesisChoicesLoader();
    await choices.load("a", "A");
    vi.advanceTimersByTime(60_000);
    await choices.load("a", "A");
    await createHypothesisChoicesLoader().load("a", "A");
    expect(getHypotheses).toHaveBeenCalledTimes(3);
  });

  it("does not cache failures, allowing an explicit retry", async () => {
    vi.mocked(getHypotheses)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ data: first, total: 0 });
    const choices = createHypothesisChoicesLoader();
    await expect(choices.load("a", "A")).rejects.toThrow("offline");
    await expect(choices.load("a", "A")).resolves.toEqual(first);
    expect(getHypotheses).toHaveBeenCalledTimes(2);
  });

  it("clears choices after submission without caching a pre-submit response", async () => {
    let resolveOld!: (res: { data: Hypothesis[]; total: number }) => void;
    vi.mocked(getHypotheses)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValue({ data: first, total: 0 });
    const choices = createHypothesisChoicesLoader();
    const old = choices.load("a", "A");
    choices.clear();
    await choices.load("a", "A");
    resolveOld({ data: [], total: 0 });
    await old;
    expect(await choices.load("a", "A")).toBe(first);
    expect(getHypotheses).toHaveBeenCalledTimes(2);
    choices.clear();
    await choices.load("a", "A");
    expect(getHypotheses).toHaveBeenCalledTimes(3);
  });

  it("does not let an older load overwrite a newer cached response for the same choice", async () => {
    let resolveOld!: (res: { data: Hypothesis[]; total: number }) => void;
    const newer: Hypothesis[] = [];
    vi.mocked(getHypotheses)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValueOnce({ data: newer, total: 0 });
    const choices = createHypothesisChoicesLoader();
    const old = choices.load("a", "A");
    await choices.load("a", "A");
    resolveOld({ data: first, total: 0 });
    await old;
    expect(await choices.load("a", "A")).toBe(newer);
    expect(getHypotheses).toHaveBeenCalledTimes(2);
  });
});
