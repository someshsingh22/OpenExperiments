export const runtime = "edge";

import { getDB } from "@/db";
import { datasets, datasetProblemStatements, experiments } from "@/db/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { validateDataset } from "@/lib/validation";
import { invalidateCached } from "@/lib/edge-cache";

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

  // Aggregate counts in two grouped queries instead of 2 per row (N+1).
  const ids = rows.map((d) => d.id);
  const psCounts = new Map<string, number>();
  const expCounts = new Map<string, number>();
  if (ids.length) {
    const psRows = await db
      .select({
        datasetId: datasetProblemStatements.datasetId,
        count: sql<number>`count(*)`,
      })
      .from(datasetProblemStatements)
      .where(inArray(datasetProblemStatements.datasetId, ids))
      .groupBy(datasetProblemStatements.datasetId);
    for (const r of psRows) psCounts.set(r.datasetId, r.count);

    const expRows = await db
      .select({
        datasetId: experiments.datasetId,
        count: sql<number>`count(*)`,
      })
      .from(experiments)
      .where(inArray(experiments.datasetId, ids))
      .groupBy(experiments.datasetId);
    for (const r of expRows) if (r.datasetId) expCounts.set(r.datasetId, r.count);
  }

  const data = rows.map((d) => ({
    id: d.id,
    name: d.name,
    huggingfaceUrl: d.huggingfaceUrl,
    taskDescription: d.taskDescription,
    dataColumnNames: d.dataColumnNames,
    targetColumnName: d.targetColumnName,
    description: d.description,
    domain: d.domain,
    license: d.license,
    foreknowledgeStatus: d.foreknowledgeStatus,
    unitOfAnalysis: d.unitOfAnalysis,
    createdAt: new Date(d.createdAt * 1000).toISOString().split("T")[0],
    problemStatementCount: psCounts.get(d.id) ?? 0,
    experimentCount: expCounts.get(d.id) ?? 0,
  }));

  // Datasets with 0 problem statements float to top
  data.sort((a, b) => {
    if (a.problemStatementCount === 0 && b.problemStatementCount > 0) return -1;
    if (a.problemStatementCount > 0 && b.problemStatementCount === 0) return 1;
    return 0;
  });

  return Response.json(
    { data },
    {
      headers: { "Cache-Control": "public, max-age=600, s-maxage=1800" },
    },
  );
}

export async function POST(request: Request) {
  const { getSession, requireSession } = await import("@/lib/auth");
  const user = await getSession(request);
  const unauthorized = requireSession(user);
  if (unauthorized) return unauthorized;

  const db = getDB();
  const body = await request.json();
  const result = validateDataset(body as Record<string, unknown>);

  if (!result.ok) {
    return Response.json({ errors: result.errors }, { status: 400 });
  }

  const {
    name,
    huggingfaceUrl,
    description,
    domain,
    license,
    foreknowledgeStatus,
    unitOfAnalysis,
    osf,
  } = result.data;

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.insert(datasets).values({
    id,
    name,
    huggingfaceUrl,
    description: description ?? null,
    domain: domain ?? null,
    license: license ?? null,
    foreknowledgeStatus,
    unitOfAnalysis,
    osfCharacterization: osf,
    submittedBy: user!.id,
    createdAt: now,
    updatedAt: now,
  });

  await invalidateCached("datasets:list");

  return Response.json({ data: { id } }, { status: 201 });
}
