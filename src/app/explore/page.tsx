export const runtime = "edge";

import { getDB } from "@/db";
import { hypotheses, problemStatements, comments, experiments } from "@/db/schema";
import { desc, sql, inArray } from "drizzle-orm";
import { ExploreContent } from "@/components/explore-content";
import type { Hypothesis, ProblemStatement } from "@/lib/types";

async function getExploreData(): Promise<{
  hypotheses: Hypothesis[];
  problemStatements: ProblemStatement[];
}> {
  const db = getDB();

  const rows = await db.select().from(hypotheses).orderBy(desc(hypotheses.submittedAt)).limit(50);

  const hypIds = rows.map((r) => r.id);
  const commentCounts = new Map<string, number>();
  const experimentCounts = new Map<string, number>();

  if (hypIds.length > 0) {
    const ccRows = await db
      .select({ hypothesisId: comments.hypothesisId, count: sql<number>`count(*)` })
      .from(comments)
      .where(inArray(comments.hypothesisId, hypIds))
      .groupBy(comments.hypothesisId);
    for (const r of ccRows) commentCounts.set(r.hypothesisId, r.count);

    const ecRows = await db
      .select({ hypothesisId: experiments.hypothesisId, count: sql<number>`count(*)` })
      .from(experiments)
      .where(inArray(experiments.hypothesisId, hypIds))
      .groupBy(experiments.hypothesisId);
    for (const r of ecRows) experimentCounts.set(r.hypothesisId, r.count);
  }

  const serializedHyp: Hypothesis[] = rows.map((row) => {
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

  const psRows = await db.select().from(problemStatements);
  const serializedPS: ProblemStatement[] = psRows.map((ps) => ({
    id: ps.id,
    question: ps.question,
    description: ps.description,
    domain: ps.domain,
    hypothesisCount: ps.hypothesisCount,
  }));

  return { hypotheses: serializedHyp, problemStatements: serializedPS };
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ ps?: string }>;
}) {
  const [params, data] = await Promise.all([searchParams, getExploreData()]);

  return (
    <ExploreContent
      initialHypotheses={data.hypotheses}
      initialProblemStatements={data.problemStatements}
      initialPsId={params.ps}
    />
  );
}
