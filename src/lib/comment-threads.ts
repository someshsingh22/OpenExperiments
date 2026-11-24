export function indexCommentThreads<T extends { id: string; parentId?: string | null }>(
  comments: readonly T[],
) {
  const roots: T[] = [];
  const childrenByParent = new Map<string, T[]>();

  for (const comment of comments) {
    if (!comment.parentId) roots.push(comment);
    if (typeof comment.parentId === "string") {
      const siblings = childrenByParent.get(comment.parentId);
      if (siblings) siblings.push(comment);
      else childrenByParent.set(comment.parentId, [comment]);
    }
  }

  return { roots, childrenByParent };
}
