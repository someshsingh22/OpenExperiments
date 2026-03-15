"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getProblemStatements, submitHypothesis } from "@/lib/api";
import { EvidenceBadge } from "@/components/evidence-badge";
import { DomainTag } from "@/components/domain-tag";
import { useAuth } from "@/components/auth-provider";
import { Brain, ChevronDown, Check, EyeOff, User } from "lucide-react";
import type { Domain, ProblemStatement } from "@/lib/types";

const DOMAINS: Domain[] = ["persuasion", "memorability"];

export default function SubmitPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
      </div>
    }>
      <SubmitContent />
    </Suspense>
  );
}

function SubmitContent() {
  const { user, loading: authLoading, setShowAuthModal } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedPS, setSelectedPS] = useState<string | null>(null);
  const [customQ, setCustomQ] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [statement, setStatement] = useState("");
  const [rationale, setRationale] = useState("");
  const [selectedDomains, setSelectedDomains] = useState<Domain[]>([]);
  const [doi, setDoi] = useState("");
  const [suggestedTest, setSuggestedTest] = useState("");
  const [showOptional, setShowOptional] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [generatorType, setGeneratorType] = useState<"Human" | "AI" | "Collaborated" | "Agent">("Human");
  const [problemStatements, setProblemStatements] = useState<ProblemStatement[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [redirectCountdown, setRedirectCountdown] = useState(3);
  const redirectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getProblemStatements().then((res) => setProblemStatements(res.data));
  }, []);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearInterval(redirectTimerRef.current);
    };
  }, []);

  // Pre-fill from URL params (e.g., MCP-generated submission links)
  useEffect(() => {
    const urlStatement = searchParams.get("statement");
    const urlRationale = searchParams.get("rationale");
    const urlPS = searchParams.get("ps");
    const urlCustomPS = searchParams.get("customPS");
    const urlDomains = searchParams.get("domains");
    const urlSource = searchParams.get("source");

    if (urlStatement) setStatement(urlStatement);
    if (urlRationale) setRationale(urlRationale);
    if (urlPS) setSelectedPS(urlPS);
    if (urlCustomPS) {
      setShowCustom(true);
      setCustomQ(urlCustomPS);
    }
    if (urlDomains) {
      const parsed = urlDomains
        .split(",")
        .filter((d): d is Domain => DOMAINS.includes(d as Domain));
      if (parsed.length > 0) setSelectedDomains(parsed);
    }
    if (urlSource === "ai_agent") setGeneratorType("AI");
  }, [searchParams]);

  const toggleDomain = (d: Domain) => {
    setSelectedDomains((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const resetForm = () => {
    setSelectedPS(null);
    setCustomQ("");
    setShowCustom(false);
    setStatement("");
    setRationale("");
    setSelectedDomains([]);
    setDoi("");
    setSuggestedTest("");
    setShowOptional(false);
    setSubmitted(false);
    setSubmittedId("");
    setSubmitError("");
    setFieldErrors({});
    setIsAnonymous(false);
    setGeneratorType("Human");
    setRedirectCountdown(3);
    if (redirectTimerRef.current) clearInterval(redirectTimerRef.current);
  };

  const startRedirectCountdown = (id: string) => {
    setRedirectCountdown(3);
    redirectTimerRef.current = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          if (redirectTimerRef.current) clearInterval(redirectTimerRef.current);
          router.push(`/hypothesis/${id}`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        <div className="rounded-lg border border-stone-200 bg-white p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50">
            <Check className="h-5 w-5 text-teal-600" />
          </div>
          <h2 className="mb-1 text-lg font-semibold text-stone-800">
            Hypothesis submitted
          </h2>
          <p className="mb-2 text-sm text-stone-500">
            Reference: <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-600">{submittedId}</code>
          </p>
          <p className="mb-5 text-xs text-stone-400">
            Redirecting in {redirectCountdown}s...{" "}
            <button
              type="button"
              onClick={() => { if (redirectTimerRef.current) clearInterval(redirectTimerRef.current); }}
              className="underline hover:text-stone-600"
            >
              stay here
            </button>
          </p>
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <Link
              href={`/hypothesis/${submittedId}`}
              className="rounded-md border border-stone-900 bg-stone-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-stone-800"
            >
              View hypothesis
            </Link>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-stone-300 px-4 py-2 text-[13px] font-medium text-stone-600 hover:bg-stone-50"
            >
              Submit another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Auth gate
  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6 text-center">
        <h1 className="mb-2 text-xl font-semibold text-stone-900">Sign in to submit</h1>
        <p className="mb-6 text-sm text-stone-500">
          You need to be signed in to submit a hypothesis.
        </p>
        <button
          onClick={() => setShowAuthModal(true)}
          className="rounded-md border border-stone-900 bg-stone-900 px-6 py-3 text-sm font-medium text-white hover:bg-stone-800"
        >
          Sign In
        </button>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-md border border-stone-200 px-3 py-2.5 text-base text-stone-800 placeholder-stone-400 transition-colors focus:border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-300";

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          What do you think is true?
        </h1>
        <p className="mt-2 text-base text-stone-600">
          Share your idea. We bring the data and the experiments.
        </p>
      </header>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSubmitting(true);
          setSubmitError("");
          setFieldErrors({});

          // Client-side basic validation
          const errors: Record<string, string> = {};
          if (!statement.trim()) errors.statement = "Please provide your hypothesis";
          else if (statement.trim().length < 10) errors.statement = "Hypothesis must be at least 10 characters";
          if (!rationale.trim()) errors.rationale = "Please provide your rationale";
          else if (rationale.trim().length < 10) errors.rationale = "Rationale must be at least 10 characters";
          const psQuestion = showCustom
            ? customQ
            : problemStatements.find((ps) => ps.id === selectedPS)?.question || "";
          if (!psQuestion.trim()) errors.problemStatement = "Please select or enter a problem statement";
          if (selectedDomains.length === 0) errors.domains = "Please select at least one domain";

          if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            setSubmitting(false);
            return;
          }

          try {
            const source = generatorType === "AI" || generatorType === "Collaborated" ? "ai_agent" : "human";
            const res = await submitHypothesis({
              statement,
              rationale,
              problemStatement: psQuestion,
              domains: selectedDomains,
              source,
              citationDois: doi ? [doi] : [],
              isAnonymous,
            });
            setSubmittedId(res.data.id);
            setSubmitted(true);
            startRedirectCountdown(res.data.id);
          } catch (err) {
            setSubmitError(err instanceof Error ? err.message : "Submission failed");
          } finally {
            setSubmitting(false);
          }
        }}
        className="space-y-6"
      >
        {/* Anonymous toggle */}
        <div className="flex items-start gap-3 rounded-md border border-stone-200 bg-stone-50/50 p-3">
          <button
            type="button"
            onClick={() => setIsAnonymous(!isAnonymous)}
            className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${isAnonymous ? "bg-stone-800" : "bg-stone-300"}`}
          >
            <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${isAnonymous ? "translate-x-4" : "translate-x-0"}`} />
          </button>
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-stone-700">
              <EyeOff className="h-3.5 w-3.5" />
              Submit anonymously
            </p>
            <p className="mt-0.5 text-xs text-stone-500">
              Your name will be hidden publicly. Only you can see this hypothesis on your profile.
            </p>
          </div>
        </div>

        {/* Generator Type */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-stone-700">
            Hypothesis Generated By
          </label>
          <div className="flex flex-wrap gap-2">
            {(["Human", "AI", "Collaborated"] as const).map((type) => (
              <label key={type} className="flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:border-stone-300 cursor-pointer">
                <input
                  type="radio"
                  name="generatorType"
                  value={type}
                  checked={generatorType === type}
                  onChange={(e) => setGeneratorType(e.target.value as any)}
                  className="text-stone-900 focus:ring-stone-900"
                />
                {type}
              </label>
            ))}
          </div>
          {(generatorType === "AI" || generatorType === "Collaborated") && (
            <p className="mt-3 text-xs font-semibold text-amber-800 bg-amber-50 px-3 py-2.5 rounded-md border border-amber-200">
              Note: Please raise a request at our GitHub to register your AI Agent.
            </p>
          )}
        </div>

        {/* Problem statement */}
        <div>
          <label htmlFor="ps" className="mb-1.5 block text-sm font-semibold text-stone-700">
            Problem statement
          </label>
          {fieldErrors.problemStatement && <p className="mb-1.5 text-xs text-red-500">{fieldErrors.problemStatement}</p>}
          {!showCustom ? (
            <>
              <div className="relative">
                <select
                  id="ps"
                  value={selectedPS ?? ""}
                  onChange={(e) => setSelectedPS(e.target.value || null)}
                  className={`${inputClass} appearance-none pr-9`}
                >
                  <option value="">Select a question...</option>
                  {problemStatements.map((ps) => (
                    <option key={ps.id} value={ps.id}>{ps.question}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-300" />
              </div>
              <button
                type="button"
                onClick={() => setShowCustom(true)}
                className="mt-1.5 text-xs font-semibold text-stone-500 hover:text-stone-700"
              >
                Or propose a new question
              </button>
            </>
          ) : (
            <div className="space-y-1.5">
              <input
                type="text"
                value={customQ}
                onChange={(e) => setCustomQ(e.target.value)}
                placeholder="Your question..."
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowCustom(false)}
                className="text-xs font-semibold text-stone-500 hover:text-stone-700"
              >
                Choose from existing
              </button>
            </div>
          )}
        </div>

        {/* Hypothesis */}
        <div>
          <label htmlFor="hyp" className="mb-1.5 block text-sm font-semibold text-stone-700">
            Your hypothesis
          </label>
          {fieldErrors.statement && <p className="mb-1.5 text-xs text-red-500">{fieldErrors.statement}</p>}
          <textarea
            id="hyp"
            value={statement}
            onChange={(e) => { setStatement(e.target.value); setFieldErrors((p) => ({ ...p, statement: "" })); }}
            placeholder="e.g., Counterarguments that acknowledge the original viewpoint are more persuasive."
            rows={3}
            className={inputClass}
            maxLength={2000}
          />
          <p className="mt-1 text-right text-[11px] text-stone-400">{statement.length}/2000</p>
        </div>

        {/* Rationale */}
        <div>
          <label htmlFor="rat" className="mb-1.5 block text-sm font-semibold text-stone-700">
            Your rationale
          </label>
          {fieldErrors.rationale && <p className="mb-1.5 text-xs text-red-500">{fieldErrors.rationale}</p>}
          <textarea
            id="rat"
            value={rationale}
            onChange={(e) => { setRationale(e.target.value); setFieldErrors((p) => ({ ...p, rationale: "" })); }}
            placeholder="Why do you believe this? What observation or intuition led you here?"
            rows={3}
            className={inputClass}
            maxLength={5000}
          />
          <p className="mt-1 text-right text-[11px] text-stone-400">{rationale.length}/5000</p>
        </div>

        {/* Domain tags */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-stone-700">
            Domain
          </label>
          {fieldErrors.domains && <p className="mb-1.5 text-xs text-red-500">{fieldErrors.domains}</p>}
          <div className="flex gap-2">
            {DOMAINS.map((d) => {
              const sel = selectedDomains.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDomain(d)}
                  className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-semibold capitalize transition-colors ${sel
                    ? "bg-stone-900 text-white"
                    : "border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-800"
                    }`}
                >
                  {sel && <Check className="mr-1.5 h-3.5 w-3.5" />}
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional */}
        <div>
          <button
            type="button"
            onClick={() => setShowOptional(!showOptional)}
            className="text-[12px] font-medium text-stone-400 hover:text-stone-600"
          >
            {showOptional ? "Hide optional fields" : "Add more detail"}
          </button>
          {showOptional && (
            <div className="mt-3 space-y-3 rounded-md border border-stone-200 bg-stone-50/50 p-4">
              <div>
                <label htmlFor="doi" className="mb-1 block text-[12px] font-medium text-stone-500">
                  DOI / paper link
                </label>
                <input id="doi" type="text" value={doi} onChange={(e) => setDoi(e.target.value)} placeholder="10.1145/3411764.3445124" className={inputClass} />
              </div>
              <div>
                <label htmlFor="test" className="mb-1 block text-[12px] font-medium text-stone-500">
                  Suggested test
                </label>
                <textarea id="test" value={suggestedTest} onChange={(e) => setSuggestedTest(e.target.value)} placeholder="How would you test this?" rows={2} className={inputClass} />
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="rounded-md border border-stone-200 bg-white p-4">
          <span className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-stone-300">
            Preview
          </span>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <EvidenceBadge status="proposed" phase="live" size="sm" />
              {selectedDomains.map((d) => <DomainTag key={d} domain={d} />)}
              {selectedDomains.length === 0 && (
                <span className="text-[11px] italic text-stone-300">Select domains above</span>
              )}
            </div>
            <p className="text-[13px] leading-relaxed text-stone-700">
              {statement || <span className="italic text-stone-300">Your hypothesis appears here</span>}
            </p>
            <div className="flex items-center gap-1 text-[11px] text-stone-300">
              {isAnonymous ? (
                <><EyeOff className="h-3 w-3" /><span>Anonymous</span></>
              ) : (
                <><User className="h-3 w-3" /><span>{user?.name || "You"}</span></>
              )}
            </div>
          </div>
        </div>

        {submitError && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md border border-stone-900 bg-stone-900 py-3 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Hypothesis"}
        </button>
      </form>
    </div>
  );
}
