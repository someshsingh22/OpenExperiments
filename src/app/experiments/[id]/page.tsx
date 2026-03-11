"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  FlaskConical,
  Calendar,
  Database,
  User,
} from "lucide-react";
import { getExperiment } from "@/lib/api";
import { DomainTag } from "@/components/domain-tag";
import type { Experiment, Domain } from "@/lib/types";

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

export default function ExperimentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [hypothesis, setHypothesis] = useState<{
    id: string;
    statement: string;
    status: string;
    phase: string;
    domains: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    getExperiment(id)
      .then((res) => {
        setExperiment(res.data);
        setHypothesis(res.hypothesis);
      })
      .catch(() => setError("Experiment not found"))
      .finally(() => setLoading(false));
  }, [id]);

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

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      {/* Back link */}
      <Link
        href="/experiments"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All Experiments
      </Link>

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

      {/* Hypothesis being tested */}
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

      {/* Methodology */}
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

      {/* Analysis Plan */}
      {experiment.analysisPlan && (
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
      {experiment.results && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-400">
            Results
          </h2>
          <div className="rounded-lg border border-stone-200 bg-white p-5">
            <p className="text-sm leading-relaxed text-stone-700 mb-4">
              {experiment.results.summary}
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-stone-400">
                  p-value
                </span>
                <p className="mt-0.5 font-mono text-sm font-semibold text-stone-800">
                  {experiment.results.pValue}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-stone-400">
                  Effect Size
                </span>
                <p className="mt-0.5 font-mono text-sm font-semibold text-stone-800">
                  {experiment.results.effectSize}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-stone-400">
                  Sample Size
                </span>
                <p className="mt-0.5 font-mono text-sm font-semibold text-stone-800">
                  {experiment.results.sampleSize.toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-stone-400">
                  95% CI
                </span>
                <p className="mt-0.5 font-mono text-sm font-semibold text-stone-800">
                  [{experiment.results.confidenceInterval[0]}, {experiment.results.confidenceInterval[1]}]
                </p>
              </div>
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
    </div>
  );
}
