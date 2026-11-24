import { isValidElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateProfile } from "@/lib/api";
import ProfilePage from "./page";

const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  cursor: 0,
  effects: [] as (() => void)[],
  id: "author",
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: hooks.id }) }));
vi.mock("@/lib/api", () => ({ updateProfile: vi.fn() }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (index >= hooks.states.length) hooks.states.push(initial);
    return [
      hooks.states[index],
      (next: unknown) => {
        hooks.states[index] = typeof next === "function" ? next(hooks.states[index]) : next;
      },
    ];
  },
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void) => {
    hooks.effects.push(effect);
  },
}));

const profile = {
  user: {
    id: "author",
    name: "Ada",
    email: "ada@example.test",
    avatarUrl: "https://example.test/avatar",
    affiliation: "Institution",
    position: "Scientist",
    scholarUrl: null,
    website: null,
    bio: "Bio",
    orcid: null,
    twitterHandle: null,
    joinedAt: "1970-01-01",
  },
  hypotheses: [{ id: "h1", statement: "Statement", domain: [], isAnonymous: true }],
  starredHypotheses: [],
  stats: { hypothesisCount: 1, experimentCount: 2, commentCount: 3, voteCount: 4 },
  isOwner: true,
};
const canonical = {
  name: "Grace",
  position: null,
  scholarUrl: null,
  website: "https://example.test",
  bio: "Canonical bio",
  orcid: null,
  twitterHandle: null,
};

function render() {
  hooks.cursor = 0;
  return ProfilePage();
}

function button(node: unknown, text: string): () => unknown {
  const matches: (() => unknown)[] = [];
  function visit(element: unknown) {
    if (Array.isArray(element)) {
      element.forEach(visit);
      return;
    }
    if (!isValidElement<{ children?: unknown; onClick?: () => unknown }>(element)) return;
    const children = element.props.children;
    if (
      element.type === "button" &&
      (children === text || (Array.isArray(children) && children.includes(text))) &&
      element.props.onClick
    )
      matches.push(element.props.onClick);
    visit(children);
  }
  visit(node);
  expect(matches).toHaveLength(1);
  return matches[0];
}

async function load() {
  render();
  hooks.effects[0]();
  await vi.waitFor(() => expect(hooks.states[1]).toBe(false));
}

describe("profile save without a full reload", () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    hooks.states = [];
    hooks.cursor = 0;
    hooks.effects = [];
    hooks.id = "author";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ data: structuredClone(profile) })),
    );
    vi.mocked(updateProfile).mockReset();
  });

  it("merges canonical fields while preserving ownership, read-only data and collections", async () => {
    await load();
    button(render(), "Edit")();
    vi.mocked(updateProfile).mockResolvedValue({
      ok: true,
      data: { ...canonical, id: "other", email: "changed", joinedAt: "changed" },
    } as { ok: boolean });
    const previous = hooks.states[0] as typeof profile;
    await button(render(), "Save Changes")();
    const next = hooks.states[0] as typeof profile;
    expect(next).toEqual({ ...profile, user: { ...profile.user, ...canonical } });
    expect(next.hypotheses).toBe(previous.hypotheses);
    expect(next.starredHypotheses).toBe(previous.starredHypotheses);
    expect(next.stats).toBe(previous.stats);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(updateProfile).toHaveBeenCalledTimes(1);
    expect(updateProfile).toHaveBeenCalledWith("author", {
      name: "Ada",
      position: "Scientist",
      scholarUrl: "",
      website: "",
      bio: "Bio",
      orcid: "",
      twitterHandle: "",
    });
    expect(hooks.states[1]).toBe(false);
    expect(hooks.states[3]).toBe(false);
    expect(hooks.states[4]).toBe(false);
  });

  it("keeps data and editing state on a failed save without fetching again", async () => {
    await load();
    button(render(), "Edit")();
    const previous = hooks.states[0];
    vi.mocked(updateProfile).mockRejectedValue(new Error("Save failed"));
    await button(render(), "Save Changes")();
    expect(hooks.states[0]).toBe(previous);
    expect(hooks.states[3]).toBe(true);
    expect(hooks.states[4]).toBe(false);
    expect(hooks.states[5]).toBe("Save failed");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not merge a late owner save into another viewer's profile", async () => {
    await load();
    button(render(), "Edit")();
    let finish!: (value: { ok: boolean }) => void;
    vi.mocked(updateProfile).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const saving = button(render(), "Save Changes")();
    const other = { ...profile, user: { ...profile.user, id: "other" }, isOwner: false };
    hooks.states[0] = other;
    hooks.id = "other";
    finish({ ok: true, data: canonical } as { ok: boolean });
    await saving;
    expect(hooks.states[0]).toBe(other);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
