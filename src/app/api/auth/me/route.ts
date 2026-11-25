import { route } from "@/server/api";
import { requireApiUser, userPermissions } from "@/server/auth";

/** GET /api/auth/me — the signed-in user and their effective permissions. */
export const GET = route(async () => {
  const user = await requireApiUser();
  return { user, permissions: userPermissions(user) };
});
