"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getHypotheses, toggleStar, getStarsBatch } from "@/lib/api";
import { HypothesisCard } from "@/components/hypothesis-card";
import { useAuth } from "@/components/auth-provider";
import type { Hypothesis, ProblemStatement } from "@/lib/types";

const BASE_DOMAINS = ["persuasion", "memorability"];

const STATUS_OPTIONS = [
  { value: "all", label: "All phases" },
  { value: "live", label: "Live" },
  { value: "completed", label: "Completed" },
] as const;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "top_rated", label: "Top Rated" },
  { value: "most_discussed", label: "Most Discussed" },
] as const;

type DomainFilter = string;
type PhaseFilter = (typeof STATUS_OPTIONS)[number]["value"];
type SortOption = (typeof SORT_OPTIONS)[number]["value"];

interface ExploreContentProps {
  initialHypotheses: Hypothesis[];
  initialProblemStatements: ProblemStatement[];
  initialPsId?: string;
}

function ExploreContentInner({
  initialHypotheses,
  initialProblemStatements,
  initialPsId,
}: ExploreContentProps) {
  const { user, setShowAuthModal } = useAuth();
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState<DomainFilter>("all");
  const [phase, setPhase] = useState<PhaseFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [selectedPS, setSelectedPS] = useState<string | null>(null);
  const [hypothesesData, setHypothesesData] = useState<Hypothesis[]>(initialHypotheses);
  const [loading, setLoading] = useState(false);
  const [psInitialized, setPsInitialized] = useState(false);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [starCounts, setStarCounts] = useState<Map<string, number>>(new Map());
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [hasUserFiltered, setHasUserFiltered] = useState(false);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Re-fetch when filters change (skip initial load since we have server data)
  useEffect(() => {
    if (!hasUserFiltered) return;
    setLoading(true);
    const params: Record<string, string> = { sort: sortBy };
    if (domain !== "all") params.domain = domain;
    if (phase !== "all") params.phase = phase;
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

    getHypotheses(params)
      .then((res) => setHypothesesData(res.data))
      .finally(() => setLoading(false));
  }, [domain, phase, sortBy, debouncedSearch, hasUserFiltered]);

  // Load star status for visible hypotheses (batch)
  useEffect(() => {
    if (!user || hypothesesData.length === 0) return;
    const ids = hypothesesData.map((h) => h.id);
    getStarsBatch(ids)
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
  }, [user, hypothesesData]);

  // Read PS from initial prop once problem statements are loaded
  useEffect(() => {
    if (psInitialized || initialProblemStatements.length === 0) return;
    if (initialPsId) {
      const match = initialProblemStatements.find((p) => p.id === initialPsId);
      if (match) setSelectedPS(match.question);
    }
    setPsInitialized(true);
  }, [initialPsId, initialProblemStatements, psInitialized]);

  const psQuestions = useMemo(
    () => initialProblemStatements.map((ps) => ps.question),
    [initialProblemStatements],
  );

  const domainOptions = useMemo(() => {
    const fromPS = initialProblemStatements.map((ps) => ps.domain);
    const all = [...new Set([...BASE_DOMAINS, ...fromPS])];
    return [
      { value: "all", label: "All domains" },
      ...all.map((d) => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) })),
    ];
  }, [initialProblemStatements]);

  const filtered = useMemo(() => {
    if (!selectedPS) return hypothesesData;
    return hypothesesData.filter((h) => h.problemStatement === selectedPS);
  }, [hypothesesData, selectedPS]);

  const handleStar = useCallback(
    async (id: string) => {
      if (!user) {
        setShowAuthModal(true);
        return;
      }

      const wasStarred = starredIds.has(id);
      const prevCount = starCounts.get(id) ?? 0;

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

  const triggerFilter = (setter: () => void) => {
    setter();
    setHasUserFiltered(true);
  };

  const selectClass =
    "rounded-md border border-stone-200 bg-white px-2.5 py-2 text-sm text-stone-700 focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-300";

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="mb-6 text-xl font-semibold text-stone-900">Explore Hypotheses</h1>

        {/* Filters */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-stone-300" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHasUserFiltered(true);
              }}
              className="w-full rounded-md border border-stone-200 bg-white py-2 pr-3 pl-8 text-sm text-stone-700 placeholder-stone-400 focus:border-stone-400 focus:ring-1 focus:ring-stone-300 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by domain"
              value={domain}
              onChange={(e) => triggerFilter(() => setDomain(e.target.value as DomainFilter))}
              className={selectClass}
            >
              {domainOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by phase"
              value={phase}
              onChange={(e) => triggerFilter(() => setPhase(e.target.value as PhaseFilter))}
              className={selectClass}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Sort hypotheses"
              value={sortBy}
              onChange={(e) => triggerFilter(() => setSortBy(e.target.value as SortOption))}
              className={selectClass}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:ml-auto">
            <Link
              href="/submit"
              className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-4 py-2 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
            >
              Submit a Hypothesis
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Problem statement chips */}
        <div className="mb-8 overflow-x-auto">
          <div className="flex gap-1.5 pb-1">
            <button
              onClick={() => setSelectedPS(null)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedPS === null
                  ? "bg-stone-900 text-white"
                  : "bg-white text-stone-600 ring-1 ring-stone-300 hover:text-stone-900 hover:ring-stone-400"
              }`}
            >
              All
            </button>
            {psQuestions.map((ps) => (
              <button
                key={ps}
                onClick={() => setSelectedPS(ps)}
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selectedPS === ps
                    ? "bg-stone-900 text-white"
                    : "bg-white text-stone-600 ring-1 ring-stone-300 hover:text-stone-900 hover:ring-stone-400"
                }`}
              >
                {ps}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
          </div>
        ) : filtered.length > 0 ? (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {filtered.map((hypothesis) => (
              <div key={hypothesis.id} className="mb-4 break-inside-avoid">
                <HypothesisCard
                  hypothesis={hypothesis}
                  onStar={handleStar}
                  starred={starredIds.has(hypothesis.id)}
                  starCount={starCounts.get(hypothesis.id)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-400 py-16 text-center">
            <p className="mb-1 text-base font-semibold text-stone-700">
              No hypotheses match your filters.
            </p>
            <p className="text-sm text-stone-500">Be the first &mdash; submit one.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function ExploreContent(props: ExploreContentProps) {
  return <ExploreContentInner {...props} />;
}
