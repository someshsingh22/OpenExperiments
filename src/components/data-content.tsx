"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ExternalLink, Database, AlertCircle, Plus } from "lucide-react";
import { getDatasets } from "@/lib/api";
import { DomainTag } from "@/components/domain-tag";
import { SITE_CONFIG } from "@/lib/constants";
import type { Dataset, Domain } from "@/lib/types";

const BASE_DOMAINS = ["persuasion", "memorability"];

interface DataContentProps {
  initialDatasets: Dataset[];
}

export function DataContent({ initialDatasets }: DataContentProps) {
  const [datasets, setDatasets] = useState<Dataset[]>(initialDatasets);
  const [loading, setLoading] = useState(false);
  const [domain, setDomain] = useState("all");

  const handleDomainChange = (newDomain: string) => {
    setDomain(newDomain);
    if (newDomain === "all") {
      setDatasets(initialDatasets);
      return;
    }
    setLoading(true);
    getDatasets({ domain: newDomain })
      .then((res) => setDatasets(res.data))
      .finally(() => setLoading(false));
  };

  const domainFilters = useMemo(() => {
    const fromData = initialDatasets.map((d) => d.domain).filter((d): d is string => !!d);
    const all = [...new Set([...BASE_DOMAINS, ...fromData])];
    return [
      { value: "all", label: "All" },
      ...all.map((d) => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) })),
    ];
  }, [initialDatasets]);

  const needsPS = datasets.filter((d) => d.problemStatementCount === 0);
  const hasPS = datasets.filter((d) => (d.problemStatementCount ?? 0) > 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          Datasets
        </h1>
        <p className="mt-3 text-base leading-relaxed text-stone-600">
          Hugging Face datasets registered as research instruments. Each carries an OSF-style
          scientific characterization — provenance, collection, variables, and inclusion rules — so
          every hypothesis tested on it inherits a shared understanding of the data.
        </p>
        <div className="mt-5">
          <Link
            href="/data/submit"
            className="inline-flex items-center gap-2 rounded-md border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
          >
            <Plus className="h-4 w-4" />
            Register a dataset
          </Link>
        </div>
      </header>

      {/* Domain filter */}
      <div className="mb-8 flex gap-1.5">
        {domainFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => handleDomainChange(f.value)}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              domain === f.value
                ? "bg-stone-900 text-white"
                : "border border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-stone-500">Loading datasets...</div>
      ) : datasets.length === 0 ? (
        <div className="py-20 text-center text-sm text-stone-500">No datasets found.</div>
      ) : (
        <>
          {needsPS.length > 0 && (
            <section className="mb-10">
              <div className="mb-4 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold tracking-wider text-amber-700 uppercase">
                  Needs Problem Statements
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {needsPS.map((d) => (
                  <DatasetCard key={d.id} dataset={d} highlighted />
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {hasPS.map((d) => (
              <DatasetCard key={d.id} dataset={d} />
            ))}
          </div>
        </>
      )}

      {/* Suggest a Dataset CTA */}
      <section className="mt-16 rounded-2xl border border-stone-200 bg-stone-50/50 p-8 text-center">
        <Database className="mx-auto mb-3 h-8 w-8 text-stone-500" />
        <h2 className="text-xl font-semibold text-stone-900">Have a dataset to register?</h2>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-stone-600">
          Link a Hugging Face dataset and answer a few OSF-style questions about its provenance,
          variables, and inclusion rules. It becomes a first-class instrument that hypotheses can be
          tested against and cite.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/data/submit"
            className="inline-flex items-center gap-2 rounded-md border border-stone-900 bg-stone-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
          >
            <Plus className="h-4 w-4" />
            Register a dataset
          </Link>
          <a
            href={SITE_CONFIG.links.github}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-stone-300 px-6 py-3 text-sm font-semibold text-stone-600 transition-colors hover:bg-stone-50"
          >
            Discuss on GitHub
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </section>
    </div>
  );
}

function DatasetCard({ dataset, highlighted }: { dataset: Dataset; highlighted?: boolean }) {
  return (
    <Link
      href={`/data/${dataset.id}`}
      className={`group block rounded-lg border bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] ${
        highlighted
          ? "border-amber-200 hover:border-amber-300"
          : "border-stone-200 hover:border-stone-300"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-stone-900 group-hover:text-black">
          {dataset.name}
        </h3>
        <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-stone-300 group-hover:text-stone-500" />
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {dataset.domain && <DomainTag domain={dataset.domain as Domain} />}
        {highlighted && (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-600/20 ring-inset">
            Needs Problem Statements
          </span>
        )}
      </div>

      <p className="line-clamp-2 text-[13px] leading-relaxed text-stone-600">
        {dataset.description ||
          dataset.osfCharacterization?.provenance ||
          dataset.unitOfAnalysis ||
          dataset.taskDescription}
      </p>

      <div className="mt-3 flex items-center gap-3 text-[11px] text-stone-500">
        <span>{dataset.problemStatementCount ?? 0} problem statements</span>
        <span>&middot;</span>
        <span>{dataset.experimentCount ?? 0} experiments</span>
      </div>
    </Link>
  );
}
