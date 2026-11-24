"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ExternalLink, FlaskConical, ChevronDown, Check, User } from "lucide-react";
import { getExperiments, getProblemStatements, getDatasets, submitExperiment } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { createHypothesisChoicesLoader, createLatestRequest } from "./experiment-ui-requests";
import type { Experiment, ProblemStatement, Hypothesis, Dataset } from "@/lib/types";
import { formatDate, formatPValueInline } from "@/lib/format";

const EXP_TYPE_OPTIONS = [
  { value: "observational", label: "Observational" },
  { value: "survey", label: "Survey" },
  { value: "ab_test", label: "A/B Test" },
  { value: "pre_registered", label: "Pre-registered" },
] as const;

const STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
] as const;

const EXP_TYPE_LABELS: Record<string, { label: string; cls: string }> = {
  observational: { label: "Observational", cls: "bg-stone-100 text-stone-600" },
  survey: { label: "Survey", cls: "bg-sky-50 text-sky-700" },
  ab_test: { label: "A/B Test", cls: "bg-teal-50 text-teal-700" },
  pre_registered: { label: "Pre-registered", cls: "bg-amber-50 text-amber-700" },
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  running: { label: "Running", cls: "bg-sky-50 text-sky-700 ring-sky-600/20" },
  completed: { label: "Completed", cls: "bg-teal-50 text-teal-700 ring-teal-600/20" },
  planned: { label: "Planned", cls: "bg-stone-100 text-stone-600 ring-stone-400/20" },
};

interface ExperimentsContentProps {
  initialExperiments: Experiment[];
}

export function ExperimentsContent({ initialExperiments }: ExperimentsContentProps) {
  const [experiments, setExperiments] = useState<Experiment[]>(initialExperiments);
  const [refreshError, setRefreshError] = useState("");
  const listRequests = useRef(createLatestRequest());
  const submitRef = useRef<HTMLDivElement>(null);

  function refreshExperiments() {
    const isCurrent = listRequests.current.start();
    setRefreshError("");
    getExperiments()
      .then((res) => {
        if (isCurrent()) setExperiments(res.data);
      })
      .catch(() => {
        if (isCurrent()) setRefreshError("Experiment submitted, but the list could not refresh.");
      });
  }

  useEffect(() => {
    const requests = listRequests.current;
    return () => requests.invalidate();
  }, []);

  useEffect(() => {
    if (window.location.hash === "#submit" && submitRef.current) {
      setTimeout(() => submitRef.current?.scrollIntoView({ behavior: "smooth" }), 300);
    }
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <header className="mb-12">
        <h1 className="type-title text-stone-900">Experiments</h1>
        <p className="mt-4 text-base leading-relaxed text-stone-600">
          Study plans and experiments from our team and community. Preregistration records a plan,
          not a completed result; each study shows its current status.
        </p>
      </header>

      <div ref={submitRef} id="submit" className="mb-16">
        <ExperimentSubmitForm onSubmitted={refreshExperiments} />
      </div>

      <section>
        <h2 className="type-heading mb-6 text-stone-900">All Experiments</h2>
        {refreshError && (
          <p role="alert" className="mb-4 text-sm text-red-700">
            {refreshError} <button onClick={refreshExperiments}>Retry</button>
          </p>
        )}
        {experiments.length === 0 ? (
          <div className="py-12 text-center text-sm text-stone-600">No experiments yet.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {experiments.map((exp) => (
              <ExperimentCard key={exp.id} experiment={exp} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ExperimentCard({ experiment }: { experiment: Experiment }) {
  const typeMeta = EXP_TYPE_LABELS[experiment.type] || EXP_TYPE_LABELS.observational;
  const statusMeta = STATUS_LABELS[experiment.status] || STATUS_LABELS.planned;

  return (
    <Link
      href={`/experiments/${experiment.id}`}
      className="group block rounded-lg border border-stone-200 bg-white p-4 transition-all duration-300 hover:-translate-y-1 hover:border-stone-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
    >
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${typeMeta.cls}`}
        >
          {typeMeta.label}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${statusMeta.cls}`}
        >
          {statusMeta.label}
        </span>
      </div>

      <p className="mb-1 text-[13px] font-medium text-stone-800 group-hover:text-stone-900">
        {experiment.datasetName}
      </p>
      {experiment.methodology && (
        <p className="mb-2.5 line-clamp-3 text-[13px] leading-relaxed text-stone-600">
          {experiment.methodology}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-stone-600">
        <div className="flex items-center gap-1">
          {experiment.submitter ? (
            <>
              <User className="h-3 w-3" />
              <span className="font-medium">{experiment.submitter.name || "Anonymous"}</span>
            </>
          ) : (
            <time dateTime={experiment.startedAt} className="type-data">
              {formatDate(experiment.startedAt)}
            </time>
          )}
        </div>
        <div className="flex items-center gap-2">
          {experiment.results?.pValue != null && (
            <span className="type-data">{formatPValueInline(experiment.results.pValue)}</span>
          )}
          {experiment.osfLink && <ExternalLink className="h-3 w-3" />}
        </div>
      </div>
    </Link>
  );
}

function ExperimentSubmitForm({ onSubmitted }: { onSubmitted: () => void }) {
  const { user, loading: authLoading, setShowAuthModal } = useAuth();

  const [problemStatements, setProblemStatements] = useState<ProblemStatement[]>([]);
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);

  const [selectedPS, setSelectedPS] = useState("");
  const [selectedHypothesis, setSelectedHypothesis] = useState("");
  const [studyType, setStudyType] = useState<string>("observational");
  const [datasetMode, setDatasetMode] = useState<"platform" | "custom">("platform");
  const [selectedDataset, setSelectedDataset] = useState("");
  const [customDatasetName, setCustomDatasetName] = useState("");
  const [status, setStatus] = useState("planned");
  const [methodology, setMethodology] = useState("");
  const [analysisPlan, setAnalysisPlan] = useState("");
  const [osfLink, setOsfLink] = useState("");

  const [resSummary, setResSummary] = useState("");
  const [resPValue, setResPValue] = useState("");
  const [resEffectSize, setResEffectSize] = useState("");
  const [resSampleSize, setResSampleSize] = useState("");
  const [resCILow, setResCILow] = useState("");
  const [resCIHigh, setResCIHigh] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [hypothesesLoading, setHypothesesLoading] = useState(false);
  const [hypothesesError, setHypothesesError] = useState("");
  const [hypothesesRetry, setHypothesesRetry] = useState(0);
  const hypothesisRequests = useRef(createLatestRequest());
  const hypothesisChoices = useRef(createHypothesisChoicesLoader());
  const formAvailable = !authLoading && !!user && !submitted;
  const userId = user?.id;

  useEffect(() => {
    let active = true;
    setProblemStatements([]);
    setDatasets([]);
    setSelectedPS("");
    setSelectedHypothesis("");
    setSelectedDataset("");
    setCatalogError("");
    setCatalogLoading(formAvailable);
    if (!formAvailable) return;
    Promise.all([getProblemStatements(), getDatasets()])
      .then(([ps, ds]) => {
        if (!active) return;
        setProblemStatements(ps.data);
        setDatasets(ds.data);
      })
      .catch(() => {
        if (active) setCatalogError("Unable to load problem statements and datasets.");
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });
    return () => {
      active = false;
    };
  }, [formAvailable, userId, catalogRetry]);

  useEffect(() => {
    const isCurrent = hypothesisRequests.current.start();
    setHypotheses([]);
    setSelectedHypothesis("");
    setHypothesesError("");
    setHypothesesLoading(false);
    const ps = problemStatements.find((p) => p.id === selectedPS);
    if (formAvailable && ps) {
      setHypothesesLoading(true);
      hypothesisChoices.current
        .load(ps.id, ps.question)
        .then((data) => {
          if (isCurrent()) setHypotheses(data);
        })
        .catch(() => {
          if (isCurrent()) setHypothesesError("Unable to load hypotheses.");
        })
        .finally(() => {
          if (isCurrent()) setHypothesesLoading(false);
        });
    }
    const requests = hypothesisRequests.current;
    return () => requests.invalidate();
  }, [formAvailable, selectedPS, problemStatements, hypothesesRetry]);

  const inputClass =
    "w-full rounded-md border border-stone-200 px-3 py-2.5 text-base text-stone-800 placeholder-stone-500 transition-colors focus:border-stone-600 focus:outline-none focus:ring-1 focus:ring-stone-600";
  const metricInputClass =
    "w-full rounded-md border border-stone-200 px-3 py-2 text-sm font-mono text-stone-800 placeholder-stone-500 transition-colors focus:border-stone-600 focus:outline-none focus:ring-1 focus:ring-stone-600";

  function resetForm() {
    setSubmitted(false);
    setSubmittedId("");
    setSelectedPS("");
    setSelectedHypothesis("");
    setStudyType("observational");
    setStatus("planned");
    setMethodology("");
    setAnalysisPlan("");
    setOsfLink("");
    setSelectedDataset("");
    setCustomDatasetName("");
    setResSummary("");
    setResPValue("");
    setResEffectSize("");
    setResSampleSize("");
    setResCILow("");
    setResCIHigh("");
    setSubmitError("");
  }

  if (submitted) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-stone-50/50 p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50">
          <Check className="h-5 w-5 text-teal-700" />
        </div>
        <h2 className="mb-1 font-serif text-xl font-medium text-stone-800">Experiment submitted</h2>
        <p className="mb-5 text-sm text-stone-600">
          Reference:{" "}
          <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-600">
            {submittedId}
          </code>
        </p>
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Link
            href={`/experiments/${submittedId}`}
            className="rounded-md border border-stone-900 bg-stone-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-stone-800"
          >
            View experiment
          </Link>
          <button
            onClick={resetForm}
            className="rounded-md border border-stone-300 px-4 py-2 text-[13px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Submit another
          </button>
        </div>
      </section>
    );
  }

  const methodologyRequired = status === "running" || status === "completed";
  const analysisRequired = status === "completed";
  const showAnalysis = status === "running" || status === "completed";
  const showResults = status === "completed";

  return (
    <section className="rounded-2xl border border-stone-200 bg-stone-50/50 p-8">
      <div className="mb-6 flex items-center gap-3">
        <FlaskConical className="h-6 w-6 text-stone-600" />
        <h2 className="type-heading text-stone-900">Submit an Experiment</h2>
      </div>

      {authLoading ? null : !user ? (
        <div className="py-6 text-center">
          <p className="mb-4 text-sm text-stone-600">Sign in to submit an experiment.</p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="rounded-md border border-stone-900 bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800"
          >
            Sign In
          </button>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (catalogLoading || catalogError || hypothesesLoading || hypothesesError) return;
            setSubmitting(true);
            setSubmitError("");
            try {
              const ds = datasets.find((d) => d.id === selectedDataset);
              const hasResults = status === "completed";
              const res = await submitExperiment({
                hypothesisId: selectedHypothesis,
                problemStatementId: selectedPS || undefined,
                type: studyType,
                datasetId:
                  datasetMode === "platform" && selectedDataset ? selectedDataset : undefined,
                datasetName: datasetMode === "platform" ? ds?.name || "" : customDatasetName,
                status,
                methodology: methodology || undefined,
                analysisPlan: analysisPlan || undefined,
                osfLink: osfLink || undefined,
                results: hasResults
                  ? {
                      summary: resSummary || undefined,
                      pValue: resPValue ? parseFloat(resPValue) : undefined,
                      effectSize: resEffectSize ? parseFloat(resEffectSize) : undefined,
                      sampleSize: resSampleSize ? parseInt(resSampleSize, 10) : undefined,
                      confidenceIntervalLow: resCILow ? parseFloat(resCILow) : undefined,
                      confidenceIntervalHigh: resCIHigh ? parseFloat(resCIHigh) : undefined,
                    }
                  : undefined,
              });
              hypothesisRequests.current.invalidate();
              hypothesisChoices.current.clear();
              setSubmittedId(res.data.id);
              setSubmitted(true);
              onSubmitted();
            } catch (err) {
              setSubmitError(err instanceof Error ? err.message : "Submission failed");
            } finally {
              setSubmitting(false);
            }
          }}
          className="space-y-5"
        >
          {catalogLoading && <p role="status">Loading problem statements and datasets...</p>}
          {catalogError && (
            <p role="alert" className="text-sm text-red-700">
              {catalogError}{" "}
              <button type="button" onClick={() => setCatalogRetry((n) => n + 1)}>
                Retry
              </button>
            </p>
          )}
          {/* Problem Statement */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-stone-700">
              Problem Statement
            </label>
            <div className="relative">
              <select
                value={selectedPS}
                onChange={(e) => {
                  hypothesisRequests.current.invalidate();
                  setHypotheses([]);
                  setSelectedHypothesis("");
                  setHypothesesError("");
                  setHypothesesLoading(!!e.target.value);
                  setSelectedPS(e.target.value);
                }}
                className={`${inputClass} appearance-none pr-9`}
                required
                disabled={catalogLoading || !!catalogError}
              >
                <option value="">Select a problem statement...</option>
                {problemStatements.map((ps) => (
                  <option key={ps.id} value={ps.id}>
                    {ps.question}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-stone-500" />
            </div>
          </div>

          {/* Hypothesis */}
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <label className="text-sm font-semibold text-stone-700">
                Hypothesis Being Tested
              </label>
              <Link
                href="/submit"
                className="text-xs font-medium text-stone-600 transition-colors hover:text-stone-900"
              >
                Hypothesis not on OpenExperiments yet? Add here &rarr;
              </Link>
            </div>
            <div className="relative">
              <select
                value={selectedHypothesis}
                onChange={(e) => setSelectedHypothesis(e.target.value)}
                className={`${inputClass} appearance-none pr-9`}
                required
                disabled={!selectedPS || hypothesesLoading || !!hypothesesError}
              >
                <option value="">
                  {hypothesesLoading
                    ? "Loading hypotheses..."
                    : selectedPS
                      ? "Select a hypothesis..."
                      : "Select a problem statement first"}
                </option>
                {hypotheses.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.statement.length > 120 ? h.statement.slice(0, 120) + "..." : h.statement}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-stone-500" />
            </div>
            {hypothesesLoading && (
              <p role="status" className="mt-2 text-sm text-stone-600">
                Loading hypotheses...
              </p>
            )}
            {hypothesesError && (
              <p role="alert" className="mt-2 text-sm text-red-700">
                {hypothesesError}{" "}
                <button type="button" onClick={() => setHypothesesRetry((n) => n + 1)}>
                  Retry
                </button>
              </p>
            )}
          </div>

          {/* Study Type */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-stone-700">Study Type</label>
            <div className="flex flex-wrap gap-2">
              {EXP_TYPE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:border-stone-300"
                >
                  <input
                    type="radio"
                    name="studyType"
                    value={opt.value}
                    checked={studyType === opt.value}
                    onChange={(e) => setStudyType(e.target.value)}
                    className="text-stone-900 focus:ring-stone-900"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Dataset */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-stone-700">Dataset</label>
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                onClick={() => setDatasetMode("platform")}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  datasetMode === "platform"
                    ? "bg-stone-900 text-white"
                    : "border border-stone-200 text-stone-600 hover:border-stone-300"
                }`}
              >
                From platform
              </button>
              <button
                type="button"
                onClick={() => setDatasetMode("custom")}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  datasetMode === "custom"
                    ? "bg-stone-900 text-white"
                    : "border border-stone-200 text-stone-600 hover:border-stone-300"
                }`}
              >
                Custom dataset
              </button>
            </div>
            {datasetMode === "platform" ? (
              <div className="relative">
                <select
                  value={selectedDataset}
                  onChange={(e) => setSelectedDataset(e.target.value)}
                  className={`${inputClass} appearance-none pr-9`}
                  required
                  disabled={catalogLoading || !!catalogError}
                >
                  <option value="">Select a dataset...</option>
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-stone-500" />
              </div>
            ) : (
              <input
                type="text"
                value={customDatasetName}
                onChange={(e) => setCustomDatasetName(e.target.value)}
                placeholder="Dataset name (e.g., Fortune 500 Consumer Brand)"
                className={inputClass}
                required
              />
            )}
          </div>

          {/* Current Status */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-stone-700">
              Current Status
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    status === opt.value
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="status"
                    value={opt.value}
                    checked={status === opt.value}
                    onChange={(e) => setStatus(e.target.value)}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Conditional fields based on status */}
          <div className="space-y-5 rounded-xl border border-stone-200 bg-white p-5">
            <p className="text-xs font-medium tracking-wider text-stone-600 uppercase">
              {status === "planned" && "Planned Details"}
              {status === "running" && "Running Details"}
              {status === "completed" && "Completed Details"}
            </p>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-stone-700">
                Methodology
                {methodologyRequired ? (
                  <span className="ml-1 text-red-700">*</span>
                ) : (
                  <span className="ml-1 font-normal text-stone-600">(optional)</span>
                )}
              </label>
              <textarea
                value={methodology}
                onChange={(e) => setMethodology(e.target.value)}
                placeholder="Describe your experimental design, variables, analysis approach..."
                rows={3}
                className={inputClass}
                required={methodologyRequired}
              />
            </div>

            {showAnalysis && (
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-stone-700">
                  Analysis Plan
                  {analysisRequired ? (
                    <span className="ml-1 text-red-700">*</span>
                  ) : (
                    <span className="ml-1 font-normal text-stone-600">(optional)</span>
                  )}
                </label>
                <textarea
                  value={analysisPlan}
                  onChange={(e) => setAnalysisPlan(e.target.value)}
                  placeholder="Pre-specify your analysis approach, statistical tests, corrections..."
                  rows={3}
                  className={inputClass}
                  required={analysisRequired}
                />
              </div>
            )}

            {showResults && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-stone-700">
                    Results Summary <span className="ml-1 text-red-700">*</span>
                  </label>
                  <textarea
                    value={resSummary}
                    onChange={(e) => setResSummary(e.target.value)}
                    placeholder="Summarize your findings, key observations, and conclusions..."
                    rows={3}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-stone-700">
                    Key Metrics <span className="font-normal text-stone-600">(optional)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium tracking-wider text-stone-600 uppercase">
                        p-value
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={resPValue}
                        onChange={(e) => setResPValue(e.target.value)}
                        placeholder="0.002"
                        className={metricInputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium tracking-wider text-stone-600 uppercase">
                        Effect Size
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={resEffectSize}
                        onChange={(e) => setResEffectSize(e.target.value)}
                        placeholder="0.33"
                        className={metricInputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium tracking-wider text-stone-600 uppercase">
                        Sample Size
                      </label>
                      <input
                        type="number"
                        step="1"
                        value={resSampleSize}
                        onChange={(e) => setResSampleSize(e.target.value)}
                        placeholder="2500"
                        className={metricInputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium tracking-wider text-stone-600 uppercase">
                        95% CI
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="any"
                          value={resCILow}
                          onChange={(e) => setResCILow(e.target.value)}
                          placeholder="0.18"
                          className={metricInputClass}
                        />
                        <span className="text-stone-500">&ndash;</span>
                        <input
                          type="number"
                          step="any"
                          value={resCIHigh}
                          onChange={(e) => setResCIHigh(e.target.value)}
                          placeholder="0.48"
                          className={metricInputClass}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* OSF Link */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-stone-700">
              OSF Pre-registration Link{" "}
              <span className="font-normal text-stone-600">(optional)</span>
            </label>
            <input
              type="url"
              value={osfLink}
              onChange={(e) => setOsfLink(e.target.value)}
              placeholder="https://osf.io/..."
              className={inputClass}
            />
          </div>

          {submitError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={
              submitting ||
              catalogLoading ||
              !!catalogError ||
              hypothesesLoading ||
              !!hypothesesError
            }
            className="w-full rounded-md border border-stone-900 bg-stone-900 py-3 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Experiment"}
          </button>
        </form>
      )}
    </section>
  );
}
