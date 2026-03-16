export const runtime = "edge";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getDB } from "@/db";
import {
  hypotheses,
  problemStatements,
  datasetProblemStatements,
  datasets,
  comments,
  experiments,
} from "@/db/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { HomeDynamicSections } from "@/components/home-dynamic-sections";
import type { Hypothesis, ProblemStatement } from "@/lib/types";

async function getHomeData(): Promise<{
  hypotheses: Hypothesis[];
  problems: ProblemStatement[];
}> {
  const db = getDB();

  // Fetch completed hypotheses
  const hypRows = await db
    .select()
    .from(hypotheses)
    .where(eq(hypotheses.phase, "completed"))
    .orderBy(desc(hypotheses.submittedAt))
    .limit(6);

  // Compute comment + experiment counts
  const hypIds = hypRows.map((r) => r.id);
  const commentCounts = new Map<string, number>();
  const experimentCounts = new Map<string, number>();

  if (hypIds.length > 0) {
    const ccRows = await db
      .select({
        hypothesisId: comments.hypothesisId,
        count: sql<number>`count(*)`,
      })
      .from(comments)
      .where(inArray(comments.hypothesisId, hypIds))
      .groupBy(comments.hypothesisId);
    for (const r of ccRows) commentCounts.set(r.hypothesisId, r.count);

    const ecRows = await db
      .select({
        hypothesisId: experiments.hypothesisId,
        count: sql<number>`count(*)`,
      })
      .from(experiments)
      .where(inArray(experiments.hypothesisId, hypIds))
      .groupBy(experiments.hypothesisId);
    for (const r of ecRows) experimentCounts.set(r.hypothesisId, r.count);
  }

  // Serialize hypotheses (same shape as API route)
  const serializedHyp: Hypothesis[] = hypRows.map((row) => {
    const isAnon = row.isAnonymous === 1;
    return {
      id: row.id,
      statement: row.statement,
      rationale: row.rationale,
      source: row.source as "human" | "ai_agent",
      agentName: row.agentName ?? undefined,
      domain: row.domains as string[],
      problemStatement: row.problemStatement,
      status: row.status as Hypothesis["status"],
      phase: row.phase as Hypothesis["phase"],
      submittedAt: new Date(row.submittedAt * 1000).toISOString().split("T")[0],
      submittedBy: isAnon ? null : row.submittedBy,
      isAnonymous: isAnon,
      arenaElo: row.arenaElo ?? undefined,
      evidenceScore: row.evidenceScore ?? undefined,
      pValue: row.pValue ?? undefined,
      effectSize: row.effectSize ?? undefined,
      winRate: row.winRate,
      commentCount: commentCounts.get(row.id) ?? 0,
      experimentCount: experimentCounts.get(row.id) ?? 0,
      citationDois: row.citationDois as string[],
      relatedHypothesisIds: row.relatedHypothesisIds as string[],
    };
  });

  // Shuffle and pick 3
  const shuffled = serializedHyp.sort(() => 0.5 - Math.random());
  const featured = shuffled.slice(0, 3);

  // Fetch problem statements with datasets (single batched query)
  const psRows = await db.select().from(problemStatements);
  const allDsLinks = await db
    .select({
      problemStatementId: datasetProblemStatements.problemStatementId,
      id: datasets.id,
      name: datasets.name,
      huggingfaceUrl: datasets.huggingfaceUrl,
    })
    .from(datasetProblemStatements)
    .innerJoin(datasets, eq(datasetProblemStatements.datasetId, datasets.id));

  const dsMap = new Map<string, { id: string; name: string; huggingfaceUrl: string | null }[]>();
  for (const row of allDsLinks) {
    const list = dsMap.get(row.problemStatementId) ?? [];
    list.push({ id: row.id, name: row.name, huggingfaceUrl: row.huggingfaceUrl });
    dsMap.set(row.problemStatementId, list);
  }

  const serializedPS: ProblemStatement[] = psRows.map((ps) => ({
    id: ps.id,
    question: ps.question,
    description: ps.description,
    domain: ps.domain,
    hypothesisCount: ps.hypothesisCount,
    datasets: dsMap.get(ps.id) ?? [],
  }));

  return { hypotheses: featured, problems: serializedPS };
}

export default async function HomePage() {
  const { hypotheses: featured, problems } = await getHomeData();

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
            have the community vote on it, and see experiments being conducted in real time.
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

      {/* Data sections — pre-fetched server-side, interactive client-side */}
      <HomeDynamicSections initialHypotheses={featured} initialProblems={problems} />

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
