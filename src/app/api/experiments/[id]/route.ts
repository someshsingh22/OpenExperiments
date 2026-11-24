export const runtime = "edge";

import { getDB } from "@/db";
import { experiments, experimentResults, experimentVersions, users, hypotheses } from "@/db/schema";
import { and, asc, eq, exists, sql, type SQL } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { invalidateExperimentCaches } from "@/lib/edge-cache";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

function literalSelection<T extends Record<string, unknown>>(values: T) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, sql`${value}`.as(key)]),
  ) as { [K in keyof T]: SQL.Aliased<T[K]> };
}

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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const versionParam = url.searchParams.get("version");
  const db = getDB();

  const [exp] = await db.select().from(experiments).where(eq(experiments.id, id)).limit(1);

  if (!exp) {
    return Response.json({ error: "Experiment not found" }, { status: 404 });
  }
  const requestedVersion = versionParam ? parseInt(versionParam, 10) : undefined;
  if (requestedVersion !== undefined && Number.isNaN(requestedVersion)) {
    return Response.json({ error: "Version not found" }, { status: 404 });
  }

  const historyQuery = db
    .select({
      version: experimentVersions.version,
      status: experimentVersions.status,
      methodology: experimentVersions.methodology,
      analysisPlan: experimentVersions.analysisPlan,
      osfLink: experimentVersions.osfLink,
      changeSummary: experimentVersions.changeSummary,
      createdAt: experimentVersions.createdAt,
    })
    .from(experimentVersions)
    .where(eq(experimentVersions.experimentId, id))
    .orderBy(asc(experimentVersions.version));
  const resultQuery = db
    .select()
    .from(experimentResults)
    .where(eq(experimentResults.experimentId, id))
    .limit(1);
  const selectedVersionQuery = db
    .select()
    .from(experimentVersions)
    .where(
      and(
        eq(experimentVersions.experimentId, id),
        eq(experimentVersions.version, requestedVersion ?? 0),
      ),
    )
    .limit(1);
  const hypothesisQuery = db
    .select({
      id: hypotheses.id,
      statement: hypotheses.statement,
      status: hypotheses.status,
      phase: hypotheses.phase,
      domains: hypotheses.domains,
    })
    .from(hypotheses)
    .where(eq(hypotheses.id, exp.hypothesisId))
    .limit(1);
  const submitterQuery = db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, exp.submittedBy ?? ""))
    .limit(1);
  const [dbVersions, hypRows, detailRows, ...submitterRows] = await db.batch([
    historyQuery,
    hypothesisQuery,
    ...(versionParam ? [selectedVersionQuery] : [resultQuery]),
    ...(exp.submittedBy ? [submitterQuery] : []),
  ]);
  const hyp = hypRows[0];
  const submitter = submitterRows.length
    ? ((submitterRows[0] as { id: string; name: string | null; avatarUrl: string | null }[])[0] ??
      null)
    : null;
  const result = versionParam
    ? undefined
    : (detailRows as (typeof experimentResults.$inferSelect)[])[0];

  // Synthesize version 1 if missing (for experiments created before versioning)
  const hasV1 = dbVersions.some((v) => v.version === 1);
  const syntheticV1 = {
    id: "synthetic-v1",
    experimentId: id,
    version: 1,
    status: exp.version === 1 ? exp.status : (dbVersions[0]?.status ?? exp.status),
    methodology: exp.version === 1 ? exp.methodology : null,
    analysisPlan: exp.version === 1 ? exp.analysisPlan : null,
    osfLink: exp.version === 1 ? exp.osfLink : null,
    pValue: null,
    effectSize: null,
    sampleSize: null,
    confidenceIntervalLow: null,
    confidenceIntervalHigh: null,
    summary: null,
    changeSummary: "Initial submission",
    createdAt: exp.createdAt,
  };
  const allVersions = hasV1 ? dbVersions : [syntheticV1, ...dbVersions];

  // If viewing a specific version
  if (versionParam) {
    const vNum = parseInt(versionParam, 10);
    const ver =
      (detailRows as (typeof experimentVersions.$inferSelect)[])[0] ??
      (!hasV1 && vNum === 1 ? syntheticV1 : undefined);
    if (!ver) {
      return Response.json({ error: "Version not found" }, { status: 404 });
    }

    const vResults: Record<string, unknown> = {};
    let hasVResults = false;
    if (ver.pValue) {
      vResults.pValue = ver.pValue;
      hasVResults = true;
    }
    if (ver.effectSize) {
      vResults.effectSize = ver.effectSize;
      hasVResults = true;
    }
    if (ver.sampleSize) {
      vResults.sampleSize = ver.sampleSize;
      hasVResults = true;
    }
    if (ver.confidenceIntervalLow || ver.confidenceIntervalHigh) {
      vResults.confidenceInterval = [ver.confidenceIntervalLow, ver.confidenceIntervalHigh];
      hasVResults = true;
    }
    if (ver.summary) {
      vResults.summary = ver.summary;
      hasVResults = true;
    }

    return Response.json(
      {
        data: {
          id: exp.id,
          hypothesisId: exp.hypothesisId,
          problemStatementId: exp.problemStatementId,
          type: exp.type,
          status: ver.status,
          datasetId: exp.datasetId,
          datasetName: exp.datasetName,
          methodology: ver.methodology,
          analysisPlan: ver.analysisPlan,
          submitter,
          startedAt: new Date(exp.startedAt * 1000).toISOString().split("T")[0],
          completedAt: exp.completedAt
            ? new Date(exp.completedAt * 1000).toISOString().split("T")[0]
            : undefined,
          osfLink: ver.osfLink,
          version: ver.version,
          totalVersions: exp.version,
          results: hasVResults ? vResults : undefined,
        },
        hypothesis: hyp || null,
        versions: allVersions.map((v) => ({
          version: v.version,
          status: v.status,
          methodology: v.methodology,
          analysisPlan: v.analysisPlan,
          osfLink: v.osfLink,
          changeSummary: v.changeSummary,
          createdAt: new Date(v.createdAt * 1000).toISOString(),
        })),
      },
      {
        headers: { "Cache-Control": "public, max-age=300, s-maxage=600" },
      },
    );
  }

  // Current version (default)
  return Response.json(
    {
      data: {
        id: exp.id,
        hypothesisId: exp.hypothesisId,
        problemStatementId: exp.problemStatementId,
        type: exp.type,
        status: exp.status,
        datasetId: exp.datasetId,
        datasetName: exp.datasetName,
        methodology: exp.methodology,
        analysisPlan: exp.analysisPlan,
        submitter,
        startedAt: new Date(exp.startedAt * 1000).toISOString().split("T")[0],
        completedAt: exp.completedAt
          ? new Date(exp.completedAt * 1000).toISOString().split("T")[0]
          : undefined,
        osfLink: exp.osfLink,
        version: exp.version,
        totalVersions: exp.version,
        results: result ? buildResultsResponse(result) : undefined,
      },
      hypothesis: hyp || null,
      versions: allVersions.map((v) => ({
        version: v.version,
        status: v.status,
        methodology: v.methodology,
        analysisPlan: v.analysisPlan,
        osfLink: v.osfLink,
        changeSummary: v.changeSummary,
        createdAt: new Date(v.createdAt * 1000).toISOString(),
      })),
    },
    {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=600" },
    },
  );
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await enforceRateLimit(request, RATE_LIMITS.write);
  if (limited) return limited;
  const { id } = await params;
  const user = await getSession(request);
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const db = getDB();

  const [exp] = await db.select().from(experiments).where(eq(experiments.id, id)).limit(1);

  if (!exp) {
    return Response.json({ error: "Experiment not found" }, { status: 404 });
  }

  if (exp.submittedBy !== user.id) {
    return Response.json({ error: "Only the author can edit this experiment" }, { status: 403 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const { status, methodology, analysisPlan, osfLink, results, changeSummary } = body;

  const newStatus = (status as string) || exp.status;
  const newMethodology = methodology !== undefined ? (methodology as string) : exp.methodology;
  const newAnalysisPlan = analysisPlan !== undefined ? (analysisPlan as string) : exp.analysisPlan;
  const newOsfLink = osfLink !== undefined ? (osfLink as string) : exp.osfLink;

  // Status-conditional validation
  if ((newStatus === "running" || newStatus === "completed") && !newMethodology) {
    return Response.json(
      { error: "Methodology is required for running/completed experiments" },
      { status: 400 },
    );
  }
  if (newStatus === "completed" && !newAnalysisPlan) {
    return Response.json(
      { error: "Analysis plan is required for completed experiments" },
      { status: 400 },
    );
  }

  const r = results as Record<string, unknown> | undefined;
  const [[existingResult], [existingHistory]] = await db.batch([
    db.select().from(experimentResults).where(eq(experimentResults.experimentId, id)).limit(1),
    db
      .select({ id: experimentVersions.id })
      .from(experimentVersions)
      .where(eq(experimentVersions.experimentId, id))
      .limit(1),
  ]);
  if (newStatus === "completed") {
    const hasSummary = (r && r.summary) || existingResult?.summary;
    if (!hasSummary) {
      return Response.json(
        { error: "Results summary is required for completed experiments" },
        { status: 400 },
      );
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const newVersion = exp.version + 1;
  const hasNewResults =
    r && (r.summary || r.pValue != null || r.effectSize != null || r.sampleSize != null);
  const mergedResult = hasNewResults
    ? {
        experimentId: id,
        pValue: (r.pValue as number | null | undefined) ?? existingResult?.pValue ?? 0,
        effectSize: (r.effectSize as number | null | undefined) ?? existingResult?.effectSize ?? 0,
        confidenceIntervalLow:
          (r.confidenceIntervalLow as number | null | undefined) ??
          existingResult?.confidenceIntervalLow ??
          0,
        confidenceIntervalHigh:
          (r.confidenceIntervalHigh as number | null | undefined) ??
          existingResult?.confidenceIntervalHigh ??
          0,
        sampleSize: (r.sampleSize as number | null | undefined) ?? existingResult?.sampleSize ?? 0,
        summary: existingResult
          ? ((r.summary as string | null | undefined) ?? existingResult.summary)
          : (r.summary as string) || "",
        uplift: existingResult?.uplift ?? null,
        createdAt: existingResult?.createdAt ?? now,
      }
    : existingResult;
  const snapshotId = crypto.randomUUID();
  // Insert-select column order must match the Drizzle table definition.
  const snapshot = {
    id: snapshotId,
    experimentId: id,
    version: newVersion,
    status: newStatus,
    methodology: newMethodology || null,
    analysisPlan: newAnalysisPlan || null,
    osfLink: newOsfLink || null,
    pValue: mergedResult?.pValue ?? null,
    effectSize: mergedResult?.effectSize ?? null,
    sampleSize: mergedResult?.sampleSize ?? null,
    confidenceIntervalLow: mergedResult?.confidenceIntervalLow ?? null,
    confidenceIntervalHigh: mergedResult?.confidenceIntervalHigh ?? null,
    summary: mergedResult?.summary ?? null,
    changeSummary: (changeSummary as string) || null,
    createdAt: now,
  };
  // The snapshot is a transaction-local marker: only the expected version
  // can create it, and every subsequent write is gated on its unique ID.
  const ownsEdit = exists(
    db
      .select({ id: experimentVersions.id })
      .from(experimentVersions)
      .where(eq(experimentVersions.id, snapshotId)),
  );
  const reserveSnapshot = db.insert(experimentVersions).select(
    db
      .select(literalSelection(snapshot))
      .from(experiments)
      .where(and(eq(experiments.id, id), eq(experiments.version, exp.version))),
  );
  const updateExperiment = db
    .update(experiments)
    .set({
      status: newStatus,
      methodology: newMethodology || null,
      analysisPlan: newAnalysisPlan || null,
      osfLink: newOsfLink || null,
      completedAt: newStatus === "completed" && !exp.completedAt ? now : exp.completedAt,
      version: newVersion,
      updatedAt: now,
    })
    .where(and(eq(experiments.id, id), eq(experiments.version, exp.version), ownsEdit))
    .returning({ id: experiments.id });
  const backfill = !existingHistory
    ? [
        db.insert(experimentVersions).select(
          db
            .select(
              literalSelection({
                ...snapshot,
                id: crypto.randomUUID(),
                version: 1,
                status: exp.status,
                methodology: exp.methodology || null,
                analysisPlan: exp.analysisPlan || null,
                osfLink: exp.osfLink || null,
                pValue: existingResult?.pValue ?? null,
                effectSize: existingResult?.effectSize ?? null,
                sampleSize: existingResult?.sampleSize ?? null,
                confidenceIntervalLow: existingResult?.confidenceIntervalLow ?? null,
                confidenceIntervalHigh: existingResult?.confidenceIntervalHigh ?? null,
                summary: existingResult?.summary ?? null,
                changeSummary: "Initial submission",
                createdAt: exp.createdAt,
              }),
            )
            .from(experiments)
            .where(and(eq(experiments.id, id), ownsEdit)),
        ),
      ]
    : [];
  const resultWrites =
    hasNewResults && mergedResult
      ? existingResult
        ? [
            db
              .update(experimentResults)
              .set({
                pValue: mergedResult.pValue,
                effectSize: mergedResult.effectSize,
                sampleSize: mergedResult.sampleSize,
                confidenceIntervalLow: mergedResult.confidenceIntervalLow,
                confidenceIntervalHigh: mergedResult.confidenceIntervalHigh,
                summary: mergedResult.summary,
              })
              .where(and(eq(experimentResults.experimentId, id), ownsEdit)),
          ]
        : [
            db.insert(experimentResults).select(
              db
                .select(literalSelection(mergedResult))
                .from(experiments)
                .where(and(eq(experiments.id, id), ownsEdit)),
            ),
          ]
      : [];
  const [, updated] = await db.batch([
    reserveSnapshot,
    updateExperiment,
    ...backfill,
    ...resultWrites,
  ]);
  if (!updated.length) {
    return Response.json({ error: "Experiment changed; reload before editing" }, { status: 409 });
  }

  await invalidateExperimentCaches(exp.hypothesisId);
  return Response.json({ data: { id, version: newVersion } });
}
