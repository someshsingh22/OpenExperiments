export const runtime = "edge";

import { getDB } from "@/db";
import { datasets, datasetProblemStatements, experiments } from "@/db/schema";
import { sql } from "drizzle-orm";
import { DataContent } from "@/components/data-content";
import { cachedQuery } from "@/lib/edge-cache";
import type { Dataset } from "@/lib/types";

async function getInitialDatasets(): Promise<Dataset[]> {
  return cachedQuery("datasets:list", 300, fetchInitialDatasets);
}

async function fetchInitialDatasets(): Promise<Dataset[]> {
  const db = getDB();
  const rows = await db
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
      createdAt: datasets.createdAt,
    })
    .from(datasets);
  const psCounts = new Map<string, number>();
  const expCounts = new Map<string, number>();
  if (rows.length) {
    const [psRows, expRows] = await Promise.all([
      db
        .select({
          datasetId: datasetProblemStatements.datasetId,
          count: sql<number>`count(*)`,
        })
        .from(datasetProblemStatements)
        .groupBy(datasetProblemStatements.datasetId),
      db
        .select({
          datasetId: experiments.datasetId,
          count: sql<number>`count(*)`,
        })
        .from(experiments)
        .groupBy(experiments.datasetId),
    ]);
    for (const row of psRows) psCounts.set(row.datasetId, row.count);
    for (const row of expRows) if (row.datasetId) expCounts.set(row.datasetId, row.count);
  }

  const data = rows.map((d) => ({
    id: d.id,
    name: d.name,
    huggingfaceUrl: d.huggingfaceUrl,
    taskDescription: d.taskDescription,
    dataColumnNames: d.dataColumnNames,
    targetColumnName: d.targetColumnName,
    description: d.description ?? undefined,
    domain: d.domain ?? undefined,
    license: d.license ?? undefined,
    foreknowledgeStatus: d.foreknowledgeStatus ?? undefined,
    unitOfAnalysis: d.unitOfAnalysis ?? undefined,
    createdAt: new Date(d.createdAt * 1000).toISOString().split("T")[0],
    problemStatementCount: psCounts.get(d.id) ?? 0,
    experimentCount: expCounts.get(d.id) ?? 0,
  }));

  data.sort((a, b) => {
    if ((a.problemStatementCount ?? 0) === 0 && (b.problemStatementCount ?? 0) > 0) return -1;
    if ((a.problemStatementCount ?? 0) > 0 && (b.problemStatementCount ?? 0) === 0) return 1;
    return 0;
  });

  return data;
}

export default async function DataPage() {
  const initialDatasets = await getInitialDatasets();
  return <DataContent initialDatasets={initialDatasets} />;
}
