"use client";

export const runtime = "edge";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Database, FlaskConical, ArrowLeft } from "lucide-react";
import { getDataset } from "@/lib/api";
import { DomainTag } from "@/components/domain-tag";
import { DatasetInlineText, VariableDictionary } from "@/components/dataset-prose";
import { OSF_SECTIONS, foreknowledgeLabel, type OsfCharacterization } from "@/lib/osf";
import type { Domain } from "@/lib/types";
import { formatDate } from "@/lib/format";

interface DatasetDetail {
  id: string;
  name: string;
  huggingfaceUrl: string;
  taskDescription?: string | null;
  dataColumnNames?: string[] | null;
  targetColumnName?: string | null;
  description?: string | null;
  domain?: string | null;
  license?: string | null;
  foreknowledgeStatus?: string | null;
  unitOfAnalysis?: string | null;
  osfCharacterization?: OsfCharacterization | null;
  createdAt: string;
}

interface LinkedPS {
  id: string;
  question: string;
  domain: string;
  hypothesisCount: number;
}

interface LinkedExp {
  id: string;
  hypothesisId: string;
  type: string;
  status: string;
  methodology: string;
  startedAt: string;
}

export default function DatasetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [dataset, setDataset] = useState<DatasetDetail | null>(null);
  const [problemStatements, setProblemStatements] = useState<LinkedPS[]>([]);
  const [experiments, setExperiments] = useState<LinkedExp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setError("");
    setDataset(null);
    setProblemStatements([]);
    setExperiments([]);
    getDataset(id)
      .then((res) => {
        if (!active) return;
        setDataset(res.data);
        setProblemStatements(res.problemStatements);
        setExperiments(res.experiments);
      })
      .catch(() => {
        if (active) setError("Dataset not found");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center text-sm text-stone-600">
        Loading dataset...
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <p className="text-sm text-stone-600">{error || "Dataset not found"}</p>
        <Link
          href="/data"
          className="mt-4 inline-block text-sm font-medium text-stone-600 hover:text-stone-900"
        >
          &larr; Back to datasets
        </Link>
      </div>
    );
  }

  const EXP_TYPE_LABELS: Record<string, string> = {
    observational: "Observational",
    survey: "Survey",
    ab_test: "A/B Test",
    pre_registered: "Pre-registered",
  };
  const foreknowledge =
    dataset.osfCharacterization?.foreknowledgeSummary ??
    foreknowledgeLabel(dataset.foreknowledgeStatus);

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      {/* Back link */}
      <Link
        href="/data"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All Datasets
      </Link>

      {/* Header */}
      <header className="mb-10">
        <div className="flex flex-wrap items-start gap-3">
          <Database className="mt-1 h-6 w-6 text-stone-600" />
          <div className="flex-1">
            <h1 className="type-title text-stone-900">{dataset.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {dataset.domain && <DomainTag domain={dataset.domain as Domain} />}
              <span className="text-xs text-stone-600">
                Added{" "}
                <time dateTime={dataset.createdAt} className="type-data">
                  {formatDate(dataset.createdAt)}
                </time>
              </span>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <a
            href={dataset.huggingfaceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800"
          >
            View on Hugging Face
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </header>

      {dataset.osfCharacterization && dataset.description && (
        <p className="mb-8 max-w-prose text-sm leading-relaxed text-stone-600">
          <DatasetInlineText text={dataset.description} />
        </p>
      )}

      {/* Registration metadata strip */}
      {(dataset.license || foreknowledge || dataset.unitOfAnalysis) && (
        <section className="mb-10 grid gap-3 rounded-lg border border-stone-200 bg-stone-50/50 p-5 sm:grid-cols-3">
          {dataset.unitOfAnalysis && (
            <div>
              <span className="text-xs font-medium tracking-wider text-stone-600 uppercase">
                Unit of analysis
              </span>
              <p className="mt-1 text-sm text-stone-700">
                <DatasetInlineText text={dataset.unitOfAnalysis} />
              </p>
            </div>
          )}
          {foreknowledge && (
            <div>
              <span className="text-xs font-medium tracking-wider text-stone-600 uppercase">
                Foreknowledge
              </span>
              <p className="mt-1 text-sm text-stone-700">
                <DatasetInlineText text={foreknowledge} />
              </p>
            </div>
          )}
          {dataset.license && (
            <div>
              <span className="text-xs font-medium tracking-wider text-stone-600 uppercase">
                License
              </span>
              <p className="mt-1 text-sm leading-relaxed text-stone-700">
                <DatasetInlineText text={dataset.license} />
              </p>
            </div>
          )}
        </section>
      )}

      {/* OSF scientific characterization */}
      {dataset.osfCharacterization ? (
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-semibold tracking-wider text-stone-600 uppercase">
            Scientific Characterization
          </h2>
          <div className="space-y-5">
            {OSF_SECTIONS.map((section) => {
              const value = dataset.osfCharacterization?.[section.key];
              if (!value) return null;
              return (
                <div key={section.key} className="rounded-lg border border-stone-200 bg-white p-5">
                  <h3 className="mb-1 text-sm font-semibold text-stone-800">{section.title}</h3>
                  {section.key === "variables" ? (
                    <VariableDictionary text={value} />
                  ) : (
                    <p className="max-w-prose text-sm leading-relaxed whitespace-pre-line text-stone-700">
                      <DatasetInlineText text={value} />
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {dataset.osfCharacterization.tags && dataset.osfCharacterization.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {dataset.osfCharacterization.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {/* Legacy datasets: task description + schema */}
          {dataset.taskDescription && (
            <section className="mb-10">
              <h2 className="mb-3 text-sm font-semibold tracking-wider text-stone-600 uppercase">
                Task Description
              </h2>
              <div className="rounded-lg border border-stone-200 bg-stone-50/50 p-5">
                <p className="max-w-prose text-sm leading-relaxed text-stone-700">
                  <DatasetInlineText text={dataset.taskDescription} />
                </p>
              </div>
            </section>
          )}

          {dataset.description && (
            <section className="mb-10">
              <h2 className="mb-3 text-sm font-semibold tracking-wider text-stone-600 uppercase">
                About
              </h2>
              <p className="max-w-prose text-sm leading-relaxed text-stone-700">
                <DatasetInlineText text={dataset.description} />
              </p>
            </section>
          )}
        </>
      )}

      {dataset.dataColumnNames && dataset.dataColumnNames.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold tracking-wider text-stone-600 uppercase">
            Schema
          </h2>
          <div className="rounded-lg border border-stone-200 bg-white p-5">
            <div className="mb-4">
              <span className="text-xs font-medium tracking-wider text-stone-600 uppercase">
                Selected Input Columns
              </span>
              <p className="mt-1 text-xs text-stone-600">
                The source dataset may contain additional columns.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {dataset.dataColumnNames.map((col) => (
                  <code
                    key={col}
                    className="rounded-md bg-stone-100 px-2.5 py-1 font-mono text-xs text-stone-700"
                  >
                    {col}
                  </code>
                ))}
              </div>
            </div>
            {dataset.targetColumnName && (
              <div>
                <span className="text-xs font-medium tracking-wider text-stone-600 uppercase">
                  Target Column
                </span>
                <div className="mt-2">
                  <code className="rounded-md bg-teal-50 px-2.5 py-1 font-mono text-xs font-semibold text-teal-700 ring-1 ring-teal-600/20 ring-inset">
                    {dataset.targetColumnName}
                  </code>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Linked Problem Statements */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold tracking-wider text-stone-600 uppercase">
          Problem Statements ({problemStatements.length})
        </h2>
        {problemStatements.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No problem statements linked yet. This dataset needs research questions.
          </p>
        ) : (
          <div className="space-y-3">
            {problemStatements.map((ps) => (
              <Link
                key={ps.id}
                href={`/explore?ps=${ps.id}`}
                className="block rounded-lg border border-stone-200 bg-white p-4 transition-colors hover:border-stone-300 hover:bg-stone-50/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-stone-800">{ps.question}</p>
                  <DomainTag domain={ps.domain as Domain} />
                </div>
                <p className="mt-1 text-xs text-stone-600">{ps.hypothesisCount} hypotheses</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Experiments using this dataset */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold tracking-wider text-stone-600 uppercase">
          Experiments ({experiments.length})
        </h2>
        {experiments.length === 0 ? (
          <p className="text-sm text-stone-600">No experiments using this dataset yet.</p>
        ) : (
          <div className="space-y-3">
            {experiments.map((exp) => (
              <Link
                key={exp.id}
                href={`/hypothesis/${exp.hypothesisId}`}
                className="block rounded-lg border border-stone-200 bg-white p-4 transition-colors hover:border-stone-300"
              >
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-3.5 w-3.5 text-stone-600" />
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600">
                    {EXP_TYPE_LABELS[exp.type] || exp.type}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      exp.status === "completed"
                        ? "bg-teal-50 text-teal-700"
                        : exp.status === "running"
                          ? "bg-sky-50 text-sky-700"
                          : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {exp.status}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 max-w-prose text-[13px] text-stone-600">
                  {exp.methodology}
                </p>
                <p className="mt-1 text-xs text-stone-600">
                  Started{" "}
                  <time dateTime={exp.startedAt} className="type-data">
                    {formatDate(exp.startedAt)}
                  </time>{" "}
                  &middot; Hypothesis {exp.hypothesisId}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
