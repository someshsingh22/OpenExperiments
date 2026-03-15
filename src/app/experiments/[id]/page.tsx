"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  FlaskConical,
  Calendar,
  Database,
  User,
  Pencil,
  History,
  X,
} from "lucide-react";
import { getExperiment, updateExperiment } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { DomainTag } from "@/components/domain-tag";
import type { Experiment, ExperimentVersion, Domain } from "@/lib/types";

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

const STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
] as const;

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function ExperimentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const versionParam = searchParams.get("version");
  const { user } = useAuth();

  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [hypothesis, setHypothesis] = useState<{
    id: string;
    statement: string;
    status: string;
    phase: string;
    domains: string[];
  } | null>(null);
  const [versions, setVersions] = useState<ExperimentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editStatus, setEditStatus] = useState("");
  const [editMethodology, setEditMethodology] = useState("");
  const [editAnalysis, setEditAnalysis] = useState("");
  const [editOsfLink, setEditOsfLink] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editPValue, setEditPValue] = useState("");
  const [editEffectSize, setEditEffectSize] = useState("");
  const [editSampleSize, setEditSampleSize] = useState("");
  const [editCILow, setEditCILow] = useState("");
  const [editCIHigh, setEditCIHigh] = useState("");
  const [editChangeSummary, setEditChangeSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const viewingVersion = versionParam ? parseInt(versionParam, 10) : null;

  function loadExperiment() {
    if (!id) return;
    setLoading(true);
    getExperiment(id, viewingVersion ?? undefined)
      .then((res) => {
        setExperiment(res.data);
        setHypothesis(res.hypothesis ?? null);
        setVersions(res.versions ?? []);
      })
      .catch(() => setError("Experiment not found"))
      .finally(() => setLoading(false));
  }

  useEffect(loadExperiment, [id, viewingVersion]);

  function startEditing() {
    if (!experiment) return;
    setEditStatus(experiment.status);
    setEditMethodology(experiment.methodology || "");
    setEditAnalysis(experiment.analysisPlan || "");
    setEditOsfLink(experiment.osfLink || "");
    setEditSummary(experiment.results?.summary || "");
    setEditPValue(experiment.results?.pValue != null ? String(experiment.results.pValue) : "");
    setEditEffectSize(experiment.results?.effectSize != null ? String(experiment.results.effectSize) : "");
    setEditSampleSize(experiment.results?.sampleSize != null ? String(experiment.results.sampleSize) : "");
    setEditCILow(experiment.results?.confidenceInterval?.[0] != null ? String(experiment.results.confidenceInterval[0]) : "");
    setEditCIHigh(experiment.results?.confidenceInterval?.[1] != null ? String(experiment.results.confidenceInterval[1]) : "");
    setEditChangeSummary("");
    setSaveError("");
    setEditing(true);
  }

  async function handleSave() {
    if (!experiment) return;
    setSaving(true);
    setSaveError("");
    try {
      const hasResults = editStatus === "completed";
      await updateExperiment(experiment.id, {
        status: editStatus,
        methodology: editMethodology || undefined,
        analysisPlan: editAnalysis || undefined,
        osfLink: editOsfLink || undefined,
        results: hasResults
          ? {
              summary: editSummary || undefined,
              pValue: editPValue ? parseFloat(editPValue) : undefined,
              effectSize: editEffectSize ? parseFloat(editEffectSize) : undefined,
              sampleSize: editSampleSize ? parseInt(editSampleSize, 10) : undefined,
              confidenceIntervalLow: editCILow ? parseFloat(editCILow) : undefined,
              confidenceIntervalHigh: editCIHigh ? parseFloat(editCIHigh) : undefined,
            }
          : undefined,
        changeSummary: editChangeSummary || undefined,
      });
      setEditing(false);
      loadExperiment();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center text-sm text-stone-400">
        Loading experiment...
      </div>
    );
  }

  if (error || !experiment) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <p className="text-sm text-stone-500">{error || "Experiment not found"}</p>
        <Link href="/experiments" className="mt-4 inline-block text-sm font-medium text-stone-600 hover:text-stone-900">
          &larr; Back to experiments
        </Link>
      </div>
    );
  }

  const typeMeta = EXP_TYPE_LABELS[experiment.type] || EXP_TYPE_LABELS.observational;
  const statusMeta = STATUS_LABELS[experiment.status] || STATUS_LABELS.planned;
  const isAuthor = user && experiment.submitter && user.id === experiment.submitter.id;
  const isViewingOld = viewingVersion != null && viewingVersion < (experiment.totalVersions ?? experiment.version);

  const inputClass =
    "w-full rounded-md border border-stone-200 px-3 py-2.5 text-sm text-stone-800 placeholder-stone-400 transition-colors focus:border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-300";
  const metricInputClass =
    "w-full rounded-md border border-stone-200 px-3 py-2 text-sm font-mono text-stone-800 placeholder-stone-400 transition-colors focus:border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-300";

  const editMethodologyRequired = editStatus === "running" || editStatus === "completed";
  const editAnalysisRequired = editStatus === "completed";
  const editShowAnalysis = editStatus === "running" || editStatus === "completed";
  const editShowResults = editStatus === "completed";

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <Link
        href="/experiments"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All Experiments
      </Link>

      {/* Version banner */}
      {isViewingOld && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-2.5 text-sm text-amber-700">
          <span>You are viewing version {viewingVersion} of {experiment.totalVersions}.</span>
          <button
            onClick={() => router.push(`/experiments/${id}`)}
            className="font-medium underline underline-offset-2 hover:text-amber-900"
          >
            View latest
          </button>
        </div>
      )}

      {/* Header */}
      <header className="mb-10">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <FlaskConical className="h-5 w-5 text-stone-400" />
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${typeMeta.cls}`}>
            {typeMeta.label}
          </span>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${statusMeta.cls}`}>
            {statusMeta.label}
          </span>
          {(experiment.totalVersions ?? 1) > 1 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
              <History className="h-3 w-3" />
              v{experiment.version}
            </span>
          )}
          {isAuthor && !editing && !isViewingOld && (
            <button
              onClick={startEditing}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 transition-all hover:border-stone-400 hover:text-stone-900"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          )}
        </div>

        <h1 className="text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
          {experiment.datasetName}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-[13px] text-stone-500">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Started {experiment.startedAt}
          </span>
          {experiment.completedAt && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Completed {experiment.completedAt}
            </span>
          )}
          {experiment.submitter && (
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {experiment.submitter.name || "Anonymous"}
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {experiment.osfLink && (
            <a
              href={experiment.osfLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800"
            >
              View OSF Registration
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {experiment.datasetId && (
            <Link
              href={`/data/${experiment.datasetId}`}
              className="inline-flex items-center gap-2 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:border-stone-400 hover:text-stone-800"
            >
              <Database className="h-3.5 w-3.5" />
              View Dataset
            </Link>
          )}
        </div>
      </header>

      {/* Hypothesis */}
      {hypothesis && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-400">
            Hypothesis Being Tested
          </h2>
          <Link
            href={`/hypothesis/${hypothesis.id}`}
            className="block rounded-lg border border-stone-200 bg-white p-5 transition-colors hover:border-stone-300 hover:bg-stone-50/50"
          >
            <div className="mb-2 flex flex-wrap gap-1.5">
              {hypothesis.domains.map((d) => (
                <DomainTag key={d} domain={d as Domain} />
              ))}
            </div>
            <p className="text-[13px] leading-relaxed text-stone-700">
              {hypothesis.statement}
            </p>
          </Link>
        </section>
      )}

      {/* Edit mode */}
      {editing && (
        <section className="mb-10 rounded-xl border border-stone-300 bg-stone-50/50 p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">
              Edit Experiment
            </h2>
            <button
              onClick={() => setEditing(false)}
              className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-5">
            {/* Status */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-stone-700">
                Current Status
              </label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium cursor-pointer transition-colors ${
                      editStatus === opt.value
                        ? "border-stone-900 bg-stone-900 text-white"
                        : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="editStatus"
                      value={opt.value}
                      checked={editStatus === opt.value}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Methodology */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-stone-700">
                Methodology
                {editMethodologyRequired
                  ? <span className="ml-1 text-red-400">*</span>
                  : <span className="ml-1 font-normal text-stone-400">(optional)</span>}
              </label>
              <textarea
                value={editMethodology}
                onChange={(e) => setEditMethodology(e.target.value)}
                placeholder="Describe your experimental design..."
                rows={3}
                className={inputClass}
              />
            </div>

            {/* Analysis Plan */}
            {editShowAnalysis && (
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-stone-700">
                  Analysis Plan
                  {editAnalysisRequired
                    ? <span className="ml-1 text-red-400">*</span>
                    : <span className="ml-1 font-normal text-stone-400">(optional)</span>}
                </label>
                <textarea
                  value={editAnalysis}
                  onChange={(e) => setEditAnalysis(e.target.value)}
                  placeholder="Pre-specify your analysis approach..."
                  rows={3}
                  className={inputClass}
                />
              </div>
            )}

            {/* Results */}
            {editShowResults && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-stone-700">
                    Results Summary <span className="ml-1 text-red-400">*</span>
                  </label>
                  <textarea
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    placeholder="Summarize your findings, key observations, and conclusions..."
                    rows={3}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-stone-700">
                    Key Metrics <span className="font-normal text-stone-400">(optional)</span>
                </label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-stone-400">
                      p-value
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editPValue}
                      onChange={(e) => setEditPValue(e.target.value)}
                      placeholder="0.002"
                      className={metricInputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-stone-400">
                      Effect Size
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editEffectSize}
                      onChange={(e) => setEditEffectSize(e.target.value)}
                      placeholder="0.33"
                      className={metricInputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-stone-400">
                      Sample Size
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={editSampleSize}
                      onChange={(e) => setEditSampleSize(e.target.value)}
                      placeholder="2500"
                      className={metricInputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-stone-400">
                      95% CI
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="any"
                        value={editCILow}
                        onChange={(e) => setEditCILow(e.target.value)}
                        placeholder="0.18"
                        className={metricInputClass}
                      />
                      <span className="text-stone-300">&ndash;</span>
                      <input
                        type="number"
                        step="any"
                        value={editCIHigh}
                        onChange={(e) => setEditCIHigh(e.target.value)}
                        placeholder="0.48"
                        className={metricInputClass}
                      />
                    </div>
                  </div>
                </div>
                </div>
              </div>
            )}

            {/* OSF Link */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-stone-700">
                OSF Link <span className="font-normal text-stone-400">(optional)</span>
              </label>
              <input
                type="url"
                value={editOsfLink}
                onChange={(e) => setEditOsfLink(e.target.value)}
                placeholder="https://osf.io/..."
                className={inputClass}
              />
            </div>

            {/* Change summary */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-stone-700">
                Change Summary <span className="font-normal text-stone-400">(optional)</span>
              </label>
              <input
                type="text"
                value={editChangeSummary}
                onChange={(e) => setEditChangeSummary(e.target.value)}
                placeholder="What changed in this update?"
                className={inputClass}
              />
            </div>

            {saveError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {saveError}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-md border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Methodology */}
      {!editing && experiment.methodology && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-400">
            Methodology
          </h2>
          <div className="rounded-lg border border-stone-200 bg-stone-50/50 p-5">
            <p className="text-sm leading-relaxed text-stone-700 whitespace-pre-wrap">
              {experiment.methodology}
            </p>
          </div>
        </section>
      )}

      {/* Analysis Plan */}
      {!editing && experiment.analysisPlan && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-400">
            Analysis Plan
          </h2>
          <div className="rounded-lg border border-stone-200 bg-stone-50/50 p-5">
            <p className="text-sm leading-relaxed text-stone-700 whitespace-pre-wrap">
              {experiment.analysisPlan}
            </p>
          </div>
        </section>
      )}

      {/* Results */}
      {!editing && experiment.results && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-400">
            Results
          </h2>
          <div className="rounded-lg border border-stone-200 bg-white p-5">
            {experiment.results.summary && (
              <p className="text-sm leading-relaxed text-stone-700 mb-4">
                {experiment.results.summary}
              </p>
            )}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {experiment.results.pValue != null && (
                <div>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-stone-400">
                    p-value
                  </span>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-stone-800">
                    {experiment.results.pValue}
                  </p>
                </div>
              )}
              {experiment.results.effectSize != null && (
                <div>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-stone-400">
                    Effect Size
                  </span>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-stone-800">
                    {experiment.results.effectSize}
                  </p>
                </div>
              )}
              {experiment.results.sampleSize != null && (
                <div>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-stone-400">
                    Sample Size
                  </span>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-stone-800">
                    {experiment.results.sampleSize.toLocaleString()}
                  </p>
                </div>
              )}
              {experiment.results.confidenceInterval && (
                <div>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-stone-400">
                    95% CI
                  </span>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-stone-800">
                    [{experiment.results.confidenceInterval[0]}, {experiment.results.confidenceInterval[1]}]
                  </p>
                </div>
              )}
            </div>
            {experiment.results.uplift && (
              <div className="mt-4 rounded-md bg-teal-50 px-3 py-2">
                <span className="text-sm font-semibold text-teal-700">
                  Uplift: {experiment.results.uplift}
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Version History */}
      {(experiment.totalVersions ?? 1) > 1 && versions.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" />
            Version History
          </h2>
          <div className="space-y-2">
            {[...versions].reverse().map((v) => {
              const isCurrent = v.version === (experiment.totalVersions ?? experiment.version);
              const isViewing = viewingVersion === v.version || (!viewingVersion && isCurrent);
              return (
                <button
                  key={v.version}
                  onClick={() =>
                    isCurrent
                      ? router.push(`/experiments/${id}`)
                      : router.push(`/experiments/${id}?version=${v.version}`)
                  }
                  className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                    isViewing
                      ? "border-stone-400 bg-stone-50"
                      : "border-stone-200 bg-white hover:border-stone-300"
                  }`}
                >
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                    isViewing ? "bg-stone-800 text-white" : "bg-stone-100 text-stone-500"
                  }`}>
                    {v.version}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ring-1 ring-inset ${
                        STATUS_LABELS[v.status]?.cls || ""
                      }`}>
                        {STATUS_LABELS[v.status]?.label || v.status}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-medium text-stone-400">latest</span>
                      )}
                    </div>
                    {v.changeSummary && (
                      <p className="mt-0.5 text-[12px] text-stone-500 truncate">{v.changeSummary}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-stone-400 shrink-0">
                    {fmtDate(v.createdAt)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
