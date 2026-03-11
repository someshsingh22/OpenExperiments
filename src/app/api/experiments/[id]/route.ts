export const runtime = "edge";

import { getDB } from "@/db";
import { experiments, experimentResults, users, hypotheses } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDB();

  const [exp] = await db
    .select()
    .from(experiments)
    .where(eq(experiments.id, id))
    .limit(1);

  if (!exp) {
    return Response.json({ error: "Experiment not found" }, { status: 404 });
  }

  // Results
  const [result] = await db
    .select()
    .from(experimentResults)
    .where(eq(experimentResults.experimentId, id))
    .limit(1);

  // Submitter
  let submitter = null;
  if (exp.submittedBy) {
    const [u] = await db
      .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, exp.submittedBy))
      .limit(1);
    submitter = u || null;
  }

  // Hypothesis
  const [hyp] = await db
    .select({
      id: hypotheses.id,
      statement: hypotheses.statement,
      status: hypotheses.status,
      phase: hypotheses.phase,
      domains: hypotheses.domains,
    })
    .from(hypotheses)
    .where(eq(hypotheses.id, exp.hypothesisId))
    .limit(1);

  return Response.json({
    data: {
      id: exp.id,
      hypothesisId: exp.hypothesisId,
      problemStatementId: exp.problemStatementId,
      type: exp.type,
      status: exp.status,
      datasetId: exp.datasetId,
      datasetName: exp.datasetName,
      methodology: exp.methodology,
      analysisPlan: exp.analysisPlan,
      submitter,
      startedAt: new Date(exp.startedAt * 1000).toISOString().split("T")[0],
      completedAt: exp.completedAt
        ? new Date(exp.completedAt * 1000).toISOString().split("T")[0]
        : undefined,
      osfLink: exp.osfLink,
      results: result
        ? {
            pValue: result.pValue,
            effectSize: result.effectSize,
            confidenceInterval: [
              result.confidenceIntervalLow,
              result.confidenceIntervalHigh,
            ],
            sampleSize: result.sampleSize,
            summary: result.summary,
            uplift: result.uplift,
          }
        : undefined,
    },
    hypothesis: hyp || null,
  });
}
