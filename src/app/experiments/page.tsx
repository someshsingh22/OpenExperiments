"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ExternalLink, FlaskConical, ChevronDown, Check, User } from "lucide-react";
import {
  getExperiments,
  getProblemStatements,
  getHypotheses,
  getDatasets,
  submitExperiment,
} from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import type { Experiment, ProblemStatement, Hypothesis, Dataset } from "@/lib/types";

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

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const submitRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getExperiments()
      .then((res) => setExperiments(res.data))
      .finally(() => setLoading(false));
  }, []);

  // Scroll to #submit on mount if hash is present
  useEffect(() => {
    if (window.location.hash === "#submit" && submitRef.current) {
      setTimeout(() => submitRef.current?.scrollIntoView({ behavior: "smooth" }), 300);
    }
  }, [loading]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <header className="mb-12">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          Experiments
        </h1>
        <p className="mt-4 text-base leading-relaxed text-stone-600">
          Pre-registered field experiments run by our team and community based on
          community-submitted hypotheses. OpenExperiments is committed to open science.
        </p>
      </header>

      {/* Submit section — first */}
      <div ref={submitRef} id="submit" className="mb-16">
        <ExperimentSubmitForm
          onSubmitted={() => {
            getExperiments().then((res) => setExperiments(res.data));
          }}
        />
      </div>

      {/* Experiments list */}
      <section>
        <h2 className="mb-6 text-xl font-semibold text-stone-900">
          All Experiments
        </h2>
        {loading ? (
          <div className="py-12 text-center text-sm text-stone-400">
            Loading experiments...
          </div>
        ) : experiments.length === 0 ? (
          <div className="py-12 text-center text-sm text-stone-400">
            No experiments yet.
          </div>
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
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeMeta.cls}`}>
          {typeMeta.label}
        </span>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${statusMeta.cls}`}>
          {statusMeta.label}
        </span>
      </div>

      <p className="mb-1 text-[13px] font-medium text-stone-800 group-hover:text-stone-900">
        {experiment.datasetName}
      </p>
      <p className="mb-2.5 text-[13px] leading-relaxed text-stone-600 line-clamp-3">
        {experiment.methodology}
      </p>

      <div className="flex items-center justify-between text-[11px] text-stone-400">
        <div className="flex items-center gap-1">
          {experiment.submitter ? (
            <>
              <User className="h-3 w-3" />
              <span className="font-medium">{experiment.submitter.name || "Anonymous"}</span>
            </>
          ) : (
            <span>{experiment.startedAt}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {experiment.results && (
            <span className="font-mono tabular-nums">
              p={experiment.results.pValue}
            </span>
          )}
          {experiment.osfLink && (
            <ExternalLink className="h-3 w-3" />
          )}
        </div>
      </div>
    </Link>
  );
}

function ExperimentSubmitForm({
  onSubmitted,
}: {
  onSubmitted: () => void;
}) {
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
  const [methodology, setMethodology] = useState("");
  const [analysisPlan, setAnalysisPlan] = useState("");
  const [osfLink, setOsfLink] = useState("");
  const [status, setStatus] = useState("planned");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState("");

  useEffect(() => {
    getProblemStatements().then((res) => setProblemStatements(res.data));
    getDatasets().then((res) => setDatasets(res.data));
  }, []);

  useEffect(() => {
    if (!selectedPS) {
      setHypotheses([]);
      setSelectedHypothesis("");
      return;
    }
    const ps = problemStatements.find((p) => p.id === selectedPS);
    if (!ps) return;
    getHypotheses({ search: ps.question, limit: 50 }).then((res) => {
      setHypotheses(res.data);
      setSelectedHypothesis("");
    });
  }, [selectedPS, problemStatements]);

  const inputClass =
    "w-full rounded-md border border-stone-200 px-3 py-2.5 text-base text-stone-800 placeholder-stone-400 transition-colors focus:border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-300";

  if (submitted) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-stone-50/50 p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50">
          <Check className="h-5 w-5 text-teal-600" />
        </div>
        <h2 className="mb-1 text-lg font-semibold text-stone-800">
          Experiment submitted
        </h2>
        <p className="mb-5 text-sm text-stone-500">
          Reference: <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-600">{submittedId}</code>
        </p>
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Link
            href={`/experiments/${submittedId}`}
            className="rounded-md border border-stone-900 bg-stone-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-stone-800"
          >
            View experiment
          </Link>
          <button
            onClick={() => {
              setSubmitted(false);
              setSubmittedId("");
              setSelectedPS("");
              setSelectedHypothesis("");
              setMethodology("");
              setAnalysisPlan("");
              setOsfLink("");
              setStudyType("observational");
              setStatus("planned");
              setSelectedDataset("");
              setCustomDatasetName("");
              setSubmitError("");
            }}
            className="rounded-md border border-stone-300 px-4 py-2 text-[13px] font-medium text-stone-600 hover:bg-stone-50"
          >
            Submit another
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-stone-50/50 p-8">
      <div className="mb-6 flex items-center gap-3">
        <FlaskConical className="h-6 w-6 text-stone-400" />
        <h2 className="text-xl font-semibold text-stone-900">
          Submit an Experiment
        </h2>
      </div>

      {authLoading ? null : !user ? (
        <div className="text-center py-6">
          <p className="text-sm text-stone-500 mb-4">
            Sign in to submit an experiment.
          </p>
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
            setSubmitting(true);
            setSubmitError("");
            try {
              const ds = datasets.find((d) => d.id === selectedDataset);
              const res = await submitExperiment({
                hypothesisId: selectedHypothesis,
                problemStatementId: selectedPS || undefined,
                type: studyType,
                datasetId: datasetMode === "platform" && selectedDataset ? selectedDataset : undefined,
                datasetName:
                  datasetMode === "platform"
                    ? ds?.name || ""
                    : customDatasetName,
                methodology,
                analysisPlan: analysisPlan || undefined,
                osfLink: osfLink || undefined,
                status,
              });
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
          {/* Problem Statement */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-stone-700">
              Problem Statement
            </label>
            <div className="relative">
              <select
                value={selectedPS}
                onChange={(e) => setSelectedPS(e.target.value)}
                className={`${inputClass} appearance-none pr-9`}
                required
              >
                <option value="">Select a problem statement...</option>
                {problemStatements.map((ps) => (
                  <option key={ps.id} value={ps.id}>
                    {ps.question}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-300" />
            </div>
          </div>

          {/* Hypothesis */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-stone-700">
              Hypothesis Being Tested
            </label>
            <div className="relative">
              <select
                value={selectedHypothesis}
                onChange={(e) => setSelectedHypothesis(e.target.value)}
                className={`${inputClass} appearance-none pr-9`}
                required
                disabled={!selectedPS}
              >
                <option value="">
                  {selectedPS ? "Select a hypothesis..." : "Select a problem statement first"}
                </option>
                {hypotheses.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.statement.length > 120
                      ? h.statement.slice(0, 120) + "..."
                      : h.statement}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-300" />
            </div>
          </div>

          {/* Study Type */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-stone-700">
              Study Type
            </label>
            <div className="flex flex-wrap gap-2">
              {EXP_TYPE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:border-stone-300 cursor-pointer"
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
            <label className="mb-1.5 block text-sm font-semibold text-stone-700">
              Dataset
            </label>
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                onClick={() => setDatasetMode("platform")}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  datasetMode === "platform"
                    ? "bg-stone-900 text-white"
                    : "border border-stone-200 text-stone-500 hover:border-stone-300"
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
                    : "border border-stone-200 text-stone-500 hover:border-stone-300"
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
                >
                  <option value="">Select a dataset...</option>
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-300" />
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

          {/* Methodology */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-stone-700">
              Methodology
            </label>
            <textarea
              value={methodology}
              onChange={(e) => setMethodology(e.target.value)}
              placeholder="Describe your experimental design, variables, analysis approach..."
              rows={4}
              className={inputClass}
              required
            />
          </div>

          {/* Analysis Plan (optional) */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-stone-700">
              Analysis Plan <span className="font-normal text-stone-400">(optional)</span>
            </label>
            <textarea
              value={analysisPlan}
              onChange={(e) => setAnalysisPlan(e.target.value)}
              placeholder="Pre-specify your analysis approach, statistical tests, corrections..."
              rows={3}
              className={inputClass}
            />
          </div>

          {/* OSF Link (optional) */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-stone-700">
              OSF Pre-registration Link <span className="font-normal text-stone-400">(optional)</span>
            </label>
            <input
              type="url"
              value={osfLink}
              onChange={(e) => setOsfLink(e.target.value)}
              placeholder="https://osf.io/..."
              className={inputClass}
            />
          </div>

          {/* Status */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-stone-700">
              Current Status
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:border-stone-300 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="status"
                    value={opt.value}
                    checked={status === opt.value}
                    onChange={(e) => setStatus(e.target.value)}
                    className="text-stone-900 focus:ring-stone-900"
                  />
                  {opt.label}
                </label>
              ))}
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
            {submitting ? "Submitting..." : "Submit Experiment"}
          </button>
        </form>
      )}
    </section>
  );
}
