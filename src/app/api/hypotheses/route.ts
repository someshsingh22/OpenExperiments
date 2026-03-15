export const runtime = "edge";

import { getDB } from "@/db";
import { hypotheses, comments, experiments } from "@/db/schema";
import { eq, and, or, like, desc, sql, inArray } from "drizzle-orm";
import { validateHypothesis } from "@/lib/validation";

export async function GET(request: Request) {
  const { getSession } = await import("@/lib/auth");
  const viewer = await getSession(request);
  const db = getDB();
  const url = new URL(request.url);

  const domain = url.searchParams.get("domain");
  const phase = url.searchParams.get("phase");
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search");
  const sort = url.searchParams.get("sort") || "newest";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const conditions = [];
  if (phase) conditions.push(eq(hypotheses.phase, phase));
  if (status) conditions.push(eq(hypotheses.status, status));
  if (search) {
    const term = `%${search}%`;
    conditions.push(
      or(
        like(hypotheses.statement, term),
        like(hypotheses.rationale, term),
        like(hypotheses.problemStatement, term)
      )!
    );
  }
  if (domain) {
    conditions.push(like(hypotheses.domains, `%"${domain}"%`));
  }

  let orderBy;
  switch (sort) {
    case "top_rated":
      orderBy = desc(hypotheses.arenaElo);
      break;
    case "most_discussed":
      orderBy = desc(hypotheses.commentCount);
      break;
    case "newest":
    default:
      orderBy = desc(hypotheses.submittedAt);
      break;
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select()
    .from(hypotheses)
    .where(where)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(hypotheses)
    .where(where);

  // Compute actual comment counts from comments table
  const hypothesisIds = rows.map((r) => r.id);
  let commentCounts = new Map<string, number>();
  let experimentCounts = new Map<string, number>();
  if (hypothesisIds.length > 0) {
    const ccRows = await db
      .select({
        hypothesisId: comments.hypothesisId,
        count: sql<number>`count(*)`,
      })
      .from(comments)
      .where(inArray(comments.hypothesisId, hypothesisIds))
      .groupBy(comments.hypothesisId);
    for (const r of ccRows) {
      commentCounts.set(r.hypothesisId, r.count);
    }

    const ecRows = await db
      .select({
        hypothesisId: experiments.hypothesisId,
        count: sql<number>`count(*)`,
      })
      .from(experiments)
      .where(inArray(experiments.hypothesisId, hypothesisIds))
      .groupBy(experiments.hypothesisId);
    for (const r of ecRows) {
      experimentCounts.set(r.hypothesisId, r.count);
    }
  }

  return Response.json({
    data: rows.map((r) => deserializeHypothesis(r, viewer?.id, commentCounts, experimentCounts)),
    total: count,
  });
}

export async function POST(request: Request) {
  const { getSession, requireSession } = await import("@/lib/auth");
  const user = await getSession(request);
  const unauthorized = requireSession(user);
  if (unauthorized) return unauthorized;

  const db = getDB();
  const body = await request.json();
  const result = validateHypothesis(body as Record<string, unknown>);

  if (!result.ok) {
    return Response.json({ errors: result.errors }, { status: 400 });
  }

  const { statement, rationale, problemStatement, domains, source, agentName, citationDois, isAnonymous } = result.data;

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.insert(hypotheses).values({
    id,
    statement,
    rationale,
    source: source === "ai_agent" ? "ai_agent" : "human",
    agentName: agentName || null,
    domains,
    problemStatement,
    status: "proposed",
    phase: "live",
    submittedAt: now,
    submittedBy: user!.id,
    isAnonymous: isAnonymous ? 1 : 0,
    commentCount: 0,
    citationDois: citationDois ?? [],
    relatedHypothesisIds: [],
    createdAt: now,
    updatedAt: now,
  });

  return Response.json({ data: { id } }, { status: 201 });
}

function deserializeHypothesis(
  row: typeof hypotheses.$inferSelect,
  viewerId?: string,
  commentCounts?: Map<string, number>,
  experimentCounts?: Map<string, number>,
) {
  const isAnon = row.isAnonymous === 1;
  const isOwner = viewerId != null && row.submittedBy === viewerId;
  return {
    id: row.id,
    statement: row.statement,
    rationale: row.rationale,
    source: row.source,
    agentName: row.agentName,
    domain: row.domains,
    problemStatement: row.problemStatement,
    status: row.status,
    phase: row.phase,
    submittedAt: new Date(row.submittedAt * 1000).toISOString().split("T")[0],
    submittedBy: isAnon && !isOwner ? null : row.submittedBy,
    isAnonymous: isAnon,
    arenaElo: row.arenaElo,
    evidenceScore: row.evidenceScore,
    pValue: row.pValue,
    effectSize: row.effectSize,
    commentCount: commentCounts ? (commentCounts.get(row.id) ?? 0) : row.commentCount,
    experimentCount: experimentCounts?.get(row.id) ?? 0,
    citationDois: row.citationDois,
    relatedHypothesisIds: row.relatedHypothesisIds,
  };
}
