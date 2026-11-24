export const runtime = "edge";

import { getDB } from "@/db";
import { hypotheses, experiments, experimentResults, comments } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { HypothesisDetailContent } from "@/components/hypothesis-detail-content";
import { cachedQuery } from "@/lib/edge-cache";
import { getHypothesisDetailRow } from "@/lib/hypothesis-detail-row";
import { readHypothesisDetailChunks } from "@/lib/hypothesis-detail-chunks";
import type { Hypothesis, Experiment, Comment } from "@/lib/types";
import { notFound } from "next/navigation";

function getHypothesisDetail(id: string) {
  return cachedQuery(`hypothesis:${id}`, 300, () => fetchHypothesisDetail(id));
}

async function fetchHypothesisDetail(id: string) {
  const db = getDB();

  const row = await getHypothesisDetailRow(id);
  if (!row) return null;

  const relatedIds = row.relatedHypothesisIds as string[];
  const [{ exps, allResults }, comms, relRows] = await Promise.all([
    (async () => {
      const exps = await db.select().from(experiments).where(eq(experiments.hypothesisId, id));
      const expIds = exps.map((e) => e.id);
      const allResults = await readHypothesisDetailChunks(expIds, (chunk) =>
        db.select().from(experimentResults).where(inArray(experimentResults.experimentId, chunk)),
      );
      return { exps, allResults };
    })(),
    db.select().from(comments).where(eq(comments.hypothesisId, id)),
    readHypothesisDetailChunks(relatedIds, (chunk) =>
      db.select().from(hypotheses).where(inArray(hypotheses.id, chunk)),
    ),
  ]);
  const results: Record<string, typeof experimentResults.$inferSelect> = {};
  for (const r of allResults) {
    results[r.experimentId] = r;
  }

  // Win rate: use the denormalized column only. It is kept current by
  // updateWinRatesForMatchup on every vote, so a null value means "no votes yet".
  // Avoid the per-view full scan of arena_matchups that the old fallback triggered.
  const winRate = row.winRate;

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
    methodology: e.methodology ?? undefined,
    startedAt: new Date(e.startedAt * 1000).toISOString().split("T")[0],
    completedAt: e.completedAt
      ? new Date(e.completedAt * 1000).toISOString().split("T")[0]
      : undefined,
    osfLink: e.osfLink ?? undefined,
    version: e.version ?? 1,
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
  let related: Hypothesis[] = [];
  if (relatedIds.length > 0) {
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
