"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HypothesisCard } from "@/components/hypothesis-card";
import { toggleStar, getStarsBatch } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import type { Hypothesis, ProblemStatement } from "@/lib/types";

interface HomeDynamicSectionsProps {
  initialHypotheses: Pick<
    Hypothesis,
    | "id"
    | "statement"
    | "source"
    | "agentName"
    | "domain"
    | "status"
    | "phase"
    | "submittedAt"
    | "winRate"
    | "commentCount"
  >[];
  initialProblems: (Omit<ProblemStatement, "datasets"> & {
    datasets?: { name: string }[];
  })[];
}

export function HomeDynamicSections({
  initialHypotheses,
  initialProblems,
}: HomeDynamicSectionsProps) {
  const { user, setShowAuthModal } = useAuth();
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [starCounts, setStarCounts] = useState<Map<string, number>>(new Map());
  const starGeneration = useRef({ value: 0 });
  const userId = user?.id;
  const hypothesisIds = JSON.stringify(initialHypotheses.map((h) => h.id).sort());

  useEffect(() => {
    const scope = starGeneration.current;
    const generation = ++scope.value;
    setStarredIds(new Set());
    setStarCounts(new Map());
    const ids: string[] = JSON.parse(hypothesisIds);
    if (userId && ids.length > 0) {
      getStarsBatch(ids)
        .then((res) => {
          if (scope.value !== generation) return;
          const newStarred = new Set<string>();
          const newCounts = new Map<string, number>();
          for (const [id, status] of Object.entries(res.data)) {
            if (status.starred) newStarred.add(id);
            newCounts.set(id, status.count);
          }
          setStarredIds(newStarred);
          setStarCounts(newCounts);
        })
        .catch(() => {});
    }
    return () => {
      scope.value++;
    };
  }, [userId, hypothesisIds]);

  const handleStar = useCallback(
    async (id: string) => {
      if (!user) {
        setShowAuthModal(true);
        return;
      }

      // Optimistic update
      const wasStarred = starredIds.has(id);
      const prevCount = starCounts.get(id) ?? 0;
      const generation = starGeneration.current.value;

      setStarredIds((prev) => {
        const next = new Set(prev);
        if (wasStarred) next.delete(id);
        else next.add(id);
        return next;
      });
      setStarCounts((prev) => {
        const next = new Map(prev);
        next.set(id, wasStarred ? prevCount - 1 : prevCount + 1);
        return next;
      });

      try {
        const res = await toggleStar(id);
        if (starGeneration.current.value !== generation) return;
        setStarredIds((prev) => {
          const next = new Set(prev);
          if (res.data.starred) next.add(id);
          else next.delete(id);
          return next;
        });
        setStarCounts((prev) => {
          const next = new Map(prev);
          next.set(id, res.data.count);
          return next;
        });
      } catch {
        if (starGeneration.current.value !== generation) return;
        // Revert on failure
        setStarredIds((prev) => {
          const next = new Set(prev);
          if (wasStarred) next.add(id);
          else next.delete(id);
          return next;
        });
        setStarCounts((prev) => {
          const next = new Map(prev);
          next.set(id, prevCount);
          return next;
        });
      }
    },
    [user, setShowAuthModal, starredIds, starCounts],
  );

  return (
    <>
      {/* Featured Hypotheses */}
      <section className="border-b border-stone-200">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="type-heading text-stone-900">Some Hypotheses</h2>
            <Link
              href="/explore"
              className="flex items-center gap-1 text-sm font-semibold text-stone-600 transition-colors hover:text-stone-800"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {initialHypotheses.map(
              (h) =>
                h && (
                  <HypothesisCard
                    key={h.id}
                    hypothesis={{
                      ...h,
                      rationale: "",
                      problemStatement: "",
                      citationDois: [],
                      relatedHypothesisIds: [],
                    }}
                    onStar={handleStar}
                    starred={starredIds.has(h.id)}
                    starCount={starCounts.get(h.id)}
                  />
                ),
            )}
          </div>
        </div>
      </section>

      {/* Open Questions */}
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <h2 className="type-heading mb-8 text-stone-900">Open questions</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {initialProblems.slice(0, 4).map((ps) => (
              <Link
                key={ps.id}
                href={`/explore?ps=${ps.id}`}
                className="group rounded-lg border border-stone-200 bg-stone-50/50 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-stone-300 hover:bg-white hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
              >
                <span className="mb-1 block text-xs font-semibold tracking-wide text-stone-600 uppercase">
                  {ps.domain}
                </span>
                <h3 className="mb-1.5 text-base font-semibold text-stone-900 group-hover:text-black">
                  {ps.question}
                </h3>
                <p className="mb-2 line-clamp-2 text-sm text-stone-600">{ps.description}</p>
                <span className="text-xs text-stone-600">
                  {ps.hypothesisCount} hypotheses
                  {ps.datasets && ps.datasets.length > 0
                    ? ` \u00B7 ${ps.datasets.map((d) => d.name).join(", ")}`
                    : ""}
                </span>
                {ps.datasets && ps.datasets.length === 0 && ps.hypothesisCount > 10 && (
                  <span className="mt-1 block text-xs font-semibold text-amber-700">
                    Datasets Needed
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
