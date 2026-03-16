export const runtime = "edge";

import { getDB } from "@/db";
import { experiments, experimentResults, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ExperimentsContent } from "@/components/experiments-content";
import type { Experiment } from "@/lib/types";

async function getInitialExperiments(): Promise<Experiment[]> {
  const db = getDB();
  const rows = await db.select().from(experiments);

  return Promise.all(
    rows.map(async (e) => {
      const [result] = await db
        .select()
        .from(experimentResults)
        .where(eq(experimentResults.experimentId, e.id))
        .limit(1);

      let submitter: { id: string; name: string | null; avatarUrl: string | null } | null = null;
      if (e.submittedBy) {
        const [u] = await db
          .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
          .from(users)
          .where(eq(users.id, e.submittedBy))
          .limit(1);
        submitter = u || null;
      }

      const resultsObj: Record<string, unknown> = {};
      let hasResults = false;
      if (result) {
        if (result.pValue) {
          resultsObj.pValue = result.pValue;
          hasResults = true;
        }
        if (result.effectSize) {
          resultsObj.effectSize = result.effectSize;
          hasResults = true;
        }
        if (result.sampleSize) {
          resultsObj.sampleSize = result.sampleSize;
          hasResults = true;
        }
        if (result.confidenceIntervalLow || result.confidenceIntervalHigh) {
          resultsObj.confidenceInterval = [
            result.confidenceIntervalLow,
            result.confidenceIntervalHigh,
          ];
          hasResults = true;
        }
        if (result.summary) {
          resultsObj.summary = result.summary;
          hasResults = true;
        }
        if (result.uplift) {
          resultsObj.uplift = result.uplift;
          hasResults = true;
        }
      }

      return {
        id: e.id,
        hypothesisId: e.hypothesisId,
        problemStatementId: e.problemStatementId ?? undefined,
        type: e.type as Experiment["type"],
        status: e.status as Experiment["status"],
        datasetId: e.datasetId ?? undefined,
        datasetName: e.datasetName,
        methodology: e.methodology ?? undefined,
        analysisPlan: e.analysisPlan ?? undefined,
        submitter,
        startedAt: new Date(e.startedAt * 1000).toISOString().split("T")[0],
        completedAt: e.completedAt
          ? new Date(e.completedAt * 1000).toISOString().split("T")[0]
          : undefined,
        osfLink: e.osfLink ?? undefined,
        version: e.version,
        results: hasResults ? (resultsObj as Experiment["results"]) : undefined,
      };
    }),
  );
}

export default async function ExperimentsPage() {
  const initialExperiments = await getInitialExperiments();
  return <ExperimentsContent initialExperiments={initialExperiments} />;
}
