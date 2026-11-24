import { getHypotheses } from "@/lib/api";
import type { Hypothesis } from "@/lib/types";

export function createLatestRequest() {
  let generation = 0;
  const capture = () => {
    const current = generation;
    return () => current === generation;
  };
  return {
    capture,
    start() {
      generation++;
      return capture();
    },
    invalidate() {
      generation++;
    },
  };
}

export function createHypothesisChoicesLoader() {
  const cache = new Map<string, { data: Hypothesis[]; expiresAt: number }>();
  const latestLoads = new Map<string, number>();
  let generation = 0;
  let sequence = 0;
  return {
    clear() {
      generation++;
      cache.clear();
      latestLoads.clear();
    },
    async load(id: string, question: string): Promise<Hypothesis[]> {
      const key = JSON.stringify([id, question]);
      const cached = cache.get(key);
      if (cached && cached.expiresAt > Date.now()) return cached.data;
      const current = generation;
      const request = ++sequence;
      latestLoads.set(key, request);
      const res = await getHypotheses({ search: question, limit: 50 });
      // A request started before submission must not repopulate the cleared cache.
      if (current === generation && latestLoads.get(key) === request) {
        cache.set(key, { data: res.data, expiresAt: Date.now() + 60_000 });
      }
      return res.data;
    },
  };
}
