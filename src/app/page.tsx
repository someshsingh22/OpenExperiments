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
} from "@/db/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { HomeDynamicSections } from "@/components/home-dynamic-sections";
import { cachedQuery } from "@/lib/edge-cache";
import type { Hypothesis } from "@/lib/types";

function getHomeData() {
  return cachedQuery("home:data", 300, fetchHomeData);
}

async function fetchHomeData() {
  const db = getDB();

  const [hypRows, psRows] = await Promise.all([
    db
      .select({
        id: hypotheses.id,
        statement: hypotheses.statement,
        source: hypotheses.source,
        agentName: hypotheses.agentName,
        domains: hypotheses.domains,
        status: hypotheses.status,
        phase: hypotheses.phase,
        submittedAt: hypotheses.submittedAt,
        winRate: hypotheses.winRate,
      })
      .from(hypotheses)
      .where(eq(hypotheses.phase, "completed"))
      .orderBy(desc(hypotheses.submittedAt))
      .limit(6),
    db
      .select({
        id: problemStatements.id,
        question: problemStatements.question,
        description: problemStatements.description,
        domain: problemStatements.domain,
        hypothesisCount: problemStatements.hypothesisCount,
      })
      .from(problemStatements)
      .limit(4),
  ]);

  const candidateRows =
    hypRows.length > 0
      ? hypRows
      : await db
          .select({
            id: hypotheses.id,
            statement: hypotheses.statement,
            source: hypotheses.source,
            agentName: hypotheses.agentName,
            domains: hypotheses.domains,
            status: hypotheses.status,
            phase: hypotheses.phase,
            submittedAt: hypotheses.submittedAt,
            winRate: hypotheses.winRate,
          })
          .from(hypotheses)
          .where(eq(hypotheses.phase, "live"))
          .orderBy(desc(hypotheses.submittedAt))
          .limit(6);
  const featuredRows = candidateRows.sort(() => 0.5 - Math.random()).slice(0, 3);
  const hypIds = featuredRows.map((r) => r.id);
  const psIds = psRows.map((r) => r.id);
  const commentCounts = new Map<string, number>();

  const [ccRows, allDsLinks] = await Promise.all([
    hypIds.length > 0
      ? db
          .select({
            hypothesisId: comments.hypothesisId,
            count: sql<number>`count(*)`,
          })
          .from(comments)
          .where(inArray(comments.hypothesisId, hypIds))
          .groupBy(comments.hypothesisId)
      : Promise.resolve([]),
    psIds.length > 0
      ? db
          .select({
            problemStatementId: datasetProblemStatements.problemStatementId,
            name: datasets.name,
          })
          .from(datasetProblemStatements)
          .innerJoin(datasets, eq(datasetProblemStatements.datasetId, datasets.id))
          .where(inArray(datasetProblemStatements.problemStatementId, psIds))
      : Promise.resolve([]),
  ]);
  for (const r of ccRows) commentCounts.set(r.hypothesisId, r.count);

  const featured = featuredRows.map((row) => {
    return {
      id: row.id,
      statement: row.statement,
      source: row.source as "human" | "ai_agent",
      agentName: row.agentName ?? undefined,
      domain: row.domains as string[],
      status: row.status as Hypothesis["status"],
      phase: row.phase as Hypothesis["phase"],
      submittedAt: new Date(row.submittedAt * 1000).toISOString().split("T")[0],
      winRate: row.winRate,
      commentCount: commentCounts.get(row.id) ?? 0,
    };
  });

  const dsMap = new Map<string, { name: string }[]>();
  for (const row of allDsLinks) {
    const list = dsMap.get(row.problemStatementId) ?? [];
    list.push({ name: row.name });
    dsMap.set(row.problemStatementId, list);
  }

  const serializedPS = psRows.map((ps) => ({
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
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 pt-16 pb-16 text-center sm:px-6 sm:pt-20">
          <h1 className="type-display text-stone-900">Democratising Science</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-stone-700">
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
          <h2 className="type-heading mb-10 text-center text-stone-900">How it works</h2>
          <ol className="grid gap-10 sm:grid-cols-3 sm:gap-8">
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
              <li key={s.step} className="border-t-2 border-stone-900 pt-4">
                <h3 className="mb-2 font-serif text-xl font-medium text-stone-900">{s.title}</h3>
                <p className="text-sm leading-relaxed text-stone-700">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Data sections — pre-fetched server-side, interactive client-side */}
      <HomeDynamicSections initialHypotheses={featured} initialProblems={problems} />

      {/* Story Link */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="mx-auto max-w-prose text-base leading-relaxed text-stone-700">
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
