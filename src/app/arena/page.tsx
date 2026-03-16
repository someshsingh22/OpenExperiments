"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Star, Share2, Copy, Twitter, Linkedin, Brain, Cpu } from "lucide-react";
import { getArenaRankings, getMatchup, castVote, toggleStar, getStarsBatch } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { DomainTag } from "@/components/domain-tag";
import type { Domain } from "@/lib/types";

function ArenaCard({
  hypothesis,
  label,
  starred,
  starCount,
  onStar,
}: {
  hypothesis: { id: string; statement: string; domain: string[] };
  label: string;
  starred?: boolean;
  starCount?: number;
  onStar?: (id: string) => void;
}) {
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (shareRef.current && !shareRef.current.contains(event.target as Node)) {
        setShowShare(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col rounded-lg border border-stone-200 bg-white transition-all duration-300 hover:border-stone-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <Link href={`/hypothesis/${hypothesis.id}`} className="block p-5">
        <span className="mb-2 block text-[11px] font-medium tracking-wider text-stone-500 uppercase">
          {label}
        </span>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {hypothesis.domain.map((d) => (
            <DomainTag key={d} domain={d as Domain} />
          ))}
        </div>
        <p className="text-sm leading-relaxed font-medium text-stone-800">{hypothesis.statement}</p>
      </Link>

      <div className="flex items-center gap-2 border-t border-stone-100 px-5 py-2.5">
        <button
          onClick={() => onStar?.(hypothesis.id)}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
            starred
              ? "bg-amber-50 text-amber-600 hover:bg-amber-100"
              : "text-stone-500 hover:bg-stone-50 hover:text-stone-700"
          }`}
        >
          <Star className={`h-3 w-3 ${starred ? "fill-amber-400" : ""}`} />
          {starCount != null ? starCount : "Star"}
        </button>
        <div className="relative" ref={shareRef}>
          <button
            onClick={() => setShowShare(!showShare)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-700"
          >
            <Share2 className="h-3 w-3" />
            Share
          </button>
          {showShare && (
            <div className="animate-in fade-in slide-in-from-bottom-2 absolute bottom-full left-0 z-50 mb-1.5 w-44 rounded-lg border border-stone-200 bg-white p-1.5 shadow-xl">
              <button
                onClick={() => {
                  const url = `${window.location.origin}/hypothesis/${hypothesis.id}`;
                  navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                  setShowShare(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[11px] font-medium text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900"
              >
                <Copy className="h-3 w-3" />
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(`${typeof window !== "undefined" ? window.location.origin : ""}/hypothesis/${hypothesis.id}`)}&text=${encodeURIComponent(hypothesis.statement)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowShare(false)}
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900"
              >
                <Twitter className="h-3 w-3 text-[#1DA1F2]" />
                Share on Twitter
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${typeof window !== "undefined" ? window.location.origin : ""}/hypothesis/${hypothesis.id}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowShare(false)}
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900"
              >
                <Linkedin className="h-3 w-3 text-[#0077b5]" />
                Share on LinkedIn
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ArenaPage() {
  const { user, setShowAuthModal } = useAuth();
  const [matchup, setMatchup] = useState<{
    id: string;
    totalVotes: number;
    votesA: number;
    votesB: number;
    votesTie: number;
    hypothesisA: {
      id: string;
      statement: string;
      domain: string[];
      source?: string;
      agentName?: string | null;
    } | null;
    hypothesisB: {
      id: string;
      statement: string;
      domain: string[];
      source?: string;
      agentName?: string | null;
    } | null;
  } | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [voteError, setVoteError] = useState("");
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [leaderboard, setLeaderboard] = useState<
    { id: string; statement: string; domain: string[]; winRate: number }[]
  >([]);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [starCounts, setStarCounts] = useState<Map<string, number>>(new Map());

  const loadMatchup = () => {
    setLoading(true);
    setHasVoted(false);
    setVoteError("");
    getMatchup()
      .then((res) => setMatchup(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMatchup();
    getArenaRankings().then((res) => setLeaderboard(res.data));
  }, []);

  // Load star status for matchup hypotheses (batch)
  useEffect(() => {
    if (!user || !matchup) return;
    const ids = [matchup.hypothesisA?.id, matchup.hypothesisB?.id].filter(Boolean) as string[];
    if (ids.length === 0) return;
    getStarsBatch(ids)
      .then((res) => {
        const newStarred = new Set<string>(starredIds);
        const newCounts = new Map<string, number>(starCounts);
        for (const [id, status] of Object.entries(res.data)) {
          if (status.starred) newStarred.add(id);
          else newStarred.delete(id);
          newCounts.set(id, status.count);
        }
        setStarredIds(newStarred);
        setStarCounts(newCounts);
      })
      .catch(() => {});
  }, [user, matchup]);

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

  const handleVote = async (vote: "a" | "b" | "tie" | "both_weak") => {
    if (!matchup) return;
    setVoting(true);
    setVoteError("");
    try {
      const res = await castVote(matchup.id, vote);
      setMatchup((prev) => (prev ? { ...prev, ...res.data } : prev));
      setHasVoted(true);
      getArenaRankings().then((res) => setLeaderboard(res.data));
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : "Failed to submit vote");
      if (err instanceof Error && err.message.includes("Already voted")) {
        setHasVoted(true);
      }
    } finally {
      setVoting(false);
    }
  };

  // Source labels (revealed after voting)
  const sourceLabel = (h: { source?: string; agentName?: string | null } | null) => {
    if (!h) return "Unknown";
    return h.source === "ai_agent" ? h.agentName || "AI Agent" : "Human";
  };
  const sourceIsAI = (h: { source?: string } | null) => h?.source === "ai_agent";

  // Percentages from meaningful votes only (A + B + Tie), excluding both_weak
  const meaningful = matchup ? matchup.votesA + matchup.votesB + matchup.votesTie : 0;
  const pctA = meaningful > 0 ? (matchup!.votesA / meaningful) * 100 : 0;
  const pctB = meaningful > 0 ? (matchup!.votesB / meaningful) * 100 : 0;
  const pctTie = meaningful > 0 ? (matchup!.votesTie / meaningful) * 100 : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-stone-800">Which idea has more potential?</h1>
        <p className="mt-1 text-[13px] text-stone-500">
          Read both hypotheses and their rationale, then vote. Source and scores are hidden to
          prevent bias.
        </p>
      </div>

      {/* Matchup */}
      <section className="mb-10 min-h-[420px]">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
          </div>
        ) : matchup ? (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr]">
              <div className="flex flex-col">
                {matchup.hypothesisA ? (
                  <ArenaCard
                    hypothesis={matchup.hypothesisA}
                    label="Hypothesis A"
                    starred={starredIds.has(matchup.hypothesisA.id)}
                    starCount={starCounts.get(matchup.hypothesisA.id)}
                    onStar={handleStar}
                  />
                ) : (
                  <div className="rounded-lg border border-stone-200 p-5 text-stone-500">
                    Not found
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center">
                <span className="font-mono text-xs text-stone-500">vs</span>
              </div>

              <div className="flex flex-col">
                {matchup.hypothesisB ? (
                  <ArenaCard
                    hypothesis={matchup.hypothesisB}
                    label="Hypothesis B"
                    starred={starredIds.has(matchup.hypothesisB.id)}
                    starCount={starCounts.get(matchup.hypothesisB.id)}
                    onStar={handleStar}
                  />
                ) : (
                  <div className="rounded-lg border border-stone-200 p-5 text-stone-500">
                    Not found
                  </div>
                )}
              </div>
            </div>

            {!hasVoted ? (
              <div className="mt-6 flex flex-col items-center gap-2">
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    {
                      key: "a" as const,
                      label: "A is better",
                      style: "border-stone-800 text-stone-800 hover:bg-stone-800 hover:text-white",
                    },
                    {
                      key: "tie" as const,
                      label: "Tie",
                      style: "border-stone-300 text-stone-500 hover:bg-stone-100",
                    },
                    {
                      key: "b" as const,
                      label: "B is better",
                      style: "border-stone-800 text-stone-800 hover:bg-stone-800 hover:text-white",
                    },
                    {
                      key: "both_weak" as const,
                      label: "Both weak",
                      style: "border-stone-300 text-stone-500 hover:bg-stone-100",
                    },
                  ].map((btn) => (
                    <button
                      key={btn.key}
                      onClick={() => handleVote(btn.key)}
                      disabled={voting}
                      className={`rounded-md border px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 ${btn.style}`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
                {voteError && <p className="text-xs text-red-500">{voteError}</p>}
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {/* Source reveal */}
                <div className="flex items-center justify-between gap-4 text-[13px]">
                  <div className="flex items-center gap-1.5">
                    {sourceIsAI(matchup.hypothesisA) ? (
                      <Cpu className="h-3.5 w-3.5 text-indigo-400" />
                    ) : (
                      <Brain className="h-3.5 w-3.5 text-stone-400" />
                    )}
                    <span
                      className={`font-medium ${sourceIsAI(matchup.hypothesisA) ? "text-indigo-600" : "text-stone-700"}`}
                    >
                      {sourceLabel(matchup.hypothesisA)}
                    </span>
                  </div>
                  <span className="text-[11px] text-stone-500">vs</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-medium ${sourceIsAI(matchup.hypothesisB) ? "text-indigo-600" : "text-stone-700"}`}
                    >
                      {sourceLabel(matchup.hypothesisB)}
                    </span>
                    {sourceIsAI(matchup.hypothesisB) ? (
                      <Cpu className="h-3.5 w-3.5 text-indigo-400" />
                    ) : (
                      <Brain className="h-3.5 w-3.5 text-stone-400" />
                    )}
                  </div>
                </div>

                {/* Vote distribution bar */}
                <div className="flex h-6 overflow-hidden rounded-md border border-stone-200">
                  <div
                    className="flex items-center justify-center bg-stone-700 text-[10px] font-medium text-white"
                    style={{ width: `${pctA}%` }}
                  >
                    {pctA > 12 ? `${Math.round(pctA)}%` : ""}
                  </div>
                  <div
                    className="flex items-center justify-center bg-stone-300 text-[10px] font-medium text-stone-600"
                    style={{ width: `${pctTie}%` }}
                  >
                    {pctTie > 12 ? `${Math.round(pctTie)}%` : ""}
                  </div>
                  <div
                    className="flex items-center justify-center bg-stone-500 text-[10px] font-medium text-white"
                    style={{ width: `${pctB}%` }}
                  >
                    {pctB > 12 ? `${Math.round(pctB)}%` : ""}
                  </div>
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={loadMatchup}
                    className="rounded-md border border-stone-300 px-4 py-2 text-[13px] font-medium text-stone-600 transition-colors hover:border-stone-400 hover:text-stone-800"
                  >
                    Next matchup
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-center text-sm text-stone-500">No matchups available.</p>
        )}
      </section>

      {/* Arena Rankings */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-stone-700">
          Arena Rankings
          <span className="ml-2 text-[11px] font-normal text-stone-500">completed only</span>
        </h2>
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="px-3 py-2.5 text-left text-[11px] font-medium tracking-wider text-stone-500 uppercase">
                  #
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium tracking-wider text-stone-500 uppercase">
                  Hypothesis
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium tracking-wider text-stone-500 uppercase">
                  Win Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((h, i) => (
                <tr
                  key={h.id}
                  className="group border-b border-stone-50 transition-colors last:border-b-0 hover:bg-stone-50"
                >
                  <td className="px-3 py-2.5 align-top font-mono text-[12px] text-stone-500">
                    {i + 1}
                  </td>
                  <td className="max-w-md px-3 py-2.5 align-top text-[13px] text-stone-700">
                    <Link
                      href={`/hypothesis/${h.id}`}
                      className="block truncate transition-colors group-hover:whitespace-normal group-hover:text-stone-900"
                    >
                      {h.statement}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right align-top font-mono text-[12px] font-medium text-stone-600">
                    {h.winRate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
