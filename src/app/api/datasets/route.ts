export const runtime = "edge";

import { getDB } from "@/db";
import { datasets, datasetProblemStatements, experiments } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET(request: Request) {
  const db = getDB();
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain");

  const conditions = [];
  if (domain && domain !== "all") {
    conditions.push(eq(datasets.domain, domain));
  }

  const rows = conditions.length
    ? await db.select().from(datasets).where(conditions[0])
    : await db.select().from(datasets);

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
        dataColumnNames: d.dataColumnNames,
        targetColumnName: d.targetColumnName,
        description: d.description,
        domain: d.domain,
        createdAt: new Date(d.createdAt * 1000).toISOString().split("T")[0],
        problemStatementCount: psCount.count,
        experimentCount: expCount.count,
      };
    })
  );

  // Datasets with 0 problem statements float to top
  data.sort((a, b) => {
    if (a.problemStatementCount === 0 && b.problemStatementCount > 0) return -1;
    if (a.problemStatementCount > 0 && b.problemStatementCount === 0) return 1;
    return 0;
  });

  return Response.json({ data });
}
