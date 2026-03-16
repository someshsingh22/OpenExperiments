export const runtime = "edge";

import { getDB } from "@/db";
import { hypotheses, experiments, experimentResults, comments } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getWinRate } from "@/lib/arena-stats";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { getSession } = await import("@/lib/auth");
  const viewer = await getSession(request);
  const { id } = await params;
  const db = getDB();

  const [hypothesis] = await db.select().from(hypotheses).where(eq(hypotheses.id, id)).limit(1);

  if (!hypothesis) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch related experiments with results
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

  // Fetch comments with author info
  const comms = await db.select().from(comments).where(eq(comments.hypothesisId, id));

  // Win rate: use denormalized column, fall back to computing from matchups
  const winRate = hypothesis.winRate ?? (await getWinRate(db, id));

  // Actual discussion comment count
  const actualCommentCount = comms.length;

  // Anonymous visibility
  const isAnon = hypothesis.isAnonymous === 1;
  const isOwner = viewer?.id != null && hypothesis.submittedBy === viewer.id;

  return Response.json(
    {
      data: {
        id: hypothesis.id,
        statement: hypothesis.statement,
        rationale: hypothesis.rationale,
        source: hypothesis.source,
        agentName: hypothesis.agentName,
        domain: hypothesis.domains,
        problemStatement: hypothesis.problemStatement,
        status: hypothesis.status,
        phase: hypothesis.phase,
        submittedAt: new Date(hypothesis.submittedAt * 1000).toISOString().split("T")[0],
        submittedBy: isAnon && !isOwner ? null : hypothesis.submittedBy,
        isAnonymous: isAnon,
        arenaElo: hypothesis.arenaElo,
        winRate,
        evidenceScore: hypothesis.evidenceScore,
        pValue: hypothesis.pValue,
        effectSize: hypothesis.effectSize,
        commentCount: actualCommentCount,
        citationDois: hypothesis.citationDois,
        relatedHypothesisIds: hypothesis.relatedHypothesisIds,
      },
      experiments: exps.map((e) => ({
        id: e.id,
        hypothesisId: e.hypothesisId,
        type: e.type,
        status: e.status,
        datasetName: e.datasetName,
        methodology: e.methodology,
        startedAt: new Date(e.startedAt * 1000).toISOString().split("T")[0],
        completedAt: e.completedAt
          ? new Date(e.completedAt * 1000).toISOString().split("T")[0]
          : undefined,
        osfLink: e.osfLink,
        results: results[e.id]
          ? {
              pValue: results[e.id].pValue,
              effectSize: results[e.id].effectSize,
              confidenceInterval: [
                results[e.id].confidenceIntervalLow,
                results[e.id].confidenceIntervalHigh,
              ],
              sampleSize: results[e.id].sampleSize,
              summary: results[e.id].summary,
              uplift: results[e.id].uplift,
            }
          : undefined,
      })),
      comments: comms.map((c) => ({
        id: c.id,
        hypothesisId: c.hypothesisId,
        body: c.body,
        doi: c.doi,
        createdAt: new Date(c.createdAt * 1000).toISOString().split("T")[0],
        parentId: c.parentId,
      })),
    },
    {
      headers: { "Cache-Control": "public, max-age=120, s-maxage=600" },
    },
  );
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDB();
  const body = await request.json();
  const { addCitation } = body as { addCitation?: string };

  if (!addCitation) {
    return Response.json({ error: "addCitation is required" }, { status: 400 });
  }

  // Validate citation: must be an arXiv URL or a DOI
  const { validateCitation } = await import("@/lib/validation");
  if (!validateCitation(addCitation)) {
    return Response.json(
      {
        error:
          "Citation must be a valid arXiv URL (https://arxiv.org/abs/...) or DOI (10.xxxx/...)",
      },
      { status: 400 },
    );
  }

  const [hypothesis] = await db.select().from(hypotheses).where(eq(hypotheses.id, id)).limit(1);

  if (!hypothesis) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const existing = hypothesis.citationDois as string[];
  if (existing.includes(addCitation)) {
    return Response.json({ error: "Citation already exists" }, { status: 409 });
  }

  const updated = [...existing, addCitation];
  const now = Math.floor(Date.now() / 1000);

  await db
    .update(hypotheses)
    .set({ citationDois: updated, updatedAt: now })
    .where(eq(hypotheses.id, id));

  return Response.json({ data: { citationDois: updated } });
}
