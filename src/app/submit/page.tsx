"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getProblemStatements, submitHypothesis } from "@/lib/api";
import { validateHypothesisSubmission } from "@/lib/hypothesis-submission";
import { EvidenceBadge } from "@/components/evidence-badge";
import { DomainTag } from "@/components/domain-tag";
import { useAuth } from "@/components/auth-provider";
import { GatedPreview, SignInPrompt } from "@/components/sign-in-gate";
import { draftStatusText, useFormDraft } from "@/lib/use-form-draft";
import { Check, EyeOff, User, Search, X, Plus } from "lucide-react";
import type { Domain, ProblemStatement } from "@/lib/types";

const WELL_KNOWN_DOMAINS: string[] = ["persuasion", "memorability"];
const GENERATOR_TYPES = ["Human", "AI", "Collaborated"] as const;
type GeneratorType = (typeof GENERATOR_TYPES)[number] | "Agent";

type HypothesisDraft = {
  psQuery: string;
  selectedPsId: string | null;
  isProposingNew: boolean;
  newPsDomain: string | null;
  statement: string;
  rationale: string;
  doi: string;
  suggestedTest: string;
  isAnonymous: boolean;
  generatorType: GeneratorType;
};

export default function SubmitPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
        </div>
      }
    >
      <SubmitContent />
    </Suspense>
  );
}

function SubmitContent() {
  const { user, loading: authLoading, setShowAuthModal } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Problem statement state
  const [psQuery, setPsQuery] = useState("");
  const [selectedExistingPS, setSelectedExistingPS] = useState<ProblemStatement | null>(null);
  const [isProposingNew, setIsProposingNew] = useState(false);
  const [newPsDomain, setNewPsDomain] = useState<string | null>(null);
  const [showCustomDomainInput, setShowCustomDomainInput] = useState(false);
  const [customDomainInput, setCustomDomainInput] = useState("");
  const [psDropdownOpen, setPsDropdownOpen] = useState(false);
  const psRef = useRef<HTMLDivElement>(null);

  const [statement, setStatement] = useState("");
  const [rationale, setRationale] = useState("");
  const [doi, setDoi] = useState("");
  const [suggestedTest, setSuggestedTest] = useState("");
  const [showOptional, setShowOptional] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [generatorType, setGeneratorType] = useState<GeneratorType>("Human");
  const [pendingDraftPsId, setPendingDraftPsId] = useState<string | null>(null);
  const [problemStatements, setProblemStatements] = useState<ProblemStatement[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [redirectCountdown, setRedirectCountdown] = useState(3);
  const redirectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(false);
  const submissionInFlightRef = useRef(false);
  const psPrefillConsumedRef = useRef(false);
  const userId = user?.id;
  const urlStatement = searchParams.get("statement");
  const urlRationale = searchParams.get("rationale");
  const urlPS = searchParams.get("ps");
  const urlCustomPS = searchParams.get("customPS");
  const urlDomains = searchParams.get("domains");
  const urlSource = searchParams.get("source");

  // Derived values
  const activeDomains: Domain[] = selectedExistingPS
    ? [selectedExistingPS.domain]
    : isProposingNew && newPsDomain
      ? [newPsDomain]
      : [];

  const problemStatementText = selectedExistingPS
    ? selectedExistingPS.question
    : isProposingNew
      ? psQuery
      : "";

  const filteredPS = psQuery.trim()
    ? problemStatements.filter((ps) => ps.question.toLowerCase().includes(psQuery.toLowerCase()))
    : problemStatements;

  useEffect(() => {
    if (authLoading || !userId) return;
    const controller = new AbortController();
    let current = true;
    setCatalogLoading(true);
    setCatalogError("");
    getProblemStatements(undefined, { signal: controller.signal })
      .then((res) => {
        if (current) setProblemStatements(res.data);
      })
      .catch((err: unknown) => {
        if (current) {
          setCatalogError(err instanceof Error ? err.message : "Could not load problem statements");
        }
      })
      .finally(() => {
        if (current) setCatalogLoading(false);
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [authLoading, userId, catalogRetry]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (redirectTimerRef.current) clearInterval(redirectTimerRef.current);
    };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (psRef.current && !psRef.current.contains(e.target as Node)) {
        setPsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Pre-fill from URL params (e.g., MCP-generated submission links)
  useEffect(() => {
    if (urlStatement) setStatement(urlStatement);
    if (urlRationale) setRationale(urlRationale);
    if (urlSource === "ai_agent") setGeneratorType("AI");
  }, [urlStatement, urlRationale, urlSource]);

  useEffect(() => {
    psPrefillConsumedRef.current = false;
    setSelectedExistingPS(null);
    setPsQuery(urlCustomPS ?? "");
    setIsProposingNew(Boolean(urlCustomPS));
    setNewPsDomain(urlDomains?.split(",").find((domain) => domain.trim()) ?? null);
  }, [urlPS, urlCustomPS, urlDomains]);

  useEffect(() => {
    if (!urlPS || psPrefillConsumedRef.current) return;
    const match = problemStatements.find((ps) => ps.id === urlPS);
    if (match) {
      psPrefillConsumedRef.current = true;
      setSelectedExistingPS(match);
      setIsProposingNew(false);
      setPsQuery(match.question);
    }
  }, [urlPS, urlCustomPS, urlDomains, problemStatements]);

  // Declared after the URL pre-fill effects so a restored draft is applied last.
  const hasUrlPrefill = Boolean(urlStatement || urlRationale || urlPS || urlCustomPS || urlDomains);
  const { status: draftStatus, clear: clearDraft } = useFormDraft<HypothesisDraft>({
    key: "oe:draft:hypothesis",
    values: {
      psQuery,
      selectedPsId: selectedExistingPS?.id ?? pendingDraftPsId,
      isProposingNew,
      newPsDomain,
      statement,
      rationale,
      doi,
      suggestedTest,
      isAnonymous,
      generatorType,
    },
    isEmpty:
      !statement.trim() &&
      !rationale.trim() &&
      !doi.trim() &&
      !suggestedTest.trim() &&
      !psQuery.trim() &&
      !selectedExistingPS &&
      !pendingDraftPsId,
    restore: !hasUrlPrefill,
    onRestore: (d) => {
      if (typeof d.statement === "string") setStatement(d.statement);
      if (typeof d.rationale === "string") setRationale(d.rationale);
      if (typeof d.doi === "string") setDoi(d.doi);
      if (typeof d.suggestedTest === "string") setSuggestedTest(d.suggestedTest);
      if ((d.doi && d.doi.trim()) || (d.suggestedTest && d.suggestedTest.trim())) {
        setShowOptional(true);
      }
      if (typeof d.isAnonymous === "boolean") setIsAnonymous(d.isAnonymous);
      if (d.generatorType && GENERATOR_TYPES.some((t) => t === d.generatorType)) {
        setGeneratorType(d.generatorType);
      }
      if (typeof d.psQuery === "string") setPsQuery(d.psQuery);
      if (typeof d.selectedPsId === "string" && d.selectedPsId) {
        setPendingDraftPsId(d.selectedPsId);
        setIsProposingNew(false);
      } else if (typeof d.isProposingNew === "boolean") {
        setIsProposingNew(d.isProposingNew && typeof d.psQuery === "string" && !!d.psQuery);
        if (typeof d.newPsDomain === "string" || d.newPsDomain === null) {
          setNewPsDomain(d.newPsDomain ?? null);
        }
      }
    },
  });

  // Re-select a drafted problem statement once the catalog has loaded.
  useEffect(() => {
    if (!pendingDraftPsId || problemStatements.length === 0) return;
    const match = problemStatements.find((ps) => ps.id === pendingDraftPsId);
    if (match) {
      setSelectedExistingPS(match);
      setIsProposingNew(false);
      setPsQuery(match.question);
    }
    setPendingDraftPsId(null);
  }, [pendingDraftPsId, problemStatements]);

  const clearPsSelection = () => {
    psPrefillConsumedRef.current = true;
    setPendingDraftPsId(null);
    setSelectedExistingPS(null);
    setIsProposingNew(false);
    setNewPsDomain(null);
    setShowCustomDomainInput(false);
    setCustomDomainInput("");
    setPsQuery("");
    setFieldErrors((p) => ({ ...p, problemStatement: "", domains: "" }));
  };

  const resetForm = () => {
    clearPsSelection();
    setStatement("");
    setRationale("");
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
    if (!mountedRef.current) return;
    if (redirectTimerRef.current) clearInterval(redirectTimerRef.current);
    let remaining = 3;
    setRedirectCountdown(3);
    redirectTimerRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      remaining -= 1;
      setRedirectCountdown(remaining);
      if (remaining <= 0) {
        if (redirectTimerRef.current) clearInterval(redirectTimerRef.current);
        router.push(`/hypothesis/${id}`);
      }
    }, 1000);
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        <div className="rounded-lg border border-stone-200 bg-white p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50">
            <Check className="h-5 w-5 text-teal-700" />
          </div>
          <h2 className="mb-1 font-serif text-xl font-medium text-stone-800">
            Hypothesis submitted
          </h2>
          <p className="mb-2 text-sm text-stone-600">
            Reference:{" "}
            <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-600">
              {submittedId}
            </code>
          </p>
          <p className="mb-3 text-xs text-stone-600">
            Your hypothesis is live now, but may take up to 5 minutes to appear in the explore and
            home listings.
          </p>
          <p className="mb-5 text-xs text-stone-600">
            Redirecting in {redirectCountdown}s...{" "}
            <button
              type="button"
              onClick={() => {
                if (redirectTimerRef.current) clearInterval(redirectTimerRef.current);
              }}
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

  const signedOut = !authLoading && !user;

  const inputClass =
    "w-full rounded-md border border-stone-200 px-3 py-2.5 text-base text-stone-800 placeholder-stone-500 transition-colors focus:border-stone-600 focus:outline-none focus:ring-1 focus:ring-stone-600";

  const psHasSelection = selectedExistingPS !== null || isProposingNew;

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-10 text-center">
        <h1 className="type-title text-stone-900">What do you think is true?</h1>
        <p className="mt-2 text-base text-stone-600">
          Share your idea. We bring the data and the experiments.
        </p>
      </header>

      {signedOut && (
        <SignInPrompt
          title="Sign in to submit a hypothesis"
          items={[
            "A problem statement: pick an existing one, or propose a new one and its domain",
            "Your hypothesis, in a sentence or two",
            "Your rationale: why you believe it",
            "Whether it came from a human, an AI or both, and whether to post anonymously",
            "Optional: a DOI or paper link, and how you would test it",
          ]}
          duration="Takes about 5 minutes. Your draft saves on this device as you write. The form is previewed below."
          actionLabel="Sign in to submit"
          onSignIn={() => setShowAuthModal(true)}
        />
      )}

      <GatedPreview locked={signedOut}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (submissionInFlightRef.current || authLoading || !user) return;
            submissionInFlightRef.current = true;
            setSubmitting(true);
            setSubmitError("");
            setFieldErrors({});

            const errors = validateHypothesisSubmission({
              statement,
              rationale,
              problemStatement: problemStatementText,
              domains: activeDomains,
              isProposingNew,
            });

            if (Object.keys(errors).length > 0) {
              submissionInFlightRef.current = false;
              setFieldErrors(errors);
              setSubmitting(false);
              return;
            }

            try {
              const source =
                generatorType === "AI" || generatorType === "Collaborated" ? "ai_agent" : "human";
              const res = await submitHypothesis({
                statement,
                rationale,
                problemStatement: problemStatementText,
                domains: activeDomains,
                source,
                citationDois: doi ? [doi] : [],
                isAnonymous,
              });
              if (!mountedRef.current) return;
              clearDraft();
              setSubmittedId(res.data.id);
              setSubmitted(true);
              startRedirectCountdown(res.data.id);
            } catch (err) {
              if (mountedRef.current) {
                setSubmitError(err instanceof Error ? err.message : "Submission failed");
              }
            } finally {
              submissionInFlightRef.current = false;
              if (mountedRef.current) setSubmitting(false);
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
              <span
                className={`block h-4 w-4 rounded-full bg-white transition-transform ${isAnonymous ? "translate-x-4" : "translate-x-0"}`}
              />
            </button>
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-stone-700">
                <EyeOff className="h-3.5 w-3.5" />
                Submit anonymously
              </p>
              <p className="mt-0.5 text-xs text-stone-600">
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
                <label
                  key={type}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:border-stone-300"
                >
                  <input
                    type="radio"
                    name="generatorType"
                    value={type}
                    checked={generatorType === type}
                    onChange={(e) =>
                      setGeneratorType(e.target.value as "Human" | "AI" | "Collaborated")
                    }
                    className="text-stone-900 focus:ring-stone-900"
                  />
                  {type}
                </label>
              ))}
            </div>
            {(generatorType === "AI" || generatorType === "Collaborated") && (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800">
                Note: Please raise a request at our GitHub to register your AI Agent.
              </p>
            )}
          </div>

          {/* Problem statement — combobox */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-stone-700">
              Problem statement
            </label>
            <p className="mb-2 text-xs text-stone-600">
              Pick an existing problem statement or propose a new one
            </p>
            {catalogLoading && (
              <p role="status" className="mb-2 text-xs text-stone-600">
                Loading problem statements...
              </p>
            )}
            {catalogError && (
              <div role="alert" className="mb-2 text-xs text-red-700">
                Could not load problem statements: {catalogError}.{" "}
                <button
                  type="button"
                  onClick={() => setCatalogRetry((retry) => retry + 1)}
                  className="underline"
                >
                  Retry
                </button>
              </div>
            )}
            {fieldErrors.problemStatement && (
              <p className="mb-1.5 text-xs text-red-700">{fieldErrors.problemStatement}</p>
            )}
            {fieldErrors.domains && (
              <p className="mb-1.5 text-xs text-red-700">{fieldErrors.domains}</p>
            )}

            {psHasSelection ? (
              /* Selected state — show chosen PS as a card */
              <div className="rounded-md border border-stone-200 bg-stone-50/50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-1.5">
                      {activeDomains[0] && <DomainTag domain={activeDomains[0]} />}
                      {isProposingNew && (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-stone-700">
                      {selectedExistingPS ? selectedExistingPS.question : psQuery}
                    </p>
                    {selectedExistingPS && (
                      <p className="mt-0.5 text-xs text-stone-600">
                        {selectedExistingPS.hypothesisCount} hypothesis
                        {selectedExistingPS.hypothesisCount !== 1 ? "es" : ""}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={clearPsSelection}
                    className="shrink-0 rounded p-1 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                    title="Change problem statement"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Domain picker — only for new problem statements */}
                {isProposingNew && (
                  <div className="mt-3 border-t border-stone-200 pt-3">
                    <label className="mb-1.5 block text-xs font-medium text-stone-600">
                      Domain for this problem statement
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {WELL_KNOWN_DOMAINS.map((d) => {
                        const sel = newPsDomain === d;
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => {
                              psPrefillConsumedRef.current = true;
                              setNewPsDomain(d);
                              setShowCustomDomainInput(false);
                              setCustomDomainInput("");
                              setFieldErrors((p) => ({ ...p, domains: "" }));
                            }}
                            className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-semibold capitalize transition-colors ${
                              sel
                                ? "bg-stone-900 text-white"
                                : "border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-800"
                            }`}
                          >
                            {sel && <Check className="mr-1.5 h-3.5 w-3.5" />}
                            {d}
                          </button>
                        );
                      })}
                      {!showCustomDomainInput ? (
                        <button
                          type="button"
                          onClick={() => {
                            psPrefillConsumedRef.current = true;
                            setShowCustomDomainInput(true);
                            setNewPsDomain(null);
                          }}
                          className={`inline-flex items-center gap-1 rounded-md border border-dashed px-3 py-1.5 text-sm font-medium transition-colors ${
                            newPsDomain && !WELL_KNOWN_DOMAINS.includes(newPsDomain)
                              ? "border-stone-900 bg-stone-900 text-white"
                              : "border-stone-300 text-stone-600 hover:border-stone-400 hover:text-stone-700"
                          }`}
                        >
                          {newPsDomain && !WELL_KNOWN_DOMAINS.includes(newPsDomain) ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              {newPsDomain}
                            </>
                          ) : (
                            <>
                              <Plus className="h-3.5 w-3.5" />
                              New Domain
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={customDomainInput}
                            onChange={(e) => {
                              psPrefillConsumedRef.current = true;
                              setCustomDomainInput(e.target.value.toLowerCase());
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const val = customDomainInput.trim();
                                if (val) {
                                  setNewPsDomain(val);
                                  setShowCustomDomainInput(false);
                                  setFieldErrors((p) => ({ ...p, domains: "" }));
                                }
                              }
                            }}
                            placeholder="e.g. decision-making"
                            autoFocus
                            className="w-40 rounded-md border border-stone-300 px-2.5 py-1.5 text-sm text-stone-800 placeholder-stone-500 focus:border-stone-600 focus:ring-1 focus:ring-stone-600 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = customDomainInput.trim();
                              if (val) {
                                setNewPsDomain(val);
                                setShowCustomDomainInput(false);
                                setFieldErrors((p) => ({ ...p, domains: "" }));
                              }
                            }}
                            disabled={!customDomainInput.trim()}
                            className="rounded-md bg-stone-900 px-2.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:opacity-40"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCustomDomainInput(false);
                              setCustomDomainInput("");
                            }}
                            className="rounded-md p-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Search state — combobox input with dropdown */
              <div ref={psRef} className="relative">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-stone-600" />
                  <input
                    type="text"
                    value={psQuery}
                    onChange={(e) => {
                      psPrefillConsumedRef.current = true;
                      setPsQuery(e.target.value);
                      setPsDropdownOpen(true);
                      setFieldErrors((p) => ({ ...p, problemStatement: "", domains: "" }));
                    }}
                    onFocus={() => setPsDropdownOpen(true)}
                    placeholder="Search or type a new problem statement..."
                    className={`${inputClass} pl-9`}
                  />
                </div>

                {psDropdownOpen && (
                  <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-stone-200 bg-white shadow-lg">
                    {filteredPS.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-xs font-medium tracking-wider text-stone-600 uppercase">
                          Existing problem statements
                        </div>
                        {filteredPS.map((ps) => (
                          <button
                            key={ps.id}
                            type="button"
                            onClick={() => {
                              psPrefillConsumedRef.current = true;
                              setSelectedExistingPS(ps);
                              setPsQuery(ps.question);
                              setPsDropdownOpen(false);
                              setFieldErrors((p) => ({ ...p, problemStatement: "", domains: "" }));
                            }}
                            className="w-full border-b border-stone-100 px-3 py-2 text-left transition-colors last:border-0 hover:bg-stone-50"
                          >
                            <div className="mb-0.5 flex items-center gap-1.5">
                              <DomainTag domain={ps.domain} />
                              <span className="text-xs text-stone-600">
                                {ps.hypothesisCount} hypothesis
                                {ps.hypothesisCount !== 1 ? "es" : ""}
                              </span>
                            </div>
                            <p className="text-sm text-stone-700">{ps.question}</p>
                          </button>
                        ))}
                      </>
                    )}

                    {psQuery.trim() && (
                      <>
                        {filteredPS.length > 0 && <div className="border-t border-stone-200" />}
                        <button
                          type="button"
                          onClick={() => {
                            psPrefillConsumedRef.current = true;
                            setIsProposingNew(true);
                            setPsDropdownOpen(false);
                            setFieldErrors((p) => ({ ...p, problemStatement: "" }));
                          }}
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-teal-50"
                        >
                          <Plus className="h-4 w-4 shrink-0 text-teal-700" />
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-teal-700">
                              Propose as new problem statement
                            </span>
                            <p className="truncate text-xs text-stone-600">
                              &ldquo;{psQuery}&rdquo;
                            </p>
                          </div>
                        </button>
                      </>
                    )}

                    {filteredPS.length === 0 && !psQuery.trim() && (
                      <div className="px-3 py-4 text-center text-sm text-stone-600">
                        Start typing to search or propose a new one
                      </div>
                    )}

                    {filteredPS.length === 0 && psQuery.trim() && (
                      <div className="border-b border-stone-100 px-3 py-3 text-center text-xs text-stone-600">
                        No existing problem statements match
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Hypothesis */}
          <div>
            <label htmlFor="hyp" className="mb-1.5 block text-sm font-semibold text-stone-700">
              Your hypothesis
            </label>
            {fieldErrors.statement && (
              <p className="mb-1.5 text-xs text-red-700">{fieldErrors.statement}</p>
            )}
            <textarea
              id="hyp"
              value={statement}
              onChange={(e) => {
                setStatement(e.target.value);
                setFieldErrors((p) => ({ ...p, statement: "" }));
              }}
              placeholder="e.g., Counterarguments that acknowledge the original viewpoint are more persuasive."
              rows={3}
              className={inputClass}
              maxLength={2000}
            />
            <p className="mt-1 text-right text-xs text-stone-600">{statement.length}/2000</p>
          </div>

          {/* Rationale */}
          <div>
            <label htmlFor="rat" className="mb-1.5 block text-sm font-semibold text-stone-700">
              Your rationale
            </label>
            {fieldErrors.rationale && (
              <p className="mb-1.5 text-xs text-red-700">{fieldErrors.rationale}</p>
            )}
            <textarea
              id="rat"
              value={rationale}
              onChange={(e) => {
                setRationale(e.target.value);
                setFieldErrors((p) => ({ ...p, rationale: "" }));
              }}
              placeholder="Why do you believe this? What observation or intuition led you here?"
              rows={3}
              className={inputClass}
              maxLength={5000}
            />
            <p className="mt-1 text-right text-xs text-stone-600">{rationale.length}/5000</p>
          </div>

          {/* Optional */}
          <div>
            <button
              type="button"
              onClick={() => setShowOptional(!showOptional)}
              className="text-xs font-medium text-stone-600 hover:text-stone-900"
            >
              {showOptional ? "Hide optional fields" : "Add more detail"}
            </button>
            {showOptional && (
              <div className="mt-3 space-y-3 rounded-md border border-stone-200 bg-stone-50/50 p-4">
                <div>
                  <label htmlFor="doi" className="mb-1 block text-xs font-medium text-stone-600">
                    DOI / paper link
                  </label>
                  <input
                    id="doi"
                    type="text"
                    value={doi}
                    onChange={(e) => setDoi(e.target.value)}
                    placeholder="10.1145/3411764.3445124"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="test" className="mb-1 block text-xs font-medium text-stone-600">
                    Suggested test
                  </label>
                  <textarea
                    id="test"
                    value={suggestedTest}
                    onChange={(e) => setSuggestedTest(e.target.value)}
                    placeholder="How would you test this?"
                    rows={2}
                    className={inputClass}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="rounded-md border border-stone-200 bg-white p-4">
            <span className="mb-2 block text-xs font-medium tracking-wider text-stone-600 uppercase">
              Preview
            </span>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <EvidenceBadge status="proposed" phase="live" size="sm" />
                {activeDomains.map((d) => (
                  <DomainTag key={d} domain={d} />
                ))}
                {activeDomains.length === 0 && (
                  <span className="text-xs text-stone-600 italic">
                    Domain set by problem statement
                  </span>
                )}
              </div>
              <p className="text-[13px] leading-relaxed text-stone-700">
                {statement || (
                  <span className="text-stone-600 italic">Your hypothesis appears here</span>
                )}
              </p>
              <div className="flex items-center gap-1 text-xs text-stone-600">
                {isAnonymous ? (
                  <>
                    <EyeOff className="h-3 w-3" />
                    <span>Anonymous</span>
                  </>
                ) : (
                  <>
                    <User className="h-3 w-3" />
                    <span>{user?.name || "You"}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {submitError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || authLoading || !user}
            className="w-full rounded-md border border-stone-900 bg-stone-900 py-3 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Hypothesis"}
          </button>
          <p aria-live="polite" className="-mt-3 min-h-4 text-center text-xs text-stone-600">
            {draftStatusText(draftStatus)}
          </p>
        </form>
      </GatedPreview>
    </div>
  );
}
