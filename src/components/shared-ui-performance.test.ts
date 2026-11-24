import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Hypothesis } from "@/lib/types";
import { Navbar } from "./navbar";
import { HypothesisCard } from "./hypothesis-card";

const harness = vi.hoisted(() => ({
  states: [] as boolean[],
  stateIndex: 0,
  setters: [vi.fn(), vi.fn(), vi.fn()],
  effects: [] as {
    callback: () => void | (() => void);
    dependencies: readonly unknown[];
  }[],
  contains: vi.fn(),
  loading: false,
  user: null as null | {
    id: string;
    name: string;
    email: string;
    avatarUrl: string;
  },
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof React>()),
  useState: () => {
    const index = harness.stateIndex++;
    return [harness.states[index] ?? false, harness.setters[index]];
  },
  useRef: () => ({ current: { contains: harness.contains } }),
  useEffect: (callback: () => void | (() => void), dependencies: readonly unknown[]) => {
    harness.effects.push({ callback, dependencies });
  },
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/explore" }));
vi.mock("./auth-provider", () => ({
  useAuth: () => ({
    loading: harness.loading,
    user: harness.user,
    signOut: vi.fn(),
    setShowAuthModal: vi.fn(),
  }),
}));

const hypothesis: Hypothesis = {
  id: "hypothesis-1",
  statement: "A test hypothesis",
  rationale: "",
  source: "human",
  domain: [],
  problemStatement: "problem-1",
  status: "proposed",
  phase: "live",
  submittedAt: "2026-01-01",
  commentCount: 0,
  citationDois: [],
  relatedHypothesisIds: [],
};

interface ElementProps {
  children?: React.ReactNode;
  className?: string;
  loading?: string;
  alt?: string;
  referrerPolicy?: string;
  "aria-hidden"?: string;
}

function elements(node: React.ReactNode): React.ReactElement<ElementProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}

beforeEach(() => {
  harness.states = [];
  harness.stateIndex = 0;
  harness.effects = [];
  harness.loading = false;
  harness.user = null;
  harness.contains.mockReturnValue(false);
  vi.stubGlobal("React", React);
  vi.stubGlobal("document", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe.each([
  { name: "navbar", render: () => Navbar(), stateIndex: 2 },
  {
    name: "hypothesis card",
    render: () => HypothesisCard({ hypothesis }),
    stateIndex: 0,
  },
])("$name outside-click listener", ({ render, stateIndex }) => {
  it("does not register while the menu is closed", () => {
    render();
    expect(harness.effects[0].dependencies).toEqual([false]);
    expect(harness.effects[0].callback()).toBeUndefined();
    expect(document.addEventListener).not.toHaveBeenCalled();
  });

  it("registers only while open, ignores inside clicks, and cleans up", () => {
    harness.states[stateIndex] = true;
    render();
    expect(harness.effects[0].dependencies).toEqual([true]);
    const cleanup = harness.effects[0].callback();
    const addListener = vi.mocked(document.addEventListener);
    expect(addListener).toHaveBeenCalledOnce();
    const listener = addListener.mock.calls[0][1] as (event: { target: object }) => void;
    expect(addListener.mock.calls[0][0]).toBe("mousedown");

    harness.contains.mockReturnValue(true);
    listener({ target: {} });
    expect(harness.setters[stateIndex]).not.toHaveBeenCalled();

    harness.contains.mockReturnValue(false);
    listener({ target: {} });
    expect(harness.setters[stateIndex]).toHaveBeenCalledWith(false);

    if (typeof cleanup !== "function") throw new Error("Expected effect cleanup");
    cleanup();
    expect(document.removeEventListener).toHaveBeenCalledWith("mousedown", listener);
  });
});

describe("navbar auth slot", () => {
  const user = {
    id: "user-1",
    name: "Ada",
    email: "ada@example.com",
    avatarUrl: "https://example.com/avatar.png",
  };

  it.each([
    { loading: true, user: null },
    { loading: false, user: null },
    { loading: false, user },
  ])("reserves the same inaccessible sizing element for %o", (auth) => {
    harness.loading = auth.loading;
    harness.user = auth.user;
    const tree = elements(Navbar());
    const slot = tree.find((element) => element.props.className?.includes("ml-2 grid shrink-0"));
    expect(slot).toBeDefined();
    const sizingElement = elements(slot).find((element) =>
      element.props.className?.includes("invisible"),
    );
    expect(sizingElement?.type).toBe("span");
    expect(sizingElement?.props["aria-hidden"]).toBe("true");
    expect(sizingElement?.props.children).toBe("Sign In");
    expect(sizingElement?.props.className).toContain("col-start-1 row-start-1");
  });

  it("keeps desktop avatars lazy and decorative", () => {
    harness.user = user;
    const image = elements(Navbar()).find((element) => element.type === "img");
    expect(image?.props.loading).toBe("lazy");
    expect(image?.props.alt).toBe("");
    expect(image?.props.referrerPolicy).toBe("no-referrer");
  });
});
