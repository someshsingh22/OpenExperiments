export const runtime = "edge";

import { getDB } from "@/db";
import { hypotheses, experiments, experimentResults, comments } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getWinRate } from "@/lib/arena-stats";
import { HypothesisDetailContent } from "@/components/hypothesis-detail-content";
import type { Hypothesis, Experiment, Comment } from "@/lib/types";
import { notFound } from "next/navigation";

async function getHypothesisDetail(id: string) {
  const db = getDB();

  const [row] = await db.select().from(hypotheses).where(eq(hypotheses.id, id)).limit(1);
  if (!row) return null;

  // Fetch experiments with results
  const exps = await db.select().from(experiments).where(eq(experiments.hypothesisId, id));
  const expIds = exps.map((e) => e.id);
  const results: Record<string, typeof experimentResults.$inferSelect> = {};
  if (expIds.length > 0) {
    const allResults = await db
      .select()
      .from(experimentResults)
      .where(inArray(experimentResults.experimentId, expIds));
    for (const r of allResults) {
      results[r.experimentId] = r;
    }
  }

  // Fetch comments
  const comms = await db.select().from(comments).where(eq(comments.hypothesisId, id));

  // Win rate
  const winRate = row.winRate ?? (await getWinRate(db, id));

  const isAnon = row.isAnonymous === 1;

  const hypothesis: Hypothesis = {
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
    winRate,
    evidenceScore: row.evidenceScore ?? undefined,
    pValue: row.pValue ?? undefined,
    effectSize: row.effectSize ?? undefined,
    commentCount: comms.length,
    experimentCount: exps.length,
    citationDois: row.citationDois as string[],
    relatedHypothesisIds: row.relatedHypothesisIds as string[],
  };

  const serializedExps: Experiment[] = exps.map((e) => ({
    id: e.id,
    hypothesisId: e.hypothesisId,
    type: e.type as Experiment["type"],
    status: e.status as Experiment["status"],
    datasetName: e.datasetName,
    methodology: e.methodology,
    startedAt: new Date(e.startedAt * 1000).toISOString().split("T")[0],
    completedAt: e.completedAt
      ? new Date(e.completedAt * 1000).toISOString().split("T")[0]
      : undefined,
    osfLink: e.osfLink ?? undefined,
    results: results[e.id]
      ? {
          pValue: results[e.id].pValue ?? undefined,
          effectSize: results[e.id].effectSize ?? undefined,
          confidenceInterval: [
            results[e.id].confidenceIntervalLow,
            results[e.id].confidenceIntervalHigh,
          ] as [number, number],
          sampleSize: results[e.id].sampleSize ?? undefined,
          summary: results[e.id].summary ?? undefined,
          uplift: results[e.id].uplift ?? undefined,
        }
      : undefined,
  }));

  const serializedComments: Comment[] = comms.map((c) => ({
    id: c.id,
    hypothesisId: c.hypothesisId,
    body: c.body,
    doi: c.doi ?? undefined,
    createdAt: new Date(c.createdAt * 1000).toISOString().split("T")[0],
    parentId: c.parentId ?? undefined,
  }));

  // Fetch related hypotheses
  const relatedIds = row.relatedHypothesisIds as string[];
  let related: Hypothesis[] = [];
  if (relatedIds.length > 0) {
    const relRows = await db.select().from(hypotheses).where(inArray(hypotheses.id, relatedIds));
    related = relRows.map((r) => {
      const rAnon = r.isAnonymous === 1;
      return {
        id: r.id,
        statement: r.statement,
        rationale: r.rationale,
        source: r.source as "human" | "ai_agent",
        agentName: r.agentName ?? undefined,
        domain: r.domains as string[],
        problemStatement: r.problemStatement,
        status: r.status as Hypothesis["status"],
        phase: r.phase as Hypothesis["phase"],
        submittedAt: new Date(r.submittedAt * 1000).toISOString().split("T")[0],
        submittedBy: rAnon ? null : r.submittedBy,
        isAnonymous: rAnon,
        arenaElo: r.arenaElo ?? undefined,
        winRate: r.winRate,
        evidenceScore: r.evidenceScore ?? undefined,
        pValue: r.pValue ?? undefined,
        effectSize: r.effectSize ?? undefined,
        commentCount: 0,
        experimentCount: 0,
        citationDois: r.citationDois as string[],
        relatedHypothesisIds: r.relatedHypothesisIds as string[],
      };
    });
  }

  return { hypothesis, experiments: serializedExps, comments: serializedComments, related };
}

export default async function HypothesisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getHypothesisDetail(id);

  if (!data) {
    notFound();
  }

  return (
    <HypothesisDetailContent
      hypothesis={data.hypothesis}
      experiments={data.experiments}
      comments={data.comments}
      related={data.related}
    />
  );
}
