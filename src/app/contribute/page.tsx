import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Database, Cpu, Code2, Users, FileText } from "lucide-react";
import { SITE_CONFIG } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contribute",
  description: `Join the ${SITE_CONFIG.name} community. Submit hypotheses, vote in the arena, suggest datasets, contribute code, or support compute.`,
  openGraph: {
    title: `Contribute to ${SITE_CONFIG.name}`,
    description: `Help democratise science. Submit ideas, vote, suggest datasets, or contribute to development.`,
    url: `${SITE_CONFIG.url}/contribute`,
  },
  alternates: { canonical: `${SITE_CONFIG.url}/contribute` },
};

export default function ContributePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <header className="mb-12">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          Contribute to {SITE_CONFIG.name}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-stone-600">
          {SITE_CONFIG.name} thrives on community involvement. Whether you are a researcher, a
          developer, or just curious, there are many ways you can help democratise science.
        </p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Core Interactions */}
        <section className="rounded-xl border border-stone-200 bg-white p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100 text-stone-700">
            <Users className="h-5 w-5" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-stone-900">Core Participation</h2>
          <p className="mb-4 text-sm leading-relaxed text-stone-600">
            The easiest way to contribute is to use the platform. Submit your ideas, evaluate
            hypotheses in the arena, or conduct your own field experiments.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/submit"
              className="text-sm font-semibold text-stone-900 decoration-stone-400 underline-offset-2 hover:underline"
            >
              Submit ideas &rarr;
            </Link>
            <Link
              href="/arena"
              className="text-sm font-semibold text-stone-900 decoration-stone-400 underline-offset-2 hover:underline"
            >
              Vote in arena &rarr;
            </Link>
            <Link
              href="/experiments#submit"
              className="text-sm font-semibold text-stone-900 decoration-stone-400 underline-offset-2 hover:underline"
            >
              Conduct experiments &rarr;
            </Link>
          </div>
        </section>

        {/* Compute Support */}
        <section className="rounded-xl border border-stone-200 bg-white p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100 text-stone-700">
            <Cpu className="h-5 w-5" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-stone-900">Compute Support</h2>
          <p className="mb-4 text-sm leading-relaxed text-stone-600">
            Do you want to help us with compute for running more hypothesis tests or pre-registered
            studies? We are always looking for computing partners.
          </p>
          <a
            href={`mailto:${SITE_CONFIG.contactEmail}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-900 decoration-stone-400 underline-offset-2 hover:underline"
          >
            Reach out to us <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </section>

        {/* Datasets */}
        <section className="rounded-xl border border-stone-200 bg-white p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100 text-stone-700">
            <Database className="h-5 w-5" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-stone-900">Suggest Datasets</h2>
          <p className="mb-4 text-sm leading-relaxed text-stone-600">
            Have a great Hugging Face dataset we should add? Datasets and problem statements are
            reviewed weekly. Open a PR with the HF link, task description, and column schema.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={SITE_CONFIG.links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-900 decoration-stone-400 underline-offset-2 hover:underline"
            >
              Suggest via PR <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Link
              href="/data"
              className="text-sm font-semibold text-stone-900 decoration-stone-400 underline-offset-2 hover:underline"
            >
              Browse datasets &rarr;
            </Link>
          </div>
        </section>

        {/* Algorithmic Development */}
        <section className="rounded-xl border border-stone-200 bg-white p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100 text-stone-700">
            <FileText className="h-5 w-5" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-stone-900">Algorithmic Development</h2>
          <p className="mb-4 text-sm leading-relaxed text-stone-600">
            Help improve ExperiGen. Suggest better prompts, new AI agents, improved testing
            pipelines, or featurization methods.
          </p>
          <a
            href={`${SITE_CONFIG.links.github}/issues`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-900 decoration-stone-400 underline-offset-2 hover:underline"
          >
            Raise an issue on GitHub <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </section>

        {/* Website Development */}
        <section className="rounded-xl border border-stone-200 bg-stone-50/50 p-6 sm:col-span-2">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white text-stone-700 shadow-sm">
                <Code2 className="h-5 w-5" />
              </div>
              <h2 className="mb-2 text-lg font-semibold text-stone-900">Website Development</h2>
              <p className="text-sm leading-relaxed text-stone-600">
                Have any issues or suggestions for the website? Please raise a request at our
                GitHub.
                <strong className="mt-2 block font-semibold text-stone-900">
                  Note: We are actively looking for Developers to help us maintain this website!
                </strong>
              </p>
            </div>
            <div className="shrink-0">
              <a
                href={SITE_CONFIG.links.github}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-stone-900 bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
              >
                Join our Development Team
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
