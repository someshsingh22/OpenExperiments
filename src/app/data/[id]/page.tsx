"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Database, FlaskConical, ArrowLeft } from "lucide-react";
import { getDataset } from "@/lib/api";
import { DomainTag } from "@/components/domain-tag";
import type { Domain } from "@/lib/types";

interface DatasetDetail {
  id: string;
  name: string;
  huggingfaceUrl: string;
  taskDescription: string;
  dataColumnNames: string[];
  targetColumnName: string;
  description?: string;
  domain?: string;
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
    getDataset(id)
      .then((res) => {
        setDataset(res.data as unknown as DatasetDetail);
        setProblemStatements(res.problemStatements);
        setExperiments(res.experiments);
      })
      .catch(() => setError("Dataset not found"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center text-sm text-stone-400">
        Loading dataset...
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <p className="text-sm text-stone-500">{error || "Dataset not found"}</p>
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      {/* Back link */}
      <Link
        href="/data"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All Datasets
      </Link>

      {/* Header */}
      <header className="mb-10">
        <div className="flex flex-wrap items-start gap-3">
          <Database className="mt-1 h-6 w-6 text-stone-400" />
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
              {dataset.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {dataset.domain && <DomainTag domain={dataset.domain as Domain} />}
              <span className="text-[11px] text-stone-400">Added {dataset.createdAt}</span>
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

      {/* Task Description */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold tracking-wider text-stone-400 uppercase">
          Task Description
        </h2>
        <div className="rounded-lg border border-stone-200 bg-stone-50/50 p-5">
          <p className="text-sm leading-relaxed text-stone-700">{dataset.taskDescription}</p>
        </div>
      </section>

      {/* Description (if any) */}
      {dataset.description && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold tracking-wider text-stone-400 uppercase">
            About
          </h2>
          <p className="text-sm leading-relaxed text-stone-600">{dataset.description}</p>
        </section>
      )}

      {/* Schema */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold tracking-wider text-stone-400 uppercase">
          Schema
        </h2>
        <div className="rounded-lg border border-stone-200 bg-white p-5">
          <div className="mb-4">
            <span className="text-xs font-medium tracking-wider text-stone-400 uppercase">
              Data Columns
            </span>
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
          <div>
            <span className="text-xs font-medium tracking-wider text-stone-400 uppercase">
              Target Column
            </span>
            <div className="mt-2">
              <code className="rounded-md bg-teal-50 px-2.5 py-1 font-mono text-xs font-semibold text-teal-700 ring-1 ring-teal-600/20 ring-inset">
                {dataset.targetColumnName}
              </code>
            </div>
          </div>
        </div>
      </section>

      {/* Linked Problem Statements */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold tracking-wider text-stone-400 uppercase">
          Problem Statements ({problemStatements.length})
        </h2>
        {problemStatements.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
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
                <p className="mt-1 text-[11px] text-stone-400">{ps.hypothesisCount} hypotheses</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Experiments using this dataset */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold tracking-wider text-stone-400 uppercase">
          Experiments ({experiments.length})
        </h2>
        {experiments.length === 0 ? (
          <p className="text-sm text-stone-400">No experiments using this dataset yet.</p>
        ) : (
          <div className="space-y-3">
            {experiments.map((exp) => (
              <Link
                key={exp.id}
                href={`/hypothesis/${exp.hypothesisId}`}
                className="block rounded-lg border border-stone-200 bg-white p-4 transition-colors hover:border-stone-300"
              >
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-3.5 w-3.5 text-stone-400" />
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
                    {EXP_TYPE_LABELS[exp.type] || exp.type}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
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
                <p className="mt-2 line-clamp-2 text-[13px] text-stone-600">{exp.methodology}</p>
                <p className="mt-1 text-[11px] text-stone-400">
                  Started {exp.startedAt} &middot; Hypothesis {exp.hypothesisId}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
