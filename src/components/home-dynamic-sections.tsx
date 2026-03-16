"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HypothesisCard } from "@/components/hypothesis-card";
import { toggleStar, getStarsBatch } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import type { Hypothesis, ProblemStatement } from "@/lib/types";

interface HomeDynamicSectionsProps {
  initialHypotheses: Hypothesis[];
  initialProblems: ProblemStatement[];
}

export function HomeDynamicSections({
  initialHypotheses,
  initialProblems,
}: HomeDynamicSectionsProps) {
  const { user, setShowAuthModal } = useAuth();
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [starCounts, setStarCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!user || initialHypotheses.length === 0) return;
    getStarsBatch(initialHypotheses.map((h) => h.id))
      .then((res) => {
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
  }, [user, initialHypotheses]);

  const handleStar = useCallback(
    async (id: string) => {
      if (!user) {
        setShowAuthModal(true);
        return;
      }
      try {
        const res = await toggleStar(id);
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
        // silent fail
      }
    },
    [user, setShowAuthModal],
  );

  return (
    <>
      {/* Featured Hypotheses */}
      <section className="border-b border-stone-200">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="text-xl font-semibold text-stone-900">Some Hypotheses</h2>
            <Link
              href="/explore"
              className="flex items-center gap-1 text-sm font-semibold text-stone-500 transition-colors hover:text-stone-800"
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
                    hypothesis={h}
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
          <h2 className="mb-8 text-xl font-semibold text-stone-900">Open questions</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {initialProblems.slice(0, 4).map((ps) => (
              <Link
                key={ps.id}
                href={`/explore?ps=${ps.id}`}
                className="group rounded-lg border border-stone-200 bg-stone-50/50 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-stone-300 hover:bg-white hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
              >
                <span className="mb-1 block text-xs font-semibold tracking-wide text-stone-500 uppercase">
                  {ps.domain}
                </span>
                <h3 className="mb-1.5 text-base font-semibold text-stone-900 group-hover:text-black">
                  {ps.question}
                </h3>
                <p className="mb-2 line-clamp-2 text-sm text-stone-600">{ps.description}</p>
                <span className="text-xs text-stone-500">
                  {ps.hypothesisCount} hypotheses
                  {ps.datasets && ps.datasets.length > 0
                    ? ` \u00B7 ${ps.datasets.map((d) => d.name).join(", ")}`
                    : ""}
                </span>
                {ps.datasets && ps.datasets.length === 0 && ps.hypothesisCount > 10 && (
                  <span className="mt-1 block text-[10px] font-semibold text-amber-600">
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
