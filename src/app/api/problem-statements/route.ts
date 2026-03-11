export const runtime = "edge";

import { getDB } from "@/db";
import { problemStatements, datasetProblemStatements, datasets } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const db = getDB();
  const url = new URL(request.url);
  const includeDatasets = url.searchParams.get("includeDatasets") === "true";

  const rows = await db.select().from(problemStatements);

  if (includeDatasets) {
    const data = await Promise.all(
      rows.map(async (ps) => {
        const dsLinks = await db
          .select({
            id: datasets.id,
            name: datasets.name,
            huggingfaceUrl: datasets.huggingfaceUrl,
          })
          .from(datasetProblemStatements)
          .innerJoin(datasets, eq(datasetProblemStatements.datasetId, datasets.id))
          .where(eq(datasetProblemStatements.problemStatementId, ps.id));

        return {
          id: ps.id,
          question: ps.question,
          description: ps.description,
          domain: ps.domain,
          hypothesisCount: ps.hypothesisCount,
          datasets: dsLinks,
        };
      })
    );
    return Response.json({ data });
  }

  return Response.json({
    data: rows.map((ps) => ({
      id: ps.id,
      question: ps.question,
      description: ps.description,
      domain: ps.domain,
      hypothesisCount: ps.hypothesisCount,
    })),
  });
}
