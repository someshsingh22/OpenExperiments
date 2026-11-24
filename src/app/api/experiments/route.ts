export const runtime = "edge";

import { getDB } from "@/db";
import { experiments, experimentResults, experimentVersions, users } from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { invalidateExperimentCaches } from "@/lib/edge-cache";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

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
  const url = new URL(request.url);
  const hypothesisId = url.searchParams.get("hypothesisId");
  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");
  const requestedLimit = limitParam === null ? 100 : Number(limitParam);
  const offset = offsetParam === null ? 0 : Number(offsetParam);
  if (
    (limitParam !== null && !limitParam.trim()) ||
    (offsetParam !== null && !offsetParam.trim()) ||
    !Number.isSafeInteger(requestedLimit) ||
    requestedLimit < 1 ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  ) {
    return Response.json({ error: "Invalid pagination parameters" }, { status: 400 });
  }
  const limit = Math.min(requestedLimit, 100);
  // Supplying limit or offset opts filtered requests into pagination; legacy
  // hypothesis-only requests continue to return all matching experiments.
  const paginated = !hypothesisId || limitParam !== null || offsetParam !== null;
  const db = getDB();
  const query = db
    .select()
    .from(experiments)
    .where(hypothesisId ? eq(experiments.hypothesisId, hypothesisId) : undefined)
    .orderBy(desc(experiments.startedAt));
  const rows = await (paginated ? query.limit(limit).offset(offset) : query);

  const expIds = rows.map((e) => e.id);
  const submitterIds = [...new Set(rows.map((e) => e.submittedBy).filter((v): v is string => !!v))];
  const resultsById = new Map<string, typeof experimentResults.$inferSelect>();
  const submitterById = new Map<
    string,
    { id: string; name: string | null; avatarUrl: string | null }
  >();
  // Legacy filtered lists can exceed D1's bound-parameter limit.
  const chunks = (ids: string[]) =>
    Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) =>
      ids.slice(i * 100, (i + 1) * 100),
    );
  const resultQueries = chunks(expIds).map((ids) =>
    db.select().from(experimentResults).where(inArray(experimentResults.experimentId, ids)),
  );
  const userQueries = chunks(submitterIds).map((ids) =>
    db
      .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
      .from(users)
      .where(inArray(users.id, ids)),
  );
  const [first, ...rest] = [...resultQueries, ...userQueries];
  if (first) {
    const batches = await db.batch([first, ...rest]);
    const resultRows = batches
      .slice(0, resultQueries.length)
      .flat() as (typeof experimentResults.$inferSelect)[];
    const userRows = batches.slice(resultQueries.length).flat() as {
      id: string;
      name: string | null;
      avatarUrl: string | null;
    }[];
    for (const r of resultRows) resultsById.set(r.experimentId, r);
    for (const u of userRows) submitterById.set(u.id, u);
  }

  const data = rows.map((e) => {
    const result = resultsById.get(e.id);
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
      submitter: e.submittedBy ? (submitterById.get(e.submittedBy) ?? null) : null,
      startedAt: new Date(e.startedAt * 1000).toISOString().split("T")[0],
      completedAt: e.completedAt
        ? new Date(e.completedAt * 1000).toISOString().split("T")[0]
        : undefined,
      osfLink: e.osfLink,
      version: e.version,
      results: result ? buildResultsResponse(result) : undefined,
    };
  });

  return Response.json(
    { data },
    {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=600" },
    },
  );
}

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, RATE_LIMITS.write);
  if (limited) return limited;
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

  // Handle results for completed experiments
  const hasResults =
    r && (r.summary || r.pValue != null || r.effectSize != null || r.sampleSize != null);

  // The experiment, its results, and its v1 snapshot must all land or none:
  // batch them into a single D1 transaction so a mid-sequence failure can't
  // leave an experiment with a version snapshot but no results row.
  await db.batch([
    db.insert(experiments).values({
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
    }),
    ...(hasResults
      ? [
          db.insert(experimentResults).values({
            experimentId: id,
            pValue: (r.pValue as number) ?? 0,
            effectSize: (r.effectSize as number) ?? 0,
            sampleSize: (r.sampleSize as number) ?? 0,
            confidenceIntervalLow: (r.confidenceIntervalLow as number) ?? 0,
            confidenceIntervalHigh: (r.confidenceIntervalHigh as number) ?? 0,
            summary: (r.summary as string) || "",
            createdAt: now,
          }),
        ]
      : []),
    db.insert(experimentVersions).values({
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
    }),
  ]);

  await invalidateExperimentCaches(hypothesisId as string);

  return Response.json({ data: { id } }, { status: 201 });
}
