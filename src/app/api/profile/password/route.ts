import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { route, parseJson } from "@/server/api";
import { createSessionCookie, hashPassword, requireApiUser, verifyPassword } from "@/server/auth";
import { AppError } from "@/server/errors";
import { logActivity } from "@/server/services/activity";
import { passwordChangeSchema } from "@/lib/validation";

/** POST /api/profile/password — change password; revokes all other sessions. */
export const POST = route(async (req) => {
  const me = await requireApiUser();
  const input = await parseJson(req, passwordChangeSchema);
  const row = await db.query.users.findFirst({ where: eq(users.id, me.id) });
  if (!row || !(await verifyPassword(input.currentPassword, row.passwordHash))) {
    throw new AppError(422, "Current password is incorrect", "VALIDATION_ERROR", { fields: { currentPassword: "Current password is incorrect" } });
  }
  const [updated] = await db
    .update(users)
    .set({ passwordHash: await hashPassword(input.newPassword), sessionVersion: row.sessionVersion + 1 })
    .where(eq(users.id, me.id))
    .returning();
  await createSessionCookie(updated);
  await logActivity({ actorId: me.id, action: "user.password", entityType: "user", entityId: me.id, summary: `${me.name} changed their password` });
  return { ok: true };
});
