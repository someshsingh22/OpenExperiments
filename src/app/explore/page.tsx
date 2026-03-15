"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getHypotheses, getProblemStatements, toggleStar } from "@/lib/api";
import { HypothesisCard } from "@/components/hypothesis-card";
import { useAuth } from "@/components/auth-provider";
import type { Hypothesis, ProblemStatement } from "@/lib/types";

const DOMAIN_OPTIONS = [
  { value: "all", label: "All domains" },
  { value: "persuasion", label: "Persuasion" },
  { value: "memorability", label: "Memorability" },
] as const;

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

type DomainFilter = (typeof DOMAIN_OPTIONS)[number]["value"];
type PhaseFilter = (typeof STATUS_OPTIONS)[number]["value"];
type SortOption = (typeof SORT_OPTIONS)[number]["value"];

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
        </div>
      }
    >
      <ExploreContent />
    </Suspense>
  );
}

function ExploreContent() {
  const searchParams = useSearchParams();
  const { user, setShowAuthModal } = useAuth();
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState<DomainFilter>("all");
  const [phase, setPhase] = useState<PhaseFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [selectedPS, setSelectedPS] = useState<string | null>(null);
  const [hypothesesData, setHypothesesData] = useState<Hypothesis[]>([]);
  const [problemStatementsData, setProblemStatementsData] = useState<ProblemStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [psInitialized, setPsInitialized] = useState(false);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [starCounts, setStarCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = { sort: sortBy };
    if (domain !== "all") params.domain = domain;
    if (phase !== "all") params.phase = phase;
    if (search.trim()) params.search = search.trim();

    getHypotheses(params)
      .then((res) => setHypothesesData(res.data))
      .finally(() => setLoading(false));
  }, [domain, phase, sortBy, search]);

  useEffect(() => {
    getProblemStatements().then((res) => setProblemStatementsData(res.data));
  }, []);

  // Load star status for visible hypotheses
  useEffect(() => {
    if (!user || hypothesesData.length === 0) return;
    const ids = hypothesesData.map((h) => h.id);
    Promise.all(
      ids.map((id) =>
        fetch(`/api/hypotheses/${id}/star`)
          .then((res) => res.json())
          .then((res) => {
            const data = (res as { data: { count: number; starred: boolean } }).data;
            return { id, count: data.count, starred: data.starred };
          })
          .catch(() => ({ id, count: 0, starred: false })),
      ),
    ).then((results) => {
      const newStarred = new Set<string>();
      const newCounts = new Map<string, number>();
      for (const r of results) {
        if (r.starred) newStarred.add(r.id);
        newCounts.set(r.id, r.count);
      }
      setStarredIds(newStarred);
      setStarCounts(newCounts);
    });
  }, [user, hypothesesData]);

  // Read PS from URL params once problem statements are loaded
  useEffect(() => {
    if (psInitialized || problemStatementsData.length === 0) return;
    const psId = searchParams.get("ps");
    if (psId) {
      const match = problemStatementsData.find((p) => p.id === psId);
      if (match) setSelectedPS(match.question);
    }
    setPsInitialized(true);
  }, [searchParams, problemStatementsData, psInitialized]);

  const psQuestions = useMemo(
    () => problemStatementsData.map((ps) => ps.question),
    [problemStatementsData],
  );

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
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-stone-200 bg-white py-2 pr-3 pl-8 text-sm text-stone-700 placeholder-stone-400 focus:border-stone-400 focus:ring-1 focus:ring-stone-300 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value as DomainFilter)}
              className={selectClass}
            >
              {DOMAIN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={phase}
              onChange={(e) => setPhase(e.target.value as PhaseFilter)}
              className={selectClass}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
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
              href="/experiments"
              className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-4 py-2 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
            >
              Submit an Experiment
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
