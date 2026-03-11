export const runtime = "edge";

import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getSession(request);

  if (!user) {
    return Response.json({ user: null });
  }

  return Response.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      profileCompleted: user.profileCompleted,
    },
  });
}
