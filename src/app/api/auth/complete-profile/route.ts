export const runtime = "edge";

import { getDB } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession, requireSession } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getSession(request);
  const unauthorized = requireSession(user);
  if (unauthorized) return unauthorized;

  const db = getDB();
  const body = await request.json() as Record<string, unknown>;

  const { validateProfile } = await import("@/lib/validation");
  // Name is required for initial profile completion but may be pre-filled
  const nameValue = body.name || user!.name || "";
  const result = validateProfile({ ...body, name: nameValue });
  if (!result.ok) {
    return Response.json({ errors: result.errors }, { status: 400 });
  }

  const { name, position, scholarUrl, website, bio, orcid, twitterHandle } = result.data;

  const now = Math.floor(Date.now() / 1000);
  await db.update(users).set({
    name,
    position: position || null,
    scholarUrl: scholarUrl || null,
    website: website || null,
    bio: bio || null,
    orcid: orcid || null,
    twitterHandle: twitterHandle || null,
    profileCompleted: 1,
    updatedAt: now,
  }).where(eq(users.id, user!.id));

  return Response.json({ ok: true });
}
