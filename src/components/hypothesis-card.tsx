import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Hypothesis } from "@/lib/types";
function isRevealed(h: Hypothesis): boolean {
  return h.phase === "completed";
}
import { EvidenceBadge } from "./evidence-badge";
import { DomainTag } from "./domain-tag";
import { Brain, Cpu, MessageSquare, Star, Share2, Copy, Twitter, Linkedin } from "lucide-react";

interface HypothesisCardProps {
  hypothesis: Hypothesis;
  onStar?: (id: string) => void;
  starred?: boolean;
  starCount?: number;
}

export function HypothesisCard({ hypothesis, onStar, starred, starCount }: HypothesisCardProps) {
  const revealed = isRevealed(hypothesis);
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
    <div className="group relative rounded-lg border border-stone-200 bg-white p-4 transition-all duration-300 hover:-translate-y-1 hover:border-stone-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <Link
        href={`/hypothesis/${hypothesis.id}`}
        className="block"
      >
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <EvidenceBadge
            status={hypothesis.status}
            phase={hypothesis.phase}
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

      {/* Action buttons */}
      <div className="mt-2.5 flex items-center gap-2 border-t border-stone-100 pt-2.5">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onStar) onStar(hypothesis.id);
          }}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
            starred
              ? "bg-amber-50 text-amber-600 hover:bg-amber-100"
              : "text-stone-400 hover:bg-stone-50 hover:text-stone-600"
          }`}
        >
          <Star className={`h-3 w-3 ${starred ? "fill-amber-400" : ""}`} />
          {starCount != null ? starCount : "Star"}
        </button>
        <div className="relative" ref={shareRef}>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowShare(!showShare);
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-stone-400 transition-colors hover:bg-stone-50 hover:text-stone-600"
          >
            <Share2 className="h-3 w-3" />
            Share
          </button>
          {showShare && (
            <div className="absolute bottom-full left-0 z-50 mb-1.5 w-44 rounded-lg border border-stone-200 bg-white p-1.5 shadow-xl animate-in fade-in slide-in-from-bottom-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
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
                onClick={(e) => {
                  e.stopPropagation();
                  setShowShare(false);
                }}
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900"
              >
                <Twitter className="h-3 w-3 text-[#1DA1F2]" />
                Share on Twitter
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${typeof window !== "undefined" ? window.location.origin : ""}/hypothesis/${hypothesis.id}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowShare(false);
                }}
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
