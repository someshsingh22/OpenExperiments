"use client";

export const runtime = "edge";

import { useState } from "react";
import Link from "next/link";
import { Check, Database, ArrowLeft } from "lucide-react";
import { submitDataset } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { GatedPreview, SignInPrompt } from "@/components/sign-in-gate";
import { draftStatusText, useFormDraft } from "@/lib/use-form-draft";
import {
  DATASET_LICENSES,
  FOREKNOWLEDGE_OPTIONS,
  OSF_SECTIONS,
  type OsfCharacterization,
} from "@/lib/osf";

const WELL_KNOWN_DOMAINS = ["persuasion", "memorability"];

type OsfSectionKey = keyof Omit<OsfCharacterization, "tags" | "foreknowledgeSummary">;

type DatasetDraft = {
  name: string;
  huggingfaceUrl: string;
  domain: string;
  license: string;
  foreknowledgeStatus: string;
  unitOfAnalysis: string;
  tagsInput: string;
  sections: Record<string, string>;
};

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const REQUIRED_SECTIONS = OSF_SECTIONS.filter((s) => s.required)
  .map((s) => lowerFirst(s.title))
  .join(", ");
const OPTIONAL_SECTIONS = OSF_SECTIONS.filter((s) => !s.required)
  .map((s) => lowerFirst(s.title))
  .join(", ");

export default function DatasetSubmitPage() {
  const { user, loading: authLoading, setShowAuthModal } = useAuth();

  const [name, setName] = useState("");
  const [huggingfaceUrl, setHuggingfaceUrl] = useState("");
  const [domain, setDomain] = useState("");
  const [license, setLicense] = useState("");
  const [foreknowledgeStatus, setForeknowledgeStatus] = useState("");
  const [unitOfAnalysis, setUnitOfAnalysis] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [sections, setSections] = useState<Record<string, string>>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { status: draftStatus, clear: clearDraft } = useFormDraft<DatasetDraft>({
    key: "oe:draft:dataset",
    values: {
      name,
      huggingfaceUrl,
      domain,
      license,
      foreknowledgeStatus,
      unitOfAnalysis,
      tagsInput,
      sections,
    },
    isEmpty:
      ![name, huggingfaceUrl, domain, license, foreknowledgeStatus, unitOfAnalysis, tagsInput].some(
        (v) => v.trim(),
      ) && !Object.values(sections).some((v) => v.trim()),
    onRestore: (d) => {
      if (typeof d.name === "string") setName(d.name);
      if (typeof d.huggingfaceUrl === "string") setHuggingfaceUrl(d.huggingfaceUrl);
      if (typeof d.domain === "string") setDomain(d.domain);
      if (typeof d.license === "string") setLicense(d.license);
      if (typeof d.foreknowledgeStatus === "string") setForeknowledgeStatus(d.foreknowledgeStatus);
      if (typeof d.unitOfAnalysis === "string") setUnitOfAnalysis(d.unitOfAnalysis);
      if (typeof d.tagsInput === "string") setTagsInput(d.tagsInput);
      if (d.sections && typeof d.sections === "object") {
        const restored: Record<string, string> = {};
        for (const [k, v] of Object.entries(d.sections)) {
          if (typeof v === "string") restored[k] = v;
        }
        setSections(restored);
      }
    },
  });

  const signedOut = !authLoading && !user;
  const setSection = (key: OsfSectionKey, value: string) => {
    setSections((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((p) => ({ ...p, [key]: "" }));
  };

  const inputClass =
    "w-full rounded-md border border-stone-200 px-3 py-2.5 text-base text-stone-800 placeholder-stone-500 transition-colors focus:border-stone-600 focus:outline-none focus:ring-1 focus:ring-stone-600";

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        <div className="rounded-lg border border-stone-200 bg-white p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50">
            <Check className="h-5 w-5 text-teal-700" />
          </div>
          <h2 className="mb-1 font-serif text-xl font-medium text-stone-800">Dataset registered</h2>
          <p className="mb-4 text-sm text-stone-600">
            Reference:{" "}
            <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-600">
              {submittedId}
            </code>
          </p>
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <Link
              href={`/data/${submittedId}`}
              className="rounded-md border border-stone-900 bg-stone-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-stone-800"
            >
              View dataset
            </Link>
            <Link
              href="/data"
              className="rounded-md border border-stone-300 px-4 py-2 text-[13px] font-medium text-stone-600 hover:bg-stone-50"
            >
              All datasets
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/data"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All Datasets
      </Link>

      <header className="mb-10">
        <div className="mb-3 flex items-center gap-2">
          <Database className="h-6 w-6 text-stone-600" />
          <h1 className="type-title text-stone-900">Register a dataset</h1>
        </div>
        <p className="text-base leading-relaxed text-stone-600">
          A dataset here is a research instrument, not a benchmark. Link a Hugging Face dataset and
          answer a few OSF-style questions so every hypothesis tested on it inherits a shared,
          scientific understanding of the data.
        </p>
      </header>

      {signedOut && (
        <SignInPrompt
          title="Sign in to register a dataset"
          items={[
            "The dataset’s name and its Hugging Face URL",
            "Whether anyone had foreknowledge of the data, and the unit of analysis",
            `Short write-ups on ${REQUIRED_SECTIONS}`,
            `Optional: domain, license, tags, ${OPTIONAL_SECTIONS}`,
          ]}
          duration="Takes about 20 minutes with the dataset’s documentation to hand. Your draft saves on this device as you write. The form is previewed below."
          actionLabel="Sign in to register"
          onSignIn={() => setShowAuthModal(true)}
        />
      )}

      <GatedPreview locked={signedOut}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!user) return;
            setSubmitting(true);
            setSubmitError("");
            setFieldErrors({});

            const tags = tagsInput
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);

            const osf = { ...sections, tags } as unknown as OsfCharacterization;

            try {
              const res = await submitDataset({
                name,
                huggingfaceUrl,
                description: undefined,
                domain: domain || undefined,
                license: license || undefined,
                foreknowledgeStatus,
                unitOfAnalysis,
                osf,
              });
              clearDraft();
              setSubmittedId(res.data.id);
              setSubmitted(true);
            } catch (err) {
              setSubmitError(err instanceof Error ? err.message : "Submission failed");
            } finally {
              setSubmitting(false);
            }
          }}
          className="space-y-6"
        >
          {/* Identity */}
          <div>
            <label htmlFor="ds-name" className="mb-1.5 block text-sm font-semibold text-stone-700">
              Dataset name
            </label>
            <input
              id="ds-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. r/ChangeMyView Persuasion Corpus"
              className={inputClass}
              maxLength={120}
            />
          </div>

          <div>
            <label htmlFor="ds-hf" className="mb-1.5 block text-sm font-semibold text-stone-700">
              Hugging Face dataset URL
            </label>
            <input
              id="ds-hf"
              type="url"
              value={huggingfaceUrl}
              onChange={(e) => setHuggingfaceUrl(e.target.value)}
              placeholder="https://huggingface.co/datasets/owner/name"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-stone-600">
              Storage, splits, and the data viewer live on Hugging Face. We only register the
              science.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ds-domain"
                className="mb-1.5 block text-sm font-semibold text-stone-700"
              >
                Domain <span className="font-normal text-stone-600">(optional)</span>
              </label>
              <input
                id="ds-domain"
                type="text"
                list="ds-domains"
                value={domain}
                onChange={(e) => setDomain(e.target.value.toLowerCase())}
                placeholder="persuasion"
                className={inputClass}
              />
              <datalist id="ds-domains">
                {WELL_KNOWN_DOMAINS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>

            <div>
              <label
                htmlFor="ds-license"
                className="mb-1.5 block text-sm font-semibold text-stone-700"
              >
                License <span className="font-normal text-stone-600">(optional)</span>
              </label>
              <select
                id="ds-license"
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                className={inputClass}
              >
                <option value="">Select a license…</option>
                {DATASET_LICENSES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Foreknowledge status */}
          <div>
            <label htmlFor="ds-fk" className="mb-1.5 block text-sm font-semibold text-stone-700">
              Foreknowledge of data
            </label>
            <p className="mb-2 text-xs text-stone-600">
              Could prior observation of the data have influenced analysis decisions? (OSF leakage
              gate)
            </p>
            {fieldErrors.foreknowledgeStatus && (
              <p className="mb-1.5 text-xs text-red-700">{fieldErrors.foreknowledgeStatus}</p>
            )}
            <select
              id="ds-fk"
              value={foreknowledgeStatus}
              onChange={(e) => {
                setForeknowledgeStatus(e.target.value);
                setFieldErrors((p) => ({ ...p, foreknowledgeStatus: "" }));
              }}
              className={inputClass}
            >
              <option value="">Select foreknowledge status…</option>
              {FOREKNOWLEDGE_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Unit of analysis */}
          <div>
            <label htmlFor="ds-unit" className="mb-1.5 block text-sm font-semibold text-stone-700">
              Unit of analysis
            </label>
            {fieldErrors.unitOfAnalysis && (
              <p className="mb-1.5 text-xs text-red-700">{fieldErrors.unitOfAnalysis}</p>
            )}
            <input
              id="ds-unit"
              type="text"
              value={unitOfAnalysis}
              onChange={(e) => {
                setUnitOfAnalysis(e.target.value);
                setFieldErrors((p) => ({ ...p, unitOfAnalysis: "" }));
              }}
              placeholder="e.g. Root comment in a r/ChangeMyView thread"
              className={inputClass}
              maxLength={300}
            />
          </div>

          {/* OSF prose sections */}
          <div className="space-y-5 rounded-lg border border-stone-200 bg-stone-50/50 p-5">
            <p className="text-sm font-semibold tracking-wider text-stone-600 uppercase">
              Scientific characterization
            </p>
            {OSF_SECTIONS.map((section) => (
              <div key={section.key}>
                <label
                  htmlFor={`ds-${section.key}`}
                  className="mb-1 block text-sm font-semibold text-stone-700"
                >
                  {section.title}
                  {!section.required && (
                    <span className="ml-1 font-normal text-stone-600">(optional)</span>
                  )}
                </label>
                <p className="mb-2 text-xs text-stone-600">{section.help}</p>
                {fieldErrors[section.key] && (
                  <p className="mb-1.5 text-xs text-red-700">{fieldErrors[section.key]}</p>
                )}
                <textarea
                  id={`ds-${section.key}`}
                  value={sections[section.key] ?? ""}
                  onChange={(e) => setSection(section.key, e.target.value)}
                  placeholder={section.placeholder}
                  rows={4}
                  className={`${inputClass} bg-white`}
                  maxLength={8000}
                />
              </div>
            ))}

            <div>
              <label htmlFor="ds-tags" className="mb-1 block text-sm font-semibold text-stone-700">
                Tags <span className="font-normal text-stone-600">(optional, comma-separated)</span>
              </label>
              <input
                id="ds-tags"
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="changemyview, persuasion, reddit, observational"
                className={`${inputClass} bg-white`}
              />
            </div>
          </div>

          {submitError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md border border-stone-900 bg-stone-900 py-3 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:opacity-50"
          >
            {submitting ? "Registering…" : "Register Dataset"}
          </button>
          <p aria-live="polite" className="-mt-3 min-h-4 text-center text-xs text-stone-600">
            {draftStatusText(draftStatus)}
          </p>
        </form>
      </GatedPreview>
    </div>
  );
}
