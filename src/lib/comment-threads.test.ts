import { describe, expect, it } from "vitest";
import { indexCommentThreads } from "./comment-threads";

describe("indexCommentThreads", () => {
  it("preserves roots, sibling order, nested replies and original object identities", () => {
    const comments = [
      { id: "reply-2", parentId: "root-1" },
      { id: "root-2", parentId: null },
      { id: "nested", parentId: "reply-1" },
      { id: "root-1" },
      { id: "reply-1", parentId: "root-1" },
      { id: "orphan", parentId: "missing" },
      { id: "empty-parent", parentId: "" },
    ];
    const { roots, childrenByParent } = indexCommentThreads(comments);

    expect(roots).toEqual(comments.filter((comment) => !comment.parentId));
    for (const comment of comments) {
      expect(childrenByParent.get(comment.id) ?? []).toEqual(
        comments.filter((candidate) => candidate.parentId === comment.id),
      );
    }
    expect(childrenByParent.get("root-1")).toEqual([comments[0], comments[4]]);
    expect(childrenByParent.get("reply-1")?.[0]).toBe(comments[2]);
    expect(childrenByParent.get("missing")).toEqual([comments[5]]);
    expect(childrenByParent.get("")).toEqual([comments[6]]);
    expect(comments.map((comment) => comment.id)).toEqual([
      "reply-2",
      "root-2",
      "nested",
      "root-1",
      "reply-1",
      "orphan",
      "empty-parent",
    ]);
  });

  it("handles empty input and rebuilds the index when a comment is appended", () => {
    expect(indexCommentThreads([])).toEqual({
      roots: [],
      childrenByParent: new Map(),
    });
    const root = { id: "root" };
    const first = indexCommentThreads([root]);
    const reply = { id: "reply", parentId: "root" };
    const second = indexCommentThreads([root, reply]);
    expect(first.childrenByParent.size).toBe(0);
    expect(second.roots).toEqual([root]);
    expect(second.childrenByParent.get("root")).toEqual([reply]);
  });
});
