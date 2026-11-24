export const runtime = "edge";

import { getDB } from "@/db";
import { datasets, datasetProblemStatements, problemStatements, experiments } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDB();

  const [dataset] = await db
    .select({
      id: datasets.id,
      name: datasets.name,
      huggingfaceUrl: datasets.huggingfaceUrl,
      taskDescription: datasets.taskDescription,
      dataColumnNames: datasets.dataColumnNames,
      targetColumnName: datasets.targetColumnName,
      description: datasets.description,
      domain: datasets.domain,
      license: datasets.license,
      foreknowledgeStatus: datasets.foreknowledgeStatus,
      unitOfAnalysis: datasets.unitOfAnalysis,
      osfCharacterization: datasets.osfCharacterization,
      createdAt: datasets.createdAt,
    })
    .from(datasets)
    .where(eq(datasets.id, id))
    .limit(1);

  if (!dataset) {
    return Response.json({ error: "Dataset not found" }, { status: 404 });
  }

  const [psLinks, exps] = await Promise.all([
    db
      .select({
        id: problemStatements.id,
        question: problemStatements.question,
        domain: problemStatements.domain,
        hypothesisCount: problemStatements.hypothesisCount,
      })
      .from(datasetProblemStatements)
      .innerJoin(
        problemStatements,
        eq(datasetProblemStatements.problemStatementId, problemStatements.id),
      )
      .where(eq(datasetProblemStatements.datasetId, id)),
    db
      .select({
        id: experiments.id,
        hypothesisId: experiments.hypothesisId,
        type: experiments.type,
        status: experiments.status,
        methodology: experiments.methodology,
        startedAt: experiments.startedAt,
      })
      .from(experiments)
      .where(eq(experiments.datasetId, id)),
  ]);

  return Response.json(
    {
      data: {
        id: dataset.id,
        name: dataset.name,
        huggingfaceUrl: dataset.huggingfaceUrl,
        taskDescription: dataset.taskDescription,
        dataColumnNames: dataset.dataColumnNames,
        targetColumnName: dataset.targetColumnName,
        description: dataset.description,
        domain: dataset.domain,
        license: dataset.license,
        foreknowledgeStatus: dataset.foreknowledgeStatus,
        unitOfAnalysis: dataset.unitOfAnalysis,
        osfCharacterization: dataset.osfCharacterization,
        createdAt: new Date(dataset.createdAt * 1000).toISOString().split("T")[0],
      },
      problemStatements: psLinks,
      experiments: exps.map((e) => ({
        id: e.id,
        hypothesisId: e.hypothesisId,
        type: e.type,
        status: e.status,
        methodology: e.methodology,
        startedAt: new Date(e.startedAt * 1000).toISOString().split("T")[0],
      })),
    },
    {
      headers: { "Cache-Control": "public, max-age=600, s-maxage=1800" },
    },
  );
}
