import { route } from "@/server/api";
import { clearSessionCookie } from "@/server/auth";

/** POST /api/auth/logout */
export const POST = route(async () => {
  await clearSessionCookie();
  return { ok: true };
});
