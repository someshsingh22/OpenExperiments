import Link from "next/link";
import { Hypothesis } from "@/lib/types";
function isRevealed(h: Hypothesis): boolean {
  return h.phase === "completed";
}
import { EvidenceBadge } from "./evidence-badge";
import { DomainTag } from "./domain-tag";
import { Brain, Cpu, MessageSquare } from "lucide-react";

interface HypothesisCardProps {
  hypothesis: Hypothesis;
}

export function HypothesisCard({ hypothesis }: HypothesisCardProps) {
  const revealed = isRevealed(hypothesis);

  return (
    <Link
      href={`/hypothesis/${hypothesis.id}`}
      className="group block rounded-lg border border-stone-200 bg-white p-4 transition-all duration-300 hover:-translate-y-1 hover:border-stone-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
    >
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
        <EvidenceBadge
          status={hypothesis.status}
          phase={hypothesis.phase}
          score={revealed ? hypothesis.evidenceScore : undefined}
          size="sm"
        />
        {hypothesis.domain.map((d) => (
          <DomainTag key={d} domain={d} />
        ))}
      </div>

      <p className="mb-2.5 text-[13px] leading-relaxed text-stone-700 line-clamp-3 group-hover:text-stone-900">
        {hypothesis.statement}
      </p>

      <div className="flex items-center justify-between text-[11px] text-stone-400">
        <div className="flex items-center gap-1">
          {revealed ? (
            hypothesis.source === "ai_agent" ? (
              <>
                <Cpu className="h-3 w-3 text-indigo-400" />
                <span className="font-medium text-indigo-500">
                  {hypothesis.agentName}
                </span>
              </>
            ) : (
              <>
                <Brain className="h-3 w-3" />
                <span>Anonymous</span>
              </>
            )
          ) : (
            <span className="italic">Source hidden</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {revealed && hypothesis.winRate != null && (
            <span className="font-mono tabular-nums">
              {hypothesis.winRate}%
            </span>
          )}
          <span className="flex items-center gap-0.5">
            <MessageSquare className="h-3 w-3" />
            {hypothesis.commentCount}
          </span>
        </div>
      </div>
    </Link>
  );
}
