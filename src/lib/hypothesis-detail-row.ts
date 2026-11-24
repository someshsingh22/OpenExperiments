import { cache } from "react";
import { getDB } from "@/db";
import { hypotheses } from "@/db/schema";
import { eq } from "drizzle-orm";

// Request-local only: metadata stays fresh even when the detail payload is cached.
export const getHypothesisDetailRow = cache(async (id: string) => {
  const db = getDB();
  const [row] = await db.select().from(hypotheses).where(eq(hypotheses.id, id)).limit(1);
  return row ?? null;
});
