export const runtime = "edge";

import { getDB } from "@/db";
import { hypotheses, problemStatements, comments, experiments } from "@/db/schema";
import { desc, eq, sql, inArray } from "drizzle-orm";
import { ExploreContent } from "@/components/explore-content";
import { cachedQuery } from "@/lib/edge-cache";
import type { Hypothesis, ProblemStatement } from "@/lib/types";

async function getExploreData(problemStatementId?: string): Promise<{
  hypotheses: Hypothesis[];
  problemStatements: ProblemStatement[];
  total: number;
}> {
  // Filtered listings bypass the single shared key invalidated by hypothesis writes.
  if (problemStatementId) return fetchExploreData(problemStatementId);
  const data = await cachedQuery("explore:data", 300, fetchExploreData);
  // Entries from before pagination was added do not contain an exact total.
  return typeof data.total === "number" ? data : fetchExploreData();
}

async function fetchExploreData(problemStatementId?: string): Promise<{
  hypotheses: Hypothesis[];
  problemStatements: ProblemStatement[];
  total: number;
}> {
  const db = getDB();
  const where = problemStatementId
    ? inArray(
        hypotheses.problemStatement,
        db
          .select({ question: problemStatements.question })
          .from(problemStatements)
          .where(eq(problemStatements.id, problemStatementId)),
      )
    : undefined;
  const [rows, psRows, [{ count }]] = await db.batch([
    db
      .select()
      .from(hypotheses)
      .where(where)
      .orderBy(desc(hypotheses.submittedAt), desc(hypotheses.id))
      .limit(50),
    db.select().from(problemStatements),
    db
      .select({ count: sql<number>`count(*)` })
      .from(hypotheses)
      .where(where),
  ]);

  const hypIds = rows.map((r) => r.id);
  const commentCounts = new Map<string, number>();
  const experimentCounts = new Map<string, number>();

  if (hypIds.length > 0) {
    const [ccRows, ecRows] = await db.batch([
      db
        .select({ hypothesisId: comments.hypothesisId, count: sql<number>`count(*)` })
        .from(comments)
        .where(inArray(comments.hypothesisId, hypIds))
        .groupBy(comments.hypothesisId),
      db
        .select({ hypothesisId: experiments.hypothesisId, count: sql<number>`count(*)` })
        .from(experiments)
        .where(inArray(experiments.hypothesisId, hypIds))
        .groupBy(experiments.hypothesisId),
    ]);
    for (const r of ccRows) commentCounts.set(r.hypothesisId, r.count);

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

  const serializedPS: ProblemStatement[] = psRows.map((ps) => ({
    id: ps.id,
    question: ps.question,
    description: ps.description,
    domain: ps.domain,
    hypothesisCount: ps.hypothesisCount,
  }));

  return { hypotheses: serializedHyp, problemStatements: serializedPS, total: count };
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ ps?: string }>;
}) {
  const params = await searchParams;
  const data = await getExploreData(params.ps);

  return (
    <ExploreContent
      key={params.ps || ""}
      initialHypotheses={data.hypotheses}
      initialProblemStatements={data.problemStatements}
      initialTotal={data.total}
      initialPsId={params.ps}
    />
  );
}
