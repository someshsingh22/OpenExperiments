import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "./auth-provider";

const mocks = vi.hoisted(() => ({
  user: null as AuthUser | null,
  getStarsBatch: vi.fn(),
  toggleStar: vi.fn(),
  setShowAuthModal: vi.fn(),
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  stateIndex: 0,
  refIndex: 0,
  dependencies: undefined as readonly unknown[] | undefined,
  cleanup: undefined as (() => void) | undefined,
  pendingEffect: undefined as (() => (() => void) | void) | undefined,
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof React>()),
  useState: (initial: unknown) => {
    const index = mocks.stateIndex++;
    if (!(index in mocks.states)) mocks.states[index] = initial;
    return [
      mocks.states[index],
      (next: unknown) => {
        mocks.states[index] = typeof next === "function" ? next(mocks.states[index]) : next;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const index = mocks.refIndex++;
    mocks.refs[index] ??= { current: initial };
    return mocks.refs[index];
  },
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => (() => void) | void, dependencies: readonly unknown[]) => {
    if (
      !mocks.dependencies ||
      dependencies.some((value, index) => !Object.is(value, mocks.dependencies?.[index]))
    ) {
      mocks.dependencies = dependencies;
      mocks.pendingEffect = effect;
    }
  },
}));
vi.mock("@/lib/api", () => ({
  getStarsBatch: mocks.getStarsBatch,
  toggleStar: mocks.toggleStar,
}));
vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ user: mocks.user, setShowAuthModal: mocks.setShowAuthModal }),
}));
vi.mock("@/components/hypothesis-card", () => ({ HypothesisCard: () => null }));

import { HomeDynamicSections } from "./home-dynamic-sections";
import { HypothesisCard } from "./hypothesis-card";

const user: AuthUser = {
  id: "user-1",
  name: "Ada",
  email: null,
  avatarUrl: null,
  profileCompleted: true,
};
const hypotheses: React.ComponentProps<typeof HomeDynamicSections>["initialHypotheses"] = [
  {
    id: "h-1",
    statement: "Statement",
    source: "ai_agent",
    agentName: "Agent",
    domain: ["persuasion"],
    status: "data_tested",
    phase: "completed",
    submittedAt: "2023-11-14",
    commentCount: 2,
  },
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function render(initialHypotheses = hypotheses) {
  mocks.stateIndex = 0;
  mocks.refIndex = 0;
  const tree = HomeDynamicSections({ initialHypotheses, initialProblems: [] });
  if (mocks.pendingEffect) {
    mocks.cleanup?.();
    mocks.cleanup = mocks.pendingEffect() || undefined;
    mocks.pendingEffect = undefined;
  }
  return tree;
}

function findCard(tree: React.ReactNode): React.ComponentProps<typeof HypothesisCard> {
  if (React.isValidElement<{ children?: React.ReactNode }>(tree)) {
    if (tree.type === HypothesisCard) {
      return tree.props as React.ComponentProps<typeof HypothesisCard>;
    }
    for (const child of React.Children.toArray(tree.props.children)) {
      try {
        return findCard(child);
      } catch {}
    }
  }
  throw new Error("No hypothesis card found");
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("homepage star lifecycle", () => {
  afterEach(() => {
    mocks.cleanup?.();
  });

  beforeEach(() => {
    mocks.user = user;
    mocks.states = [];
    mocks.refs = [];
    mocks.dependencies = undefined;
    mocks.cleanup = undefined;
    mocks.pendingEffect = undefined;
    mocks.getStarsBatch.mockResolvedValue({ data: { "h-1": { starred: true, count: 4 } } });
  });

  it("does not refetch for equivalent user/prop identities and preserves share values", async () => {
    render();
    await settle();
    mocks.user = { ...user };
    const card = findCard(render(hypotheses.map((h) => ({ ...h }))));
    expect(mocks.getStarsBatch).toHaveBeenCalledExactlyOnceWith(["h-1"]);
    expect(card.starred).toBe(true);
    expect(card.starCount).toBe(4);
    expect(card.hypothesis).toMatchObject(hypotheses[0]);
  });

  it("clears logout state and ignores a superseded batch response", async () => {
    render();
    await settle();
    const next = deferred<{ data: Record<string, { starred: boolean; count: number }> }>();
    mocks.getStarsBatch.mockReturnValueOnce(next.promise);
    mocks.user = { ...user, id: "user-2" };
    render();
    expect(mocks.states).toEqual([new Set(), new Map()]);
    mocks.user = null;
    render();
    next.resolve({ data: { "h-1": { starred: true, count: 99 } } });
    await settle();
    expect(mocks.states).toEqual([new Set(), new Map()]);
    expect(mocks.getStarsBatch).toHaveBeenCalledTimes(2);
  });

  it("ignores responses for superseded hypothesis IDs and after unmount", async () => {
    const stale = deferred<{ data: Record<string, { starred: boolean; count: number }> }>();
    mocks.getStarsBatch.mockReturnValueOnce(stale.promise);
    render();
    mocks.getStarsBatch.mockResolvedValueOnce({ data: { "h-2": { starred: false, count: 6 } } });
    render([{ ...hypotheses[0], id: "h-2" }]);
    await settle();
    stale.resolve({ data: { "h-1": { starred: true, count: 99 } } });
    await settle();
    expect(mocks.states).toEqual([new Set(), new Map([["h-2", 6]])]);
    const afterUnmount = deferred<{ data: Record<string, { starred: boolean; count: number }> }>();
    mocks.getStarsBatch.mockReturnValueOnce(afterUnmount.promise);
    render(hypotheses);
    mocks.cleanup?.();
    afterUnmount.resolve({ data: { "h-1": { starred: true, count: 99 } } });
    await settle();
    expect(mocks.states).toEqual([new Set(), new Map()]);
  });

  it.each([false, true])(
    "ignores a pending toggle on account change (failure: %s)",
    async (fail) => {
      render();
      await settle();
      const toggle = deferred<{ data: { starred: boolean; count: number } }>();
      mocks.toggleStar.mockReturnValueOnce(toggle.promise);
      const card = findCard(render());
      const pending = card.onStar?.("h-1");
      mocks.user = { ...user, id: "user-2" };
      render();
      await settle();
      if (fail) toggle.reject(new Error("Failed"));
      else toggle.resolve({ data: { starred: false, count: 3 } });
      await pending;
      await settle();
      expect(mocks.states).toEqual([new Set(["h-1"]), new Map([["h-1", 4]])]);
    },
  );
});
