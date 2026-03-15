export const runtime = "edge";

import { getDB } from "@/db";
import { experiments, experimentResults, experimentVersions, users, hypotheses } from "@/db/schema";
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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const versionParam = url.searchParams.get("version");
  const db = getDB();

  const [exp] = await db.select().from(experiments).where(eq(experiments.id, id)).limit(1);

  if (!exp) {
    return Response.json({ error: "Experiment not found" }, { status: 404 });
  }

  // Get all versions from DB
  const dbVersions = await db
    .select()
    .from(experimentVersions)
    .where(eq(experimentVersions.experimentId, id));
  dbVersions.sort((a, b) => a.version - b.version);

  // Get results (needed for synthesized version 1)
  const [result] = await db
    .select()
    .from(experimentResults)
    .where(eq(experimentResults.experimentId, id))
    .limit(1);

  // Synthesize version 1 if missing (for experiments created before versioning)
  const hasV1 = dbVersions.some((v) => v.version === 1);
  const allVersions = hasV1
    ? dbVersions
    : [
        {
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
        },
        ...dbVersions,
      ];

  // Submitter
  let submitter = null;
  if (exp.submittedBy) {
    const [u] = await db
      .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, exp.submittedBy))
      .limit(1);
    submitter = u || null;
  }

  // Hypothesis
  const [hyp] = await db
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

  // If viewing a specific version
  if (versionParam) {
    const vNum = parseInt(versionParam, 10);
    const ver = allVersions.find((v) => v.version === vNum);
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

    return Response.json({
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
    });
  }

  // Current version (default)
  return Response.json({
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
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  // Check results summary requirement for completed status
  const r = results as Record<string, unknown> | undefined;
  if (newStatus === "completed") {
    const [existingRes] = await db
      .select({ summary: experimentResults.summary })
      .from(experimentResults)
      .where(eq(experimentResults.experimentId, id))
      .limit(1);
    const hasSummary = (r && r.summary) || existingRes?.summary;
    if (!hasSummary) {
      return Response.json(
        { error: "Results summary is required for completed experiments" },
        { status: 400 },
      );
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const newVersion = exp.version + 1;

  // Backfill version 1 if this is the first edit of a pre-existing experiment
  const [existingV1] = await db
    .select({ id: experimentVersions.id })
    .from(experimentVersions)
    .where(eq(experimentVersions.experimentId, id))
    .limit(1);

  if (!existingV1) {
    // Snapshot the pre-edit state as version 1
    const [preResult] = await db
      .select()
      .from(experimentResults)
      .where(eq(experimentResults.experimentId, id))
      .limit(1);

    await db.insert(experimentVersions).values({
      id: crypto.randomUUID(),
      experimentId: id,
      version: 1,
      status: exp.status,
      methodology: exp.methodology || null,
      analysisPlan: exp.analysisPlan || null,
      osfLink: exp.osfLink || null,
      pValue: preResult?.pValue ?? null,
      effectSize: preResult?.effectSize ?? null,
      sampleSize: preResult?.sampleSize ?? null,
      confidenceIntervalLow: preResult?.confidenceIntervalLow ?? null,
      confidenceIntervalHigh: preResult?.confidenceIntervalHigh ?? null,
      summary: preResult?.summary ?? null,
      changeSummary: "Initial submission",
      createdAt: exp.createdAt,
    });
  }

  // Update experiment
  await db
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
    .where(eq(experiments.id, id));

  // Handle results
  const hasNewResults =
    r && (r.summary || r.pValue != null || r.effectSize != null || r.sampleSize != null);

  if (hasNewResults) {
    const [existingResult] = await db
      .select()
      .from(experimentResults)
      .where(eq(experimentResults.experimentId, id))
      .limit(1);

    if (existingResult) {
      await db
        .update(experimentResults)
        .set({
          pValue: r.pValue != null ? (r.pValue as number) : existingResult.pValue,
          effectSize: r.effectSize != null ? (r.effectSize as number) : existingResult.effectSize,
          sampleSize: r.sampleSize != null ? (r.sampleSize as number) : existingResult.sampleSize,
          confidenceIntervalLow:
            r.confidenceIntervalLow != null
              ? (r.confidenceIntervalLow as number)
              : existingResult.confidenceIntervalLow,
          confidenceIntervalHigh:
            r.confidenceIntervalHigh != null
              ? (r.confidenceIntervalHigh as number)
              : existingResult.confidenceIntervalHigh,
          summary: r.summary != null ? (r.summary as string) : existingResult.summary,
        })
        .where(eq(experimentResults.experimentId, id));
    } else {
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
  }

  // Get current results for version snapshot
  const [currentResult] = await db
    .select()
    .from(experimentResults)
    .where(eq(experimentResults.experimentId, id))
    .limit(1);

  // Create version snapshot
  await db.insert(experimentVersions).values({
    id: crypto.randomUUID(),
    experimentId: id,
    version: newVersion,
    status: newStatus,
    methodology: newMethodology || null,
    analysisPlan: newAnalysisPlan || null,
    osfLink: newOsfLink || null,
    pValue: currentResult?.pValue ?? null,
    effectSize: currentResult?.effectSize ?? null,
    sampleSize: currentResult?.sampleSize ?? null,
    confidenceIntervalLow: currentResult?.confidenceIntervalLow ?? null,
    confidenceIntervalHigh: currentResult?.confidenceIntervalHigh ?? null,
    summary: currentResult?.summary ?? null,
    changeSummary: (changeSummary as string) || null,
    createdAt: now,
  });

  return Response.json({ data: { id, version: newVersion } });
}
