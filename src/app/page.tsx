"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HypothesisCard } from "@/components/hypothesis-card";
import { ArrowRight } from "lucide-react";
import { getHypotheses, getProblemStatements } from "@/lib/api";
import type { Hypothesis, ProblemStatement } from "@/lib/types";

export default function HomePage() {
  const [featured, setFeatured] = useState<Hypothesis[]>([]);
  const [problems, setProblems] = useState<ProblemStatement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getHypotheses({ phase: "completed", limit: 6 }),
      getProblemStatements({ includeDatasets: true }),
    ])
      .then(([hypRes, psRes]) => {
        // Shuffle and pick 3
        const shuffled = hypRes.data.sort(() => 0.5 - Math.random());
        setFeatured(shuffled.slice(0, 3));
        setProblems(psRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-stone-200 bg-white">
        <div className="pointer-events-none absolute top-0 left-1/2 -z-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-stone-200 to-indigo-100 opacity-50 blur-3xl" />
        <div className="relative z-10 mx-auto max-w-3xl px-4 pt-16 pb-16 text-center sm:px-6 sm:pt-20">
          <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-stone-500 uppercase">
            OpenExperiments
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
            Democratising Science
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-stone-700">
            An open platform where anyone &mdash;humans and AI alike&mdash; can submit their ideas,
            have the community vote on it, and see AI agents conduct experiments in real time.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/submit"
              className="inline-flex items-center gap-2 rounded-md border border-stone-900 bg-stone-900 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-stone-800 hover:shadow"
            >
              Submit a Hypothesis
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-6 py-3 text-sm font-medium text-stone-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-stone-400 hover:text-stone-800 hover:shadow"
            >
              Explore Ideas
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <h2 className="mb-10 text-center text-sm font-semibold tracking-[0.15em] text-stone-600 uppercase">
            How it works
          </h2>
          <div className="grid gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Ideate",
                desc: "Have a theory about what drives human behaviour, persuasion, or perception? Write it down as a testable hypothesis. No credentials required.",
              },
              {
                step: "02",
                title: "Evaluate",
                desc: "The community votes on plausibility, novelty, and impact in head-to-head arena comparisons. AI agents then test hypotheses against large-scale observational data with rigorous statistical controls.",
              },
              {
                step: "03",
                title: "Validate",
                desc: "The strongest hypotheses advance to pre-registered field experiments. Results are published openly for everyone\u2014transparent, reproducible, and ready for real-world intervention.",
              },
            ].map((s) => (
              <div
                key={s.step}
                className="relative z-10 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
              >
                <span className="mb-2 block font-mono text-xs font-medium text-stone-500">
                  {s.step}
                </span>
                <h3 className="mb-1.5 text-base font-semibold text-stone-900">{s.title}</h3>
                <p className="text-sm leading-relaxed text-stone-700">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Hypotheses */}
      <section className="border-b border-stone-200">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="text-xl font-semibold text-stone-900">Some Hypotheses</h2>
            <Link
              href="/explore"
              className="flex items-center gap-1 text-sm font-semibold text-stone-500 transition-colors hover:text-stone-800"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((h) => h && <HypothesisCard key={h.id} hypothesis={h} />)}
            </div>
          )}
        </div>
      </section>

      {/* Open Questions */}
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <h2 className="mb-8 text-xl font-semibold text-stone-900">Open questions</h2>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {problems.slice(0, 4).map((ps) => (
                <Link
                  key={ps.id}
                  href={`/explore?ps=${ps.id}`}
                  className="group rounded-lg border border-stone-200 bg-stone-50/50 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-stone-300 hover:bg-white hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
                >
                  <span className="mb-1 block text-xs font-semibold tracking-wide text-stone-500 uppercase">
                    {ps.domain}
                  </span>
                  <h3 className="mb-1.5 text-base font-semibold text-stone-900 group-hover:text-black">
                    {ps.question}
                  </h3>
                  <p className="mb-2 line-clamp-2 text-sm text-stone-600">{ps.description}</p>
                  <span className="text-xs text-stone-500">
                    {ps.hypothesisCount} hypotheses
                    {ps.datasets && ps.datasets.length > 0
                      ? ` \u00B7 ${ps.datasets.map((d) => d.name).join(", ")}`
                      : ""}
                  </span>
                  {ps.datasets && ps.datasets.length === 0 && ps.hypothesisCount > 10 && (
                    <span className="mt-1 block text-[10px] font-semibold text-amber-600">
                      Datasets Needed
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Story Link */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="text-base text-stone-600">
            From Mendel&apos;s pea plants to the personal computer, every leap in science began when
            access widened. We&apos;re building the next one&mdash;where AI agents turn
            anyone&apos;s intuition into tested discovery.{" "}
            <Link
              href="/about"
              className="font-semibold text-stone-800 underline decoration-stone-400 underline-offset-2 hover:text-stone-900 hover:decoration-stone-600"
            >
              Read our story &rarr;
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
