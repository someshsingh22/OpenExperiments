import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ArenaPage from "./page";

const api = vi.hoisted(() => ({
  getMatchup: vi.fn(),
  getArenaRankings: vi.fn(),
  getStarsBatch: vi.fn(),
  toggleStar: vi.fn(),
  castVote: vi.fn(),
}));
const auth = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  setShowAuthModal: vi.fn(),
}));

// Exercise the page's request/effect logic without adding a DOM or renderer dependency.
const hooks = vi.hoisted(() => {
  const state = {
    slots: [] as unknown[],
    cursor: 0,
    effects: [] as (() => void)[],
  };
  const sameDeps = (a?: readonly unknown[], b?: readonly unknown[]) =>
    !!a && !!b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  return {
    state,
    useState<T>(initial: T | (() => T)): [T, (value: T | ((previous: T) => T)) => void] {
      const index = state.cursor++;
      if (!(index in state.slots)) {
        state.slots[index] = typeof initial === "function" ? (initial as () => T)() : initial;
      }
      return [
        state.slots[index] as T,
        (value) => {
          state.slots[index] =
            typeof value === "function"
              ? (value as (previous: T) => T)(state.slots[index] as T)
              : value;
        },
      ];
    },
    useRef<T>(initial: T): { current: T } {
      const index = state.cursor++;
      if (!(index in state.slots)) state.slots[index] = { current: initial };
      return state.slots[index] as { current: T };
    },
    useCallback<T>(callback: T, deps: readonly unknown[]): T {
      const index = state.cursor++;
      const previous = state.slots[index] as { callback: T; deps: readonly unknown[] } | undefined;
      if (!previous || !sameDeps(previous.deps, deps)) state.slots[index] = { callback, deps };
      return (state.slots[index] as { callback: T }).callback;
    },
    useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      const index = state.cursor++;
      const previous = state.slots[index] as
        | { deps?: readonly unknown[]; cleanup?: () => void }
        | undefined;
      if (previous && sameDeps(previous.deps, deps)) return;
      const next = { deps, cleanup: undefined as (() => void) | undefined };
      state.slots[index] = next;
      state.effects.push(() => {
        previous?.cleanup?.();
        next.cleanup = effect() || undefined;
      });
    },
    unmount() {
      for (const slot of state.slots) {
        if (slot && typeof slot === "object" && "cleanup" in slot) {
          (slot as { cleanup?: () => void }).cleanup?.();
        }
      }
    },
  };
});

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: hooks.useState,
  useRef: hooks.useRef,
  useCallback: hooks.useCallback,
  useEffect: hooks.useEffect,
}));
vi.mock("@/lib/api", () => api);
vi.mock("@/components/auth-provider", () => ({ useAuth: () => auth }));
vi.mock("@/components/domain-tag", () => ({ DomainTag: "span" }));
vi.mock("next/link", () => ({ default: "a" }));

type Props = {
  children?: React.ReactNode;
  onClick?: () => void | Promise<void>;
  onStar?: (id: string) => Promise<void>;
  hypothesis?: { id: string };
  starred?: boolean;
  starCount?: number;
  starPending?: boolean;
  disabled?: boolean;
};
let tree: React.ReactNode;
function elements(node: React.ReactNode = tree): React.ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap((child) => elements(child ?? null));
  if (!React.isValidElement<Props>(node)) return [];
  return [node, ...elements(node.props.children ?? null)];
}
function text(node: React.ReactNode = tree): string {
  if (Array.isArray(node)) return node.map((child) => text(child ?? null)).join("");
  if (React.isValidElement<Props>(node)) return text(node.props.children ?? null);
  return typeof node === "string" || typeof node === "number" ? String(node) : "";
}
function button(label: string) {
  const node = elements().find((element) => element.type === "button" && text(element) === label);
  if (!node?.props.onClick) throw new Error(`Missing button: ${label}`);
  return node.props.onClick;
}
function card(id: string) {
  const node = elements().find((element) => element.props.hypothesis?.id === id);
  if (!node?.props.onStar) throw new Error(`Missing card: ${id}`);
  return node.props as Props & { onStar: (id: string) => Promise<void> };
}
function render() {
  hooks.state.cursor = 0;
  hooks.state.effects = [];
  tree = ArenaPage();
  for (const effect of hooks.state.effects) effect();
}
async function flush() {
  for (let i = 0; i < 4; i++) {
    await Promise.resolve();
    render();
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const matchup = {
  id: "match-1",
  totalVotes: 0,
  votesA: 0,
  votesB: 0,
  votesTie: 0,
  hypothesisA: { id: "a", statement: "Idea A", domain: [], source: "human" },
  hypothesisB: {
    id: "b",
    statement: "Idea B",
    domain: [],
    source: "ai_agent",
    agentName: "Agent B",
  },
};
const stars = {
  data: { a: { starred: false, count: 2 }, b: { starred: false, count: 3 } },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("React", React);
  hooks.state.slots = [];
  auth.user = { id: "user-1" };
  api.getMatchup.mockResolvedValue({ data: matchup });
  api.getArenaRankings.mockResolvedValue({
    data: [{ id: "a", statement: "Initial ranking", domain: [], winRate: 50 }],
  });
  api.getStarsBatch.mockResolvedValue(stars);
  api.toggleStar.mockResolvedValue({ data: { starred: true, count: 3 } });
  api.castVote.mockResolvedValue({ data: { totalVotes: 1, votesA: 1, votesB: 0, votesTie: 0 } });
});
afterEach(() => {
  hooks.unmount();
  vi.unstubAllGlobals();
});

describe("arena request and mutation guards", () => {
  it("starts matchup/rankings in parallel and does not re-fetch stars for votes or same-user objects", async () => {
    render();
    expect(api.getMatchup).toHaveBeenCalledTimes(1);
    expect(api.getArenaRankings).toHaveBeenCalledTimes(1);
    await flush();
    expect(api.getStarsBatch).toHaveBeenCalledExactlyOnceWith(["a", "b"]);
    auth.user = { id: "user-1" };
    await flush();
    await button("A is better")();
    await flush();
    expect(api.castVote).toHaveBeenCalledExactlyOnceWith("match-1", "a");
    expect(api.getArenaRankings).toHaveBeenCalledTimes(2);
    expect(api.getStarsBatch).toHaveBeenCalledTimes(1);
    expect(text()).toContain("Agent B");
  });

  it("serializes each star ID and merges other IDs without overwriting a newer mutation", async () => {
    const batch = deferred<typeof stars>();
    const mutation = deferred<{ data: { starred: boolean; count: number } }>();
    api.getStarsBatch.mockReturnValue(batch.promise);
    api.toggleStar.mockReturnValue(mutation.promise);
    render();
    await flush();
    const star = card("a").onStar;
    const first = star("a");
    await star("a");
    expect(api.toggleStar).toHaveBeenCalledTimes(1);
    render();
    expect(card("a").starPending).toBe(true);
    mutation.resolve({ data: { starred: true, count: 9 } });
    await first;
    batch.resolve(stars);
    await flush();
    expect(card("a").starred).toBe(true);
    expect(card("a").starCount).toBe(9);
    expect(card("a").starPending).toBe(false);
    expect(card("b").starCount).toBe(3);
  });

  it("rolls back failed stars and releases the per-ID lock", async () => {
    render();
    await flush();
    api.toggleStar.mockRejectedValueOnce(new Error("offline"));
    await card("a").onStar("a");
    await flush();
    expect(card("a").starred).toBe(false);
    expect(card("a").starCount).toBe(2);
    expect(card("a").starPending).toBe(false);
    await card("a").onStar("a");
    await flush();
    expect(api.toggleStar).toHaveBeenCalledTimes(2);
    expect(card("a").starred).toBe(true);
  });

  it("clears account state and rejects old batch/mutation responses across logout and login", async () => {
    const oldBatch = deferred<typeof stars>();
    const oldMutation = deferred<{ data: { starred: boolean; count: number } }>();
    api.getStarsBatch.mockReturnValueOnce(oldBatch.promise);
    api.toggleStar.mockReturnValueOnce(oldMutation.promise);
    render();
    await flush();
    const pending = card("a").onStar("a");
    auth.user = null;
    render();
    expect(card("a").starred).toBe(false);
    expect(card("a").starCount).toBeUndefined();
    await flush();
    await card("a").onStar("a");
    expect(auth.setShowAuthModal).toHaveBeenCalledWith(true);
    auth.user = { id: "user-2" };
    await flush();
    expect(api.getStarsBatch).toHaveBeenCalledTimes(2);
    oldBatch.resolve({
      data: { a: { starred: true, count: 99 }, b: { starred: true, count: 99 } },
    });
    oldMutation.resolve({ data: { starred: true, count: 100 } });
    await pending;
    await flush();
    expect(card("a").starred).toBe(false);
    expect(card("a").starCount).toBe(2);
    expect(card("a").starPending).toBe(false);
  });

  it("does not let an old account mutation release the new account's star lock", async () => {
    const oldMutation = deferred<{ data: { starred: boolean; count: number } }>();
    const newMutation = deferred<{ data: { starred: boolean; count: number } }>();
    api.toggleStar
      .mockReturnValueOnce(oldMutation.promise)
      .mockReturnValueOnce(newMutation.promise);
    render();
    await flush();
    const oldPending = card("a").onStar("a");
    auth.user = { id: "user-2" };
    await flush();
    const newPending = card("a").onStar("a");
    oldMutation.resolve({ data: { starred: true, count: 99 } });
    await oldPending;
    await flush();
    expect(card("a").starPending).toBe(true);
    expect(card("a").starCount).toBe(3);
    await card("a").onStar("a");
    expect(api.toggleStar).toHaveBeenCalledTimes(2);
    newMutation.resolve({ data: { starred: true, count: 4 } });
    await newPending;
    await flush();
    expect(card("a").starPending).toBe(false);
    expect(card("a").starCount).toBe(4);
  });

  it("discards an older matchup's star batch even for a shared hypothesis ID", async () => {
    const oldBatch = deferred<typeof stars>();
    api.getStarsBatch.mockReturnValueOnce(oldBatch.promise).mockResolvedValueOnce({
      data: { c: { starred: false, count: 4 }, b: { starred: true, count: 10 } },
    });
    render();
    await flush();
    await button("A is better")();
    await flush();
    api.getMatchup.mockResolvedValueOnce({
      data: { ...matchup, id: "match-2", hypothesisA: { ...matchup.hypothesisA, id: "c" } },
    });
    await button("Next matchup")();
    await flush();
    oldBatch.resolve(stars);
    await flush();
    expect(card("b").starred).toBe(true);
    expect(card("b").starCount).toBe(10);
    expect(card("c").starCount).toBe(4);
  });

  it("keeps the latest rankings when the initial response arrives after a successful vote", async () => {
    const initial = deferred<{
      data: { id: string; statement: string; domain: string[]; winRate: number }[];
    }>();
    api.getArenaRankings.mockReturnValueOnce(initial.promise).mockResolvedValueOnce({
      data: [{ id: "b", statement: "New ranking", domain: [], winRate: 75 }],
    });
    render();
    await flush();
    await button("B is better")();
    await flush();
    initial.resolve({ data: [{ id: "a", statement: "Stale ranking", domain: [], winRate: 50 }] });
    await flush();
    expect(text()).toContain("New ranking");
    expect(text()).not.toContain("Stale ranking");
  });

  it("exposes ranking refresh failures with retry without undoing a successful vote", async () => {
    render();
    await flush();
    api.getArenaRankings.mockRejectedValueOnce(new Error("rankings offline"));
    await button("Tie")();
    await flush();
    expect(text()).toContain("Initial ranking");
    expect(text()).toContain("Could not refresh rankings: rankings offline");
    expect(text()).toContain("Next matchup");
    expect(text()).not.toContain("A is better");
    await button("Retry rankings")();
    await flush();
    expect(text()).not.toContain("rankings offline");
    expect(api.castVote).toHaveBeenCalledTimes(1);
  });

  it("ignores a stale rankings failure after a newer refresh succeeds", async () => {
    const initial = deferred<{ data: [] }>();
    api.getArenaRankings.mockReturnValueOnce(initial.promise);
    render();
    await flush();
    await button("Tie")();
    await flush();
    initial.reject(new Error("stale rankings failure"));
    await flush();
    expect(text()).not.toContain("stale rankings failure");
    expect(text()).toContain("Initial ranking");
    expect(text()).not.toContain("Refreshing rankings");
  });

  it("preserves voted results on failed Next, locks duplicate loads, and retries a new matchup", async () => {
    render();
    await flush();
    const oldVote = button("A is better");
    await oldVote();
    await flush();
    const next = deferred<{ data: typeof matchup }>();
    api.getMatchup.mockReturnValueOnce(next.promise);
    const load = button("Next matchup");
    load();
    load();
    expect(api.getMatchup).toHaveBeenCalledTimes(2);
    next.reject(new Error("matchup offline"));
    await flush();
    expect(text()).toContain("Agent B");
    expect(text()).toContain("Could not load matchup: matchup offline");
    expect(text()).not.toContain("A is better");
    api.getMatchup.mockResolvedValueOnce({
      data: { ...matchup, id: "match-2", hypothesisA: { ...matchup.hypothesisA, id: "c" } },
    });
    await button("Retry matchup")();
    await flush();
    expect(text()).toContain("A is better");
    expect(text()).not.toContain("Agent B");
    expect(api.getStarsBatch).toHaveBeenLastCalledWith(["c", "b"]);
    await oldVote();
    expect(api.castVote).toHaveBeenCalledTimes(1);
  });

  it("shows retry for initial matchup failure instead of reporting an empty arena", async () => {
    api.getMatchup.mockRejectedValueOnce(new Error("initial offline"));
    render();
    await flush();
    expect(text()).toContain("Could not load matchup: initial offline");
    expect(text()).not.toContain("No matchups available.");
    await button("Retry matchup")();
    await flush();
    expect(text()).toContain("A is better");
  });

  it("locks duplicate votes synchronously and permits retry only after a failed submission", async () => {
    const vote = deferred<{ data: { totalVotes: number } }>();
    api.castVote.mockReturnValueOnce(vote.promise);
    render();
    await flush();
    const submit = button("Both weak");
    const first = submit();
    await submit();
    expect(api.castVote).toHaveBeenCalledExactlyOnceWith("match-1", "both_weak");
    vote.reject(new Error("vote offline"));
    await first;
    await flush();
    expect(text()).toContain("vote offline");
    await button("Both weak")();
    await flush();
    expect(api.castVote).toHaveBeenCalledTimes(2);
    expect(text()).toContain("Next matchup");
  });

  it("mutually excludes matchup loads and votes even through stale event callbacks", async () => {
    render();
    await flush();
    await button("A is better")();
    await flush();
    const load = button("Next matchup");
    api.getMatchup.mockResolvedValueOnce({ data: { ...matchup, id: "match-2" } });
    await load();
    await flush();
    const vote = deferred<{ data: { totalVotes: number } }>();
    api.castVote.mockReturnValueOnce(vote.promise);
    const submit = button("Tie");
    const pendingVote = submit();
    load();
    expect(api.getMatchup).toHaveBeenCalledTimes(2);
    vote.resolve({ data: { totalVotes: 1 } });
    await pendingVote;
    await flush();
    const next = deferred<{ data: typeof matchup }>();
    api.getMatchup.mockReturnValueOnce(next.promise);
    load();
    await submit();
    expect(api.castVote).toHaveBeenCalledTimes(2);
    next.resolve({ data: { ...matchup, id: "match-3" } });
    await flush();
  });

  it("keeps the Already voted response terminal rather than allowing duplicate retries", async () => {
    api.castVote.mockRejectedValueOnce(new Error("Already voted"));
    render();
    await flush();
    const vote = button("B is better");
    await vote();
    await flush();
    expect(text()).toContain("Next matchup");
    await vote();
    expect(api.castVote).toHaveBeenCalledTimes(1);
  });

  it("does not update state from requests completed after unmount", async () => {
    const initial = deferred<{ data: typeof matchup }>();
    api.getMatchup.mockReturnValue(initial.promise);
    render();
    hooks.unmount();
    const snapshot = [...hooks.state.slots];
    initial.resolve({ data: matchup });
    await Promise.resolve();
    await Promise.resolve();
    expect(hooks.state.slots).toEqual(snapshot);
  });
});
