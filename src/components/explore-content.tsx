"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Search, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getHypotheses, toggleStar, getStarsBatch } from "@/lib/api";
import { HypothesisCard } from "@/components/hypothesis-card";
import { useAuth } from "@/components/auth-provider";
import type { Hypothesis, ProblemStatement } from "@/lib/types";

const BASE_DOMAINS = ["persuasion", "memorability"];
const PAGE_SIZE = 50;

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
  initialTotal: number;
  initialPsId?: string;
}

function ExploreContentInner({
  initialHypotheses,
  initialProblemStatements,
  initialTotal,
  initialPsId,
}: ExploreContentProps) {
  const { user, setShowAuthModal } = useAuth();
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState<DomainFilter>("all");
  const [phase, setPhase] = useState<PhaseFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [selectedPS, setSelectedPS] = useState<string | null>(initialPsId || null);
  const [hypothesesData, setHypothesesData] = useState<Hypothesis[]>(initialHypotheses);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [starCounts, setStarCounts] = useState<Map<string, number>>(new Map());
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const normalizedSearch = search.trim();
  const params = useMemo(
    () => ({
      sort: sortBy,
      domain: domain === "all" ? undefined : domain,
      phase: phase === "all" ? undefined : phase,
      search: debouncedSearch || undefined,
      problemStatementId: selectedPS || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [sortBy, domain, phase, debouncedSearch, selectedPS, page],
  );
  const queryKey = JSON.stringify(params);
  const loadedKey = useRef(queryKey);

  useEffect(() => {
    if (normalizedSearch === debouncedSearch) return;
    const timer = setTimeout(() => {
      setDebouncedSearch(normalizedSearch);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [normalizedSearch, debouncedSearch]);

  useEffect(() => {
    if (queryKey === loadedKey.current) {
      setLoading(false);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    getHypotheses(params)
      .then((res) => {
        if (!active) return;
        setHypothesesData(res.data);
        setTotal(res.total);
        loadedKey.current = queryKey;
      })
      .catch(() => {
        if (active) setError("Unable to load hypotheses. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params, queryKey, retry]);

  // Load star status for visible hypotheses (batch)
  useEffect(() => {
    let active = true;
    if (!user || hypothesesData.length === 0) {
      setStarredIds(new Set());
      setStarCounts(new Map());
      return;
    }
    const ids = hypothesesData.map((h) => h.id);
    getStarsBatch(ids)
      .then((res) => {
        if (!active) return;
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
    return () => {
      active = false;
    };
  }, [user, hypothesesData]);

  const domainOptions = useMemo(() => {
    const fromPS = initialProblemStatements.map((ps) => ps.domain);
    const all = [...new Set([...BASE_DOMAINS, ...fromPS])];
    return [
      { value: "all", label: "All domains" },
      ...all.map((d) => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) })),
    ];
  }, [initialProblemStatements]);

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
    setPage(0);
  };

  const selectProblemStatement = (id: string | null) => {
    triggerFilter(() => setSelectedPS(id));
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("ps", id);
    else url.searchParams.delete("ps");
    window.history.replaceState(null, "", url);
  };

  const selectClass =
    "rounded-md border border-stone-200 bg-white px-2.5 py-2 text-sm text-stone-700 focus:border-stone-600 focus:outline-none focus:ring-1 focus:ring-stone-600";

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="type-title mb-6 text-stone-900">Explore Hypotheses</h1>

        {/* Filters */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <label htmlFor="explore-search" className="sr-only">
              Search hypotheses
            </label>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-stone-600" />
            <input
              id="explore-search"
              type="search"
              autoComplete="off"
              placeholder="Search hypotheses"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-stone-200 bg-white py-2 pr-3 pl-8 text-sm text-stone-700 placeholder-stone-500 focus:border-stone-600 focus:ring-1 focus:ring-stone-600 focus:outline-none"
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
          <div role="group" aria-label="Filter by problem statement" className="flex gap-1.5 pb-1">
            <button
              type="button"
              onClick={() => selectProblemStatement(null)}
              aria-pressed={selectedPS === null}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedPS === null
                  ? "bg-stone-900 text-white"
                  : "bg-white text-stone-600 ring-1 ring-stone-300 hover:text-stone-900 hover:ring-stone-400"
              }`}
            >
              All
            </button>
            {initialProblemStatements.map((ps) => (
              <button
                key={ps.id}
                type="button"
                onClick={() => selectProblemStatement(ps.id)}
                aria-pressed={selectedPS === ps.id}
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selectedPS === ps.id
                    ? "bg-stone-900 text-white"
                    : "bg-white text-stone-600 ring-1 ring-stone-300 hover:text-stone-900 hover:ring-stone-400"
                }`}
              >
                {ps.question}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div role="status" className="flex justify-center py-16">
            <span className="sr-only">Loading hypotheses</span>
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
          </div>
        ) : error ? (
          <div role="alert" className="py-8 text-center">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setRetry((value) => value + 1)}
              className={selectClass}
            >
              Retry
            </button>
          </div>
        ) : hypothesesData.length > 0 ? (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {hypothesesData.map((hypothesis) => (
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
            <p className="text-sm text-stone-600">Be the first &mdash; submit one.</p>
          </div>
        )}
        {!error && (
          <nav
            aria-label="Hypothesis pagination"
            className="mt-6 flex items-center justify-center gap-4"
          >
            <button
              type="button"
              disabled={loading || page === 0}
              onClick={() => setPage((value) => value - 1)}
              className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Previous page
            </button>
            <p
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="text-sm text-stone-600"
            >
              {loading
                ? "Loading…"
                : `Page ${page + 1} of ${Math.max(1, Math.ceil(total / PAGE_SIZE))} · ${total} hypotheses`}
            </p>
            <button
              type="button"
              disabled={loading || (page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage((value) => value + 1)}
              className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Next page
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}

export function ExploreContent(props: ExploreContentProps) {
  return <ExploreContentInner {...props} />;
}
