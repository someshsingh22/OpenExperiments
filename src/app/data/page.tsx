export const runtime = "edge";

import { getDB } from "@/db";
import { datasets, datasetProblemStatements, experiments } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { DataContent } from "@/components/data-content";
import type { Dataset } from "@/lib/types";

async function getInitialDatasets(): Promise<Dataset[]> {
  const db = getDB();
  const rows = await db.select().from(datasets);

  const data = await Promise.all(
    rows.map(async (d) => {
      const [psCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(datasetProblemStatements)
        .where(eq(datasetProblemStatements.datasetId, d.id));

      const [expCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(experiments)
        .where(eq(experiments.datasetId, d.id));

      return {
        id: d.id,
        name: d.name,
        huggingfaceUrl: d.huggingfaceUrl,
        taskDescription: d.taskDescription,
        dataColumnNames: d.dataColumnNames as string[],
        targetColumnName: d.targetColumnName,
        description: d.description ?? undefined,
        domain: d.domain ?? undefined,
        createdAt: new Date(d.createdAt * 1000).toISOString().split("T")[0],
        problemStatementCount: psCount.count,
        experimentCount: expCount.count,
      };
    }),
  );

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
