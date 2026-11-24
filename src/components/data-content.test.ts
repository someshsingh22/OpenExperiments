import { isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataContent } from "./data-content";
import type { Dataset } from "@/lib/types";

const hooks = vi.hoisted(() => ({
  domain: "all",
  getDatasets: vi.fn(),
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: () => [
    hooks.domain,
    (domain: string) => {
      hooks.domain = domain;
    },
  ],
  useMemo: (calculate: () => unknown) => calculate(),
}));
vi.mock("@/lib/api", () => ({ getDatasets: hooks.getDatasets }));

const rows: Dataset[] = [
  {
    id: "a",
    name: "A",
    huggingfaceUrl: "https://example.com/a",
    createdAt: "1970-01-01",
    domain: "persuasion",
    unitOfAnalysis: "A participant",
    problemStatementCount: 0,
    experimentCount: 0,
  },
  {
    id: "b",
    name: "B",
    huggingfaceUrl: "https://example.com/b",
    createdAt: "1970-01-01",
    domain: "custom",
    problemStatementCount: 2,
    experimentCount: 3,
  },
  {
    id: "c",
    name: "C",
    huggingfaceUrl: "https://example.com/c",
    createdAt: "1970-01-01",
    domain: null,
    problemStatementCount: 0,
    experimentCount: 0,
  },
];

function cards(node: ReactNode): Dataset[] {
  if (Array.isArray(node)) return node.flatMap(cards);
  if (!isValidElement<{ dataset?: Dataset; children?: ReactNode }>(node)) return [];
  if (node.props.dataset) return [node.props.dataset];
  return cards(node.props.children);
}

beforeEach(() => {
  hooks.domain = "all";
});

describe("local dataset domain filtering", () => {
  it.each([
    ["all", ["a", "c", "b"]],
    ["persuasion", ["a"]],
    ["custom", ["b"]],
    ["unknown", []],
  ])("filters %s without an API request", (domain, ids) => {
    hooks.domain = domain;
    expect(cards(DataContent({ initialDatasets: rows })).map((row) => row.id)).toEqual(ids);
    expect(hooks.getDatasets).not.toHaveBeenCalled();
  });

  it("returns to the complete list and reflects new initial props", () => {
    hooks.domain = "custom";
    expect(cards(DataContent({ initialDatasets: rows }))).toEqual([rows[1]]);
    hooks.domain = "all";
    expect(cards(DataContent({ initialDatasets: rows }))).toHaveLength(3);
    expect(cards(DataContent({ initialDatasets: [rows[0]] }))).toEqual([rows[0]]);
    expect(hooks.getDatasets).not.toHaveBeenCalled();
  });
});
