export const runtime = "edge";

import { getDB } from "@/db";
import { experiments, experimentResults, experimentVersions, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

function buildResultsResponse(result: {
  pValue: number;
  effectSize: number;
  confidenceIntervalLow: number;
  confidenceIntervalHigh: number;
  sampleSize: number;
  summary: string;
  uplift: string | null;
}) {
  const obj: Record<string, unknown> = {};
  let has = false;
  if (result.pValue) {
    obj.pValue = result.pValue;
    has = true;
  }
  if (result.effectSize) {
    obj.effectSize = result.effectSize;
    has = true;
  }
  if (result.sampleSize) {
    obj.sampleSize = result.sampleSize;
    has = true;
  }
  if (result.confidenceIntervalLow || result.confidenceIntervalHigh) {
    obj.confidenceInterval = [result.confidenceIntervalLow, result.confidenceIntervalHigh];
    has = true;
  }
  if (result.summary) {
    obj.summary = result.summary;
    has = true;
  }
  if (result.uplift) {
    obj.uplift = result.uplift;
    has = true;
  }
  return has ? obj : undefined;
}

export async function GET(request: Request) {
  const db = getDB();
  const url = new URL(request.url);
  const hypothesisId = url.searchParams.get("hypothesisId");

  const rows = hypothesisId
    ? await db.select().from(experiments).where(eq(experiments.hypothesisId, hypothesisId))
    : await db.select().from(experiments);

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
        version: e.version,
        results: result ? buildResultsResponse(result) : undefined,
      };
    }),
  );

  return Response.json(
    { data },
    {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=600" },
    },
  );
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
    status = "planned",
    methodology,
    analysisPlan,
    osfLink,
    results,
  } = body as Record<string, unknown>;

  if (!hypothesisId || !type) {
    return Response.json({ error: "hypothesisId and type are required" }, { status: 400 });
  }

  if (!datasetId && !datasetName) {
    return Response.json(
      { error: "Either datasetId or datasetName must be provided" },
      { status: 400 },
    );
  }

  // Status-conditional validation
  if ((status === "running" || status === "completed") && !methodology) {
    return Response.json(
      { error: "Methodology is required for running/completed experiments" },
      { status: 400 },
    );
  }
  if (status === "completed" && !analysisPlan) {
    return Response.json(
      { error: "Analysis plan is required for completed experiments" },
      { status: 400 },
    );
  }
  const r = results as Record<string, unknown> | undefined;
  if (status === "completed" && (!r || !r.summary)) {
    return Response.json(
      { error: "Results summary is required for completed experiments" },
      { status: 400 },
    );
  }

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.insert(experiments).values({
    id,
    hypothesisId: hypothesisId as string,
    problemStatementId: (problemStatementId as string) || null,
    type: type as string,
    status: status as string,
    datasetId: (datasetId as string) || null,
    datasetName: (datasetName as string) || "",
    methodology: (methodology as string) || null,
    analysisPlan: (analysisPlan as string) || null,
    osfLink: (osfLink as string) || null,
    startedAt: now,
    completedAt: status === "completed" ? now : null,
    submittedBy: user.id,
    version: 1,
    createdAt: now,
    updatedAt: now,
  });

  // Handle results for completed experiments
  const hasResults =
    r && (r.summary || r.pValue != null || r.effectSize != null || r.sampleSize != null);
  if (hasResults) {
    await db.insert(experimentResults).values({
      experimentId: id,
      pValue: (r.pValue as number) ?? 0,
      effectSize: (r.effectSize as number) ?? 0,
      sampleSize: (r.sampleSize as number) ?? 0,
      confidenceIntervalLow: (r.confidenceIntervalLow as number) ?? 0,
      confidenceIntervalHigh: (r.confidenceIntervalHigh as number) ?? 0,
      summary: (r.summary as string) || "",
      createdAt: now,
    });
  }

  // Create version 1 snapshot
  await db.insert(experimentVersions).values({
    id: crypto.randomUUID(),
    experimentId: id,
    version: 1,
    status: status as string,
    methodology: (methodology as string) || null,
    analysisPlan: (analysisPlan as string) || null,
    osfLink: (osfLink as string) || null,
    pValue: hasResults ? ((r.pValue as number) ?? null) : null,
    effectSize: hasResults ? ((r.effectSize as number) ?? null) : null,
    sampleSize: hasResults ? ((r.sampleSize as number) ?? null) : null,
    confidenceIntervalLow: hasResults ? ((r.confidenceIntervalLow as number) ?? null) : null,
    confidenceIntervalHigh: hasResults ? ((r.confidenceIntervalHigh as number) ?? null) : null,
    summary: hasResults ? (r.summary as string) || null : null,
    changeSummary: "Initial submission",
    createdAt: now,
  });

  return Response.json({ data: { id } }, { status: 201 });
}
