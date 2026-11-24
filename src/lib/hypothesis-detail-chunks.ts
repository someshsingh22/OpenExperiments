export async function readHypothesisDetailChunks<T>(
  ids: readonly string[],
  read: (chunk: string[]) => PromiseLike<T[]>,
): Promise<T[]> {
  const uniqueIds = [...new Set(ids)];
  const reads: PromiseLike<T[]>[] = [];
  for (let offset = 0; offset < uniqueIds.length; offset += 100) {
    reads.push(read(uniqueIds.slice(offset, offset + 100)));
  }
  return (await Promise.all(reads)).flat();
}
