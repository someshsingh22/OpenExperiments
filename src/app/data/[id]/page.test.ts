import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import catalog from "@/lib/data/research-catalog.json";
import DatasetDetailPage from "./page";

const hooks = vi.hoisted(() => ({
  id: "a",
  states: [] as unknown[],
  index: 0,
  effect: undefined as (() => void | (() => void)) | undefined,
  getDataset: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = hooks.index++;
    if (!(index in hooks.states)) hooks.states[index] = initial;
    return [
      hooks.states[index],
      (value: unknown) => {
        hooks.states[index] = value;
      },
    ];
  },
  useEffect: (effect: () => void | (() => void)) => {
    hooks.effect = effect;
  },
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: hooks.id }) }));
vi.mock("@/lib/api", () => ({ getDataset: hooks.getDataset }));

function render(id: string) {
  hooks.id = id;
  hooks.index = 0;
  DatasetDetailPage();
  return hooks.effect?.();
}

function pendingDataset() {
  let resolve!: (value: ReturnType<typeof response>) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<ReturnType<typeof response>>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function response(id: string) {
  return {
    data: {
      id,
      name: id,
      huggingfaceUrl: "https://huggingface.co/datasets/a",
      createdAt: "1970-01-01",
    },
    problemStatements: [],
    experiments: [],
  };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  hooks.states = [];
  hooks.index = 0;
  hooks.effect = undefined;
  hooks.getDataset.mockReset();
});

describe("dataset detail request lifecycle", () => {
  it.each(catalog.datasets)(
    "shows $name schema and outcome alongside its scientific characterization",
    (dataset) => {
      hooks.states = [dataset, [], [], false, ""];
      hooks.index = 0;
      const markup = renderToStaticMarkup(DatasetDetailPage());
      expect(markup).toContain("Scientific Characterization");
      expect(markup).toContain("Input Columns");
      expect(markup).toContain("Target Column");
      expect(markup).toContain(dataset.description);
      expect(markup).toContain(dataset.osfCharacterization.foreknowledgeSummary);
      expect(markup).toContain("<dl");
      expect(markup).not.toContain(">Provenance</h3>");
      for (const column of [...dataset.dataColumnNames, dataset.targetColumnName]) {
        expect(markup).toContain(`>${column}</code>`);
      }
    },
  );

  it("links to ICLR source terms and omits the excluded source variables", () => {
    const dataset = catalog.datasets.find((entry) => entry.id === "ds-iclr")!;
    hooks.states = [dataset, [], [], false, ""];
    hooks.index = 0;
    const markup = renderToStaticMarkup(DatasetDetailPage());

    expect(markup).toContain('href="https://openreview.net/legal/terms"');
    expect(markup).toContain('href="https://iclr.cc/FAQ/Copyright"');
    expect(markup).toContain('href="https://github.com/papercopilot/openreview"');
    expect(markup).toContain("The source dataset may contain additional columns.");
    for (const column of ["arxiv_id", "arxiv_before_review", "authors", "author_affiliations"]) {
      expect(markup).not.toContain(`>${column}</code>`);
    }
  });

  it("ignores an obsolete success after navigating to another dataset", async () => {
    const a = pendingDataset();
    const b = pendingDataset();
    hooks.getDataset.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const cleanup = render("a");
    cleanup?.();
    render("b");
    b.resolve(response("b"));
    await settle();
    a.resolve(response("a"));
    await settle();
    expect(hooks.states).toEqual([response("b").data, [], [], false, ""]);
    expect(hooks.getDataset.mock.calls).toEqual([["a"], ["b"]]);
  });

  it("ignores obsolete errors and completion while the current request is pending", async () => {
    const a = pendingDataset();
    const b = pendingDataset();
    hooks.getDataset.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const cleanup = render("a");
    cleanup?.();
    render("b");
    a.reject(new Error("Unavailable"));
    await settle();
    expect(hooks.states).toEqual([null, [], [], true, ""]);
    b.resolve(response("b"));
    await settle();
    expect(hooks.states).toEqual([response("b").data, [], [], false, ""]);
  });

  it("clears a prior error and resets loading when the ID changes", async () => {
    hooks.getDataset.mockRejectedValueOnce(new Error("Missing"));
    const cleanup = render("missing");
    await settle();
    expect(hooks.states).toEqual([null, [], [], false, "Dataset not found"]);
    cleanup?.();
    const b = pendingDataset();
    hooks.getDataset.mockReturnValueOnce(b.promise);
    render("b");
    expect(hooks.states).toEqual([null, [], [], true, ""]);
    b.resolve(response("b"));
    await settle();
    expect(hooks.states).toEqual([response("b").data, [], [], false, ""]);
  });

  it("does not update state after unmounting", async () => {
    const a = pendingDataset();
    hooks.getDataset.mockReturnValueOnce(a.promise);
    const cleanup = render("a");
    cleanup?.();
    const before = [...hooks.states];
    a.resolve(response("a"));
    await settle();
    expect(hooks.states).toEqual(before);
  });
});
