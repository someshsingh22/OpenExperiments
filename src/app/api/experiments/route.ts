export const runtime = "edge";

import { getDB } from "@/db";
import { experiments, experimentResults, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  const db = getDB();
  const url = new URL(request.url);
  const hypothesisId = url.searchParams.get("hypothesisId");

  const rows = hypothesisId
    ? await db.select().from(experiments).where(eq(experiments.hypothesisId, hypothesisId))
    : await db.select().from(experiments);

  // Fetch results for all experiments
  const data = await Promise.all(
    rows.map(async (e) => {
      const [result] = await db
        .select()
        .from(experimentResults)
        .where(eq(experimentResults.experimentId, e.id))
        .limit(1);

      let submitter = null;
      if (e.submittedBy) {
        const [u] = await db
          .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
          .from(users)
          .where(eq(users.id, e.submittedBy))
          .limit(1);
        submitter = u || null;
      }

      return {
        id: e.id,
        hypothesisId: e.hypothesisId,
        problemStatementId: e.problemStatementId,
        type: e.type,
        status: e.status,
        datasetId: e.datasetId,
        datasetName: e.datasetName,
        methodology: e.methodology,
        analysisPlan: e.analysisPlan,
        submitter,
        startedAt: new Date(e.startedAt * 1000).toISOString().split("T")[0],
        completedAt: e.completedAt
          ? new Date(e.completedAt * 1000).toISOString().split("T")[0]
          : undefined,
        osfLink: e.osfLink,
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
      };
    })
  );

  return Response.json({ data });
}

export async function POST(request: Request) {
  const user = await getSession(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const db = getDB();
  const body = await request.json();
  const {
    hypothesisId,
    problemStatementId,
    type,
    datasetId,
    datasetName,
    methodology,
    analysisPlan,
    osfLink,
    status,
  } = body;

  if (!hypothesisId || !type || !methodology) {
    return Response.json(
      { error: "hypothesisId, type, and methodology are required" },
      { status: 400 }
    );
  }

  if (!datasetId && !datasetName) {
    return Response.json(
      { error: "Either datasetId or datasetName must be provided" },
      { status: 400 }
    );
  }

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.insert(experiments).values({
    id,
    hypothesisId,
    problemStatementId: problemStatementId || null,
    type,
    status: status || "planned",
    datasetId: datasetId || null,
    datasetName: datasetName || "",
    methodology,
    analysisPlan: analysisPlan || null,
    osfLink: osfLink || null,
    startedAt: now,
    completedAt: null,
    submittedBy: user.id,
    createdAt: now,
    updatedAt: now,
  });

  return Response.json({ data: { id } }, { status: 201 });
}
