"use client";

import { useParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  Brain,
  Cpu,
  Calendar,
  ExternalLink,
  MessageSquare,
  FlaskConical,
  TrendingUp,
  Lock,
  ArrowRight,
  Share2,
  Copy,
  Twitter,
  Linkedin,
  Plus,
  Link2,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { getHypothesis, getHypotheses, addCitation, postComment } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { EvidenceBadge } from "@/components/evidence-badge";
import { DomainTag } from "@/components/domain-tag";
import { HypothesisCard } from "@/components/hypothesis-card";
import type { Hypothesis, Experiment, Comment, Domain } from "@/lib/types";
import { SITE_CONFIG } from "@/lib/constants";

const EXP_TYPE_LABELS: Record<Experiment["type"], { label: string; cls: string }> = {
  observational: { label: "Observational", cls: "bg-stone-50 text-stone-600 ring-stone-200" },
  survey: { label: "Survey", cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  ab_test: { label: "A/B Test", cls: "bg-teal-50 text-teal-700 ring-teal-200" },
  pre_registered: { label: "Pre-registered", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
};

const EXP_STATUS_LABELS: Record<Experiment["status"], { label: string; cls: string }> = {
  running: { label: "Running", cls: "bg-sky-50 text-sky-600 ring-sky-200" },
  completed: { label: "Completed", cls: "bg-teal-50 text-teal-600 ring-teal-200" },
  planned: { label: "Planned", cls: "bg-stone-50 text-stone-500 ring-stone-200" },
};

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function doiUrl(doi: string): string {
  return `https://doi.org/${doi.replace(/^https?:\/\//, "").replace("doi.org/", "")}`;
}

function generateBibtex(h: Hypothesis): string {
  const author = h.source === "ai_agent" ? h.agentName ?? "AI Agent" : "Anonymous";
  const year = new Date(h.submittedAt).getFullYear();
  const id = h.id.replace(/-/g, "_");
  const siteUrl = SITE_CONFIG.links.github.replace("https://github.com/someshsingh22/EvidenceR1", "https://openexperiments.ai");
  return `@misc{openexperiments_${id},
  title = {${h.statement}},
  author = {${author}},
  year = {${year}},
  howpublished = {\\url{${siteUrl}/hypothesis/${h.id}}},
  note = {Accessed: ${new Date().toISOString().split("T")[0]}}
}`;
}

function isRevealed(h: Hypothesis): boolean {
  return h.phase === "completed";
}

export default function HypothesisDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [activeTab, setActiveTab] = useState<"community" | "evidence" | "experiments">("community");
  const [showShare, setShowShare] = useState(false);
  const [copying, setCopying] = useState(false);
  const [arxivLink, setArxivLink] = useState("");
  const [citationError, setCitationError] = useState("");
  const shareRef = useRef<HTMLDivElement>(null);

  const [hypothesis, setHypothesis] = useState<Hypothesis | null>(null);
  const [hExperiments, setExperiments] = useState<Experiment[]>([]);
  const [hComments, setComments] = useState<Comment[]>([]);
  const [related, setRelated] = useState<Hypothesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentDoi, setCommentDoi] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const { user, setShowAuthModal } = useAuth();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (shareRef.current && !shareRef.current.contains(event.target as Node)) {
        setShowShare(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setLoading(true);
    getHypothesis(id)
      .then(async (res) => {
        setHypothesis(res.data);
        setExperiments(res.experiments);
        setComments(res.comments);

        // Fetch related hypotheses
        if (res.data.relatedHypothesisIds.length > 0) {
          const allHyps = await getHypotheses({ limit: 50 });
          const relatedHyps = allHyps.data.filter((h) =>
            res.data.relatedHypothesisIds.includes(h.id)
          );
          setRelated(relatedHyps);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
      </div>
    );
  }

  if (notFound || !hypothesis) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="mb-1 text-lg font-semibold text-stone-800">Not found</h1>
        <p className="text-sm text-stone-400">This hypothesis does not exist or has been removed.</p>
      </div>
    );
  }

  const revealed = isRevealed(hypothesis);
  const completedExp = hExperiments.find((e) => e.status === "completed");
  const abWithUplift = hExperiments.find((e) => e.type === "ab_test" && e.results?.uplift);

  const tabClass = (t: string) =>
    `pb-2.5 text-sm font-medium transition-colors ${activeTab === t
      ? "border-b-2 border-stone-800 text-stone-800"
      : "text-stone-400 hover:text-stone-600"
    }`;

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Header */}
        <header className="mb-8">
          <div className="mb-3">
            <EvidenceBadge
              status={hypothesis.status}
              phase={hypothesis.phase}
              size="lg"
            />
          </div>
          <h1 className="mb-4 text-2xl font-semibold leading-snug text-stone-900 sm:text-3xl">
            {hypothesis.statement}
          </h1>
          <div className="flex flex-wrap items-center gap-1.5">
            {hypothesis.domain.map((d) => <DomainTag key={d} domain={d as Domain} size="md" />)}
            <div className="relative ml-auto" ref={shareRef}>
              <button
                onClick={() => setShowShare(!showShare)}
                className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 transition-all hover:border-stone-400 hover:text-stone-900"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share
              </button>

              {showShare && (
                <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-stone-200 bg-white p-2 shadow-xl animate-in fade-in slide-in-from-top-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      setCopying(true);
                      setTimeout(() => setCopying(false), 2000);
                      setShowShare(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copying ? "Copied!" : "Copy Link"}
                  </button>
                  <a
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}&text=${encodeURIComponent(hypothesis.statement)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowShare(false)}
                    className="flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900"
                  >
                    <Twitter className="h-3.5 w-3.5 text-[#1DA1F2]" />
                    Share on Twitter
                  </a>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowShare(false)}
                    className="flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900"
                  >
                    <Linkedin className="h-3.5 w-3.5 text-[#0077b5]" />
                    Share on LinkedIn
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-stone-500">
            {revealed ? (
              <span className="flex items-center gap-1">
                {hypothesis.source === "ai_agent" ? (
                  <>
                    <Cpu className="h-4 w-4 text-indigo-400" />
                    <span className="font-medium text-indigo-500">{hypothesis.agentName ?? "AI Agent"}</span>
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4" />
                    <span>Human</span>
                  </>
                )}
              </span>
            ) : (
              <span className="flex items-center gap-1 italic text-stone-400">
                <Lock className="h-3.5 w-3.5" /> Source hidden during evaluation
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {fmtDate(hypothesis.submittedAt)}
            </span>
          </div>
          {hypothesis.problemStatement && (
            <p className="mt-2 text-sm text-stone-500">
              Problem: {hypothesis.problemStatement}
            </p>
          )}
          <div className="mt-6 flex flex-col gap-6">
            <div>
              <p className="mb-2 text-sm font-medium text-stone-600">
                Are you a Social Scientist or Experimenter?
              </p>
              <Link
                href="/experiments"
                className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-5 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900"
              >
                Submit an Experiment
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="w-full">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">BibTeX Citation</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generateBibtex(hypothesis));
                    setCopying(true);
                    setTimeout(() => setCopying(false), 2000);
                  }}
                  className="text-xs font-bold text-stone-400 hover:text-stone-700"
                >
                  {copying ? "COPIED" : "COPY"}
                </button>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
                <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-stone-700">
                  {generateBibtex(hypothesis)}
                </pre>
              </div>
            </div>
          </div>
        </header>

        {/* Rationale */}
        <section className="mb-8 rounded-lg border border-stone-200 bg-stone-50/50 p-5">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-500">
            Rationale
          </h2>
          <p className="text-base leading-relaxed text-stone-700">{hypothesis.rationale}</p>
        </section>

        {/* Live notice */}
        {!revealed && (
          <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-700">
            This hypothesis is currently live. Evidence, scores, and source identity will be revealed once evaluation completes.
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex gap-5 border-b border-stone-200">
            <button onClick={() => setActiveTab("community")} className={tabClass("community")}>
              <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Community</span>
            </button>
            {revealed && (
              <>
                <button onClick={() => setActiveTab("evidence")} className={tabClass("evidence")}>
                  <span className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Evidence</span>
                </button>
                <button onClick={() => setActiveTab("experiments")} className={tabClass("experiments")}>
                  <span className="flex items-center gap-1.5"><FlaskConical className="h-3.5 w-3.5" /> Experiments</span>
                </button>
              </>
            )}
          </div>

          <div className="mt-5">
            {/* Community */}
            {activeTab === "community" && (
              <div className="space-y-5">
                {revealed && hypothesis.winRate != null && (
                  <div className="rounded-lg border border-stone-200 bg-white p-5">
                    <h3 className="mb-2 text-sm font-medium text-stone-600">Arena Win Rate</h3>
                    <div className="mb-2 flex items-baseline gap-2">
                      <span className="font-mono text-3xl font-semibold text-stone-800">{hypothesis.winRate}%</span>
                      <span className="text-sm text-stone-400">win rate</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div className="h-full rounded-full bg-stone-600 transition-all" style={{ width: `${hypothesis.winRate}%` }} />
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="mb-3 text-sm font-medium text-stone-600">Discussion</h3>
                  <div className="space-y-2">
                    {hComments.length > 0 ? (
                      hComments.filter((c) => !c.parentId).map((root) => (
                        <CommentThread
                          key={root.id}
                          comment={root}
                          allComments={hComments}
                          hypothesisId={id}
                          user={user}
                          onReply={(c) => setComments((prev) => [...prev, c])}
                          setShowAuthModal={setShowAuthModal}
                        />
                      ))
                    ) : (
                      <p className="text-sm text-stone-400">No comments yet.</p>
                    )}
                  </div>
                  <div className="mt-4">
                    {user ? (
                      <div>
                        <textarea
                          placeholder="Add a comment..."
                          rows={2}
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          className="mb-2 w-full rounded-md border border-stone-200 px-3 py-2 text-sm text-stone-700 placeholder-stone-300 focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-300"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            disabled={postingComment || !commentText.trim()}
                            onClick={async () => {
                              setPostingComment(true);
                              try {
                                const res = await postComment({
                                  hypothesisId: id,
                                  content: commentText.trim(),
                                  doi: commentDoi || undefined,
                                });
                                setComments((prev) => [...prev, res.data]);
                                setCommentText("");
                                setCommentDoi("");
                              } catch (err) {
                                window.alert(err instanceof Error ? err.message : "Failed to post");
                              } finally {
                                setPostingComment(false);
                              }
                            }}
                            className="rounded-md border border-stone-800 px-3 py-1.5 text-[13px] font-medium text-stone-800 transition-colors hover:bg-stone-800 hover:text-white disabled:opacity-50"
                          >
                            {postingComment ? "Posting..." : "Post"}
                          </button>
                          <input
                            type="text"
                            placeholder="DOI (optional)"
                            value={commentDoi}
                            onChange={(e) => setCommentDoi(e.target.value)}
                            className="rounded-md border border-stone-200 px-2 py-1.5 text-[12px] text-stone-600 placeholder-stone-300 focus:border-stone-400 focus:outline-none"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
                        <p className="text-sm text-stone-400 italic">
                          <button
                            onClick={() => setShowAuthModal(true)}
                            className="font-medium text-stone-600 underline underline-offset-2 hover:text-stone-800"
                          >
                            Sign in
                          </button>
                          {" "}to join the discussion
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Evidence */}
            {activeTab === "evidence" && revealed && (
              <div>
                {(hypothesis.status === "data_tested" || hypothesis.status === "field_validated") && completedExp?.results ? (
                  <div className="space-y-4 rounded-lg border border-stone-200 bg-white p-5">
                    <h3 className="text-sm font-medium text-stone-600">Results</h3>
                    {hypothesis.evidenceScore != null && (
                      <div>
                        <div className="mb-1.5 flex justify-between text-sm">
                          <span className="text-stone-500">Evidence Score</span>
                          <span className="font-medium text-stone-700">{hypothesis.evidenceScore}/100</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                          <div className="h-full rounded-full bg-teal-500" style={{ width: `${hypothesis.evidenceScore}%` }} />
                        </div>
                      </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-3">
                      {completedExp.results.pValue != null && (
                        <div>
                          <p className="text-xs text-stone-400">p-value</p>
                          <p className="font-mono text-sm font-medium text-stone-700">{completedExp.results.pValue.toExponential(2)}</p>
                        </div>
                      )}
                      {completedExp.results.effectSize != null && (
                        <div>
                          <p className="text-xs text-stone-400">Effect Size</p>
                          <p className="font-mono text-sm font-medium text-stone-700">{completedExp.results.effectSize}</p>
                        </div>
                      )}
                      {completedExp.results.confidenceInterval && (
                        <div>
                          <p className="text-xs text-stone-400">95% CI</p>
                          <p className="font-mono text-sm font-medium text-stone-700">
                            [{completedExp.results.confidenceInterval[0].toFixed(2)}, {completedExp.results.confidenceInterval[1].toFixed(2)}]
                          </p>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-stone-400">Methodology</p>
                      <p className="text-sm text-stone-600">{completedExp.methodology}</p>
                    </div>
                    <div className="mt-4 flex gap-3">
                      <Link
                        href={`/procedures/${completedExp.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-stone-900 bg-stone-900 px-4 py-2 text-xs font-medium text-white hover:bg-stone-800"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Detailed Procedures
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-stone-300 p-8 text-center">
                    <p className="text-sm text-stone-400">Not yet tested against observational data.</p>
                  </div>
                )}
              </div>
            )}

            {/* Experiments */}
            {activeTab === "experiments" && revealed && (
              <div className="space-y-4">
                {abWithUplift && (
                  <div className="rounded-md border border-teal-200 bg-teal-50/50 p-4">
                    <div className="mb-0.5 flex items-center gap-1.5 text-teal-700">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-[12px] font-medium">Field Validation</span>
                    </div>
                    <p className="text-2xl font-semibold text-teal-700">{abWithUplift.results?.uplift}</p>
                    <p className="mt-0.5 text-[12px] text-teal-600">uplift in {abWithUplift.datasetName}</p>
                  </div>
                )}
                {hExperiments.length > 0 ? (
                  hExperiments.map((exp) => <ExperimentCard key={exp.id} experiment={exp} />)
                ) : (
                  <p className="text-sm text-stone-400">No experiments yet.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Related & Bibliography */}
        <section className="mb-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.1em] text-stone-500">Related & Bibliography</h2>

          <div className="mb-6">
            <h3 className="mb-3 text-sm font-medium text-stone-800">Similar Ideas</h3>
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              {related.length > 0 ? related.map((h) => (
                <div key={h.id} className="min-w-[260px] max-w-[300px] shrink-0">
                  <HypothesisCard hypothesis={h} />
                </div>
              )) : (
                <p className="text-sm text-stone-400">No related hypotheses found.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-stone-200 bg-stone-50/50 p-5">
            <h3 className="mb-4 text-sm font-medium text-stone-800 flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Bibliography
            </h3>

            <div className="mb-6 space-y-3">
              {hypothesis.citationDois.map((doi) => (
                <div key={doi} className="flex items-start gap-2">
                  <FileText className="h-4 w-4 mt-0.5 text-stone-400" />
                  <a
                    href={doiUrl(doi)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-stone-600 hover:text-stone-900 hover:underline decoration-stone-300"
                  >
                    {doi}
                  </a>
                </div>
              ))}
              {hypothesis.citationDois.length === 0 && (
                <p className="text-sm text-stone-400 italic">No citations added yet.</p>
              )}
            </div>

            <div className="mt-4 border-t border-stone-200 pt-4">
              <p className="mb-1.5 text-sm font-medium text-stone-600">
                If you see this idea in recent arXiv papers, add a link:
              </p>
              <p className="mb-3 text-xs text-stone-400">
                Only arXiv URLs (https://arxiv.org/abs/...) or DOIs (10.xxxx/...) are accepted.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://arxiv.org/abs/xxxx.xxxxx or 10.xxxx/..."
                  value={arxivLink}
                  onChange={(e) => { setArxivLink(e.target.value); setCitationError(""); }}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm text-stone-700 placeholder-stone-300 focus:outline-none ${
                    citationError ? "border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-200" : "border-stone-200 focus:border-stone-400"
                  }`}
                />
                <button
                  onClick={async () => {
                    if (!arxivLink) return;
                    setCitationError("");
                    try {
                      const res = await addCitation(id, arxivLink);
                      setHypothesis((prev) =>
                        prev ? { ...prev, citationDois: res.data.citationDois } : prev
                      );
                      setArxivLink("");
                    } catch (err) {
                      setCitationError(err instanceof Error ? err.message : "Failed to add citation");
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-stone-800 bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </div>
              {citationError && (
                <p className="mt-2 text-sm text-red-600">{citationError}</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function CommentThread({
  comment,
  allComments,
  hypothesisId,
  user,
  onReply,
  setShowAuthModal,
}: {
  comment: any;
  allComments: any[];
  hypothesisId: string;
  user: any;
  onReply: (c: any) => void;
  setShowAuthModal: (v: boolean) => void;
}) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [posting, setPosting] = useState(false);
  const replies = allComments.filter((c: any) => c.parentId === comment.id);
  const author = comment.author;

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setPosting(true);
    try {
      const res = await postComment({
        hypothesisId,
        content: replyText.trim(),
        parentId: comment.id,
      });
      onReply(res.data);
      setReplyText("");
      setReplying(false);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to post reply");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className={comment.parentId ? "ml-4 border-l border-stone-100 pl-3" : ""}>
      <div className="rounded-md border border-stone-100 bg-white px-3.5 py-2.5">
        <div className="mb-1 flex items-center gap-1.5">
          <span className="text-xs font-semibold text-stone-700">
            {author?.name || "Anonymous"}
          </span>
          <span className="text-[11px] text-stone-400">{fmtDate(comment.createdAt)}</span>
        </div>
        <p className="text-sm leading-relaxed text-stone-700">{comment.body}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {comment.doi && (
            <a
              href={doiUrl(comment.doi)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 rounded bg-stone-50 px-1.5 py-0.5 text-[10px] font-medium text-stone-500 hover:text-stone-700"
            >
              <ExternalLink className="h-2.5 w-2.5" />
              {comment.doi}
            </a>
          )}
          {user ? (
            <button
              onClick={() => setReplying(!replying)}
              className="text-[10px] font-medium text-stone-400 hover:text-stone-600"
            >
              Reply
            </button>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="text-[10px] font-medium text-stone-400 hover:text-stone-600"
            >
              Reply
            </button>
          )}
        </div>
      </div>
      {replying && (
        <div className="ml-4 mt-1.5 space-y-1.5">
          <textarea
            placeholder="Write a reply..."
            rows={2}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            className="w-full rounded-md border border-stone-200 px-2.5 py-1.5 text-[12px] text-stone-700 placeholder-stone-300 focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-300"
          />
          <div className="flex gap-1.5">
            <button
              disabled={posting || !replyText.trim()}
              onClick={handleReply}
              className="rounded-md border border-stone-800 px-2.5 py-1 text-[11px] font-medium text-stone-800 hover:bg-stone-800 hover:text-white disabled:opacity-50"
            >
              {posting ? "Posting..." : "Post"}
            </button>
            <button
              onClick={() => { setReplying(false); setReplyText(""); }}
              className="rounded-md px-2.5 py-1 text-[11px] text-stone-400 hover:text-stone-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {replies.length > 0 && (
        <div className="mt-1.5 space-y-1.5">
          {replies.map((r) => (
            <CommentThread
              key={r.id}
              comment={r}
              allComments={allComments}
              hypothesisId={hypothesisId}
              user={user}
              onReply={onReply}
              setShowAuthModal={setShowAuthModal}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ExperimentCard({ experiment }: { experiment: Experiment }) {
  const t = EXP_TYPE_LABELS[experiment.type];
  const s = EXP_STATUS_LABELS[experiment.status];
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5">
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${t.cls}`}>{t.label}</span>
        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.cls}`}>{s.label}</span>
      </div>
      <p className="mb-1.5 text-sm font-medium text-stone-700">{experiment.datasetName}</p>
      <div className="mb-1.5 flex gap-3 text-xs text-stone-400">
        <span>Started: {fmtDate(experiment.startedAt)}</span>
        {experiment.completedAt && <span>Completed: {fmtDate(experiment.completedAt)}</span>}
      </div>
      {experiment.results && (
        <p className="text-sm text-stone-500">{experiment.results.summary}</p>
      )}
      <div className="mt-4">
        <a
          href={experiment.osfLink ?? "https://osf.io/"}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-stone-900 bg-stone-900 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-stone-800"
        >
          <ExternalLink className="h-4 w-4" />
          View Study on OSF
        </a>
      </div>
    </div>
  );
}
