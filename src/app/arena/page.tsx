"use client";

import { useState, useEffect } from "react";
import { getArenaRankings, getMatchup, castVote } from "@/lib/api";
import { DomainTag } from "@/components/domain-tag";
import type { Domain } from "@/lib/types";

function ArenaCard({
  hypothesis,
  label,
}: {
  hypothesis: { id: string; statement: string; domain: string[] };
  label: string;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-stone-200 bg-white p-5">
      <span className="mb-2 text-[11px] font-medium uppercase tracking-wider text-stone-300">
        {label}
      </span>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {hypothesis.domain.map((d) => (
          <DomainTag key={d} domain={d as Domain} />
        ))}
      </div>
      <p className="mb-3 text-sm font-medium leading-relaxed text-stone-800">
        {hypothesis.statement}
      </p>
    </div>
  );
}

export default function ArenaPage() {
  const [matchup, setMatchup] = useState<{
    id: string;
    totalVotes: number;
    votesA: number;
    votesB: number;
    votesTie: number;
    hypothesisA: { id: string; statement: string; domain: string[] } | null;
    hypothesisB: { id: string; statement: string; domain: string[] } | null;
  } | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [voteError, setVoteError] = useState("");
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [leaderboard, setLeaderboard] = useState<{ id: string; statement: string; domain: string[]; winRate: number }[]>([]);

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

  const handleVote = async (vote: "a" | "b" | "tie" | "both_weak") => {
    if (!matchup) return;
    setVoting(true);
    setVoteError("");
    try {
      const res = await castVote(matchup.id, vote);
      setMatchup((prev) =>
        prev ? { ...prev, ...res.data } : prev
      );
      setHasVoted(true);
      // Refresh leaderboard after voting
      getArenaRankings().then((res) => setLeaderboard(res.data));
    } catch (err) {
      setVoteError(
        err instanceof Error ? err.message : "Failed to submit vote"
      );
      // If already voted, show results anyway
      if (err instanceof Error && err.message.includes("Already voted")) {
        setHasVoted(true);
      }
    } finally {
      setVoting(false);
    }
  };

  const pctA =
    matchup && matchup.totalVotes > 0
      ? (matchup.votesA / matchup.totalVotes) * 100
      : 0;
  const pctB =
    matchup && matchup.totalVotes > 0
      ? (matchup.votesB / matchup.totalVotes) * 100
      : 0;
  const pctTie =
    matchup && matchup.totalVotes > 0
      ? (matchup.votesTie / matchup.totalVotes) * 100
      : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-stone-800">
          Which idea has more potential?
        </h1>
        <p className="mt-1 text-[13px] text-stone-400">
          Read both hypotheses and their rationale, then vote. Source and scores
          are hidden to prevent bias.
        </p>
      </div>

      {/* Matchup */}
      <section className="mb-10">
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
                  />
                ) : (
                  <div className="rounded-lg border border-stone-200 p-5 text-stone-400">
                    Not found
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center">
                <span className="font-mono text-xs text-stone-300">vs</span>
              </div>

              <div className="flex flex-col">
                {matchup.hypothesisB ? (
                  <ArenaCard
                    hypothesis={matchup.hypothesisB}
                    label="Hypothesis B"
                  />
                ) : (
                  <div className="rounded-lg border border-stone-200 p-5 text-stone-400">
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
                      style:
                        "border-stone-800 text-stone-800 hover:bg-stone-800 hover:text-white",
                    },
                    {
                      key: "tie" as const,
                      label: "Tie",
                      style:
                        "border-stone-300 text-stone-500 hover:bg-stone-100",
                    },
                    {
                      key: "b" as const,
                      label: "B is better",
                      style:
                        "border-stone-800 text-stone-800 hover:bg-stone-800 hover:text-white",
                    },
                    {
                      key: "both_weak" as const,
                      label: "Both weak",
                      style:
                        "border-stone-300 text-stone-400 hover:bg-stone-100",
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
                {voteError && (
                  <p className="text-xs text-red-500">{voteError}</p>
                )}
              </div>
            ) : (
              <div className="mt-6 space-y-3">
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
          <p className="text-center text-sm text-stone-400">
            No matchups available.
          </p>
        )}
      </section>

      {/* Arena Rankings */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-stone-700">
          Arena Rankings
          <span className="ml-2 text-[11px] font-normal text-stone-400">
            completed only
          </span>
        </h2>
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-stone-400">
                  #
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-stone-400">
                  Hypothesis
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-stone-400">
                  Win Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((h, i) => (
                <tr
                  key={h.id}
                  className="border-b border-stone-50 last:border-b-0"
                >
                  <td className="px-3 py-2.5 font-mono text-[12px] text-stone-400">
                    {i + 1}
                  </td>
                  <td className="max-w-md truncate px-3 py-2.5 text-[13px] text-stone-700">
                    {h.statement}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] font-medium text-stone-600">
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
