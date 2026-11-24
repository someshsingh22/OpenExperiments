import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Hypothesis } from "@/lib/types";
function isRevealed(h: Hypothesis): boolean {
  return h.phase === "completed";
}
import { EvidenceBadge } from "./evidence-badge";
import { DomainTag } from "./domain-tag";
import {
  Brain,
  Cpu,
  MessageSquare,
  Star,
  Share2,
  Copy,
  Twitter,
  Linkedin,
  FileText,
} from "lucide-react";

// Expands the touch target to >=44px without changing the visual size of compact buttons.
const hitArea =
  "relative before:absolute before:-inset-x-1 before:-inset-y-2.5 before:content-['']";

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
  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const shareMenuId = `share-menu-${hypothesis.id}`;

  useEffect(() => {
    if (!showShare) return;

    function handleClickOutside(event: MouseEvent) {
      if (shareRef.current && !shareRef.current.contains(event.target as Node)) {
        setShowShare(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showShare]);

  return (
    <div className="group relative rounded-lg border border-stone-200 bg-white p-4 transition-all duration-300 hover:-translate-y-1 hover:border-stone-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <Link href={`/hypothesis/${hypothesis.id}`} className="block">
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <EvidenceBadge status={hypothesis.status} phase={hypothesis.phase} size="sm" />
          {hypothesis.domain.map((d) => (
            <DomainTag key={d} domain={d} />
          ))}
        </div>

        <p className="type-statement mb-3 line-clamp-3 text-base leading-snug text-stone-900">
          {hypothesis.statement}
        </p>

        <div className="flex items-center justify-between text-xs text-stone-600">
          <div className="flex items-center gap-1">
            {revealed ? (
              hypothesis.source === "ai_agent" ? (
                <>
                  <Cpu className="h-3 w-3 text-indigo-700" />
                  <span className="font-medium text-indigo-700">{hypothesis.agentName}</span>
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
              <span className="type-data">{hypothesis.winRate}%</span>
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
          type="button"
          aria-label={
            starCount != null ? `Star hypothesis (${starCount} stars)` : "Star hypothesis"
          }
          aria-pressed={!!starred}
          className={`${hitArea} inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
            starred
              ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
              : "text-stone-600 hover:bg-stone-50 hover:text-stone-700"
          }`}
        >
          <Star className={`h-3 w-3 ${starred ? "fill-amber-400" : ""}`} />
          {starCount != null ? starCount : "Star"}
        </button>
        <div
          className="relative"
          ref={shareRef}
          onKeyDown={(e) => {
            if (e.key === "Escape" && showShare) {
              e.stopPropagation();
              setShowShare(false);
              shareButtonRef.current?.focus();
            }
          }}
        >
          <button
            ref={shareButtonRef}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowShare(!showShare);
            }}
            aria-label="Share hypothesis"
            aria-expanded={showShare}
            aria-controls={showShare ? shareMenuId : undefined}
            className={`${hitArea} inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-700`}
          >
            <Share2 className="h-3 w-3" />
            Share
          </button>
          {showShare && (
            <div
              id={shareMenuId}
              className="animate-in fade-in slide-in-from-bottom-2 absolute bottom-full left-0 z-50 mb-1.5 w-44 rounded-lg border border-stone-200 bg-white p-1.5 shadow-xl"
            >
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
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900"
              >
                <Copy className="h-3 w-3" />
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const author =
                    hypothesis.source === "ai_agent"
                      ? (hypothesis.agentName ?? "AI Agent")
                      : "OpenExperiments User(s)";
                  const year = new Date(hypothesis.submittedAt).getFullYear();
                  const bibId = hypothesis.id.replace(/-/g, "_");
                  const bibtex = `@misc{openexperiments_${bibId},\n  title = {${hypothesis.statement}},\n  author = {${author}},\n  year = {${year}},\n  howpublished = {\\url{${window.location.origin}/hypothesis/${hypothesis.id}}},\n  note = {Accessed: ${new Date().toISOString().split("T")[0]}}\n}`;
                  navigator.clipboard.writeText(bibtex);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                  setShowShare(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900"
              >
                <FileText className="h-3 w-3" />
                Copy BibTeX
              </button>
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(`${typeof window !== "undefined" ? window.location.origin : ""}/hypothesis/${hypothesis.id}`)}&text=${encodeURIComponent(hypothesis.statement)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowShare(false);
                }}
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900"
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
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900"
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
