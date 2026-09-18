export const runtime = "edge";

import { getDB } from "@/db";
import { problemStatements, datasetProblemStatements, datasets } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

export async function GET(request: Request) {
  const db = getDB();
  const url = new URL(request.url);
  const includeDatasets = url.searchParams.get("includeDatasets") === "true";

  const rows = await db.select().from(problemStatements);

  if (includeDatasets) {
    // Single join over all problem statements, grouped in memory, instead of
    // one join query per statement (N+1).
    const psIds = rows.map((ps) => ps.id);
    const linksByPs = new Map<
      string,
      { id: string; name: string; huggingfaceUrl: string | null }[]
    >();
    if (psIds.length) {
      const linkRows = await db
        .select({
          problemStatementId: datasetProblemStatements.problemStatementId,
          id: datasets.id,
          name: datasets.name,
          huggingfaceUrl: datasets.huggingfaceUrl,
        })
        .from(datasetProblemStatements)
        .innerJoin(datasets, eq(datasetProblemStatements.datasetId, datasets.id))
        .where(inArray(datasetProblemStatements.problemStatementId, psIds));
      for (const l of linkRows) {
        const list = linksByPs.get(l.problemStatementId) ?? [];
        list.push({ id: l.id, name: l.name, huggingfaceUrl: l.huggingfaceUrl });
        linksByPs.set(l.problemStatementId, list);
      }
    }

    const data = rows.map((ps) => ({
      id: ps.id,
      question: ps.question,
      description: ps.description,
      domain: ps.domain,
      hypothesisCount: ps.hypothesisCount,
      datasets: linksByPs.get(ps.id) ?? [],
    }));
    return Response.json(
      { data },
      {
        headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
      },
    );
  }

  return Response.json(
    {
      data: rows.map((ps) => ({
        id: ps.id,
        question: ps.question,
        description: ps.description,
        domain: ps.domain,
        hypothesisCount: ps.hypothesisCount,
      })),
    },
    {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
    },
  );
}
