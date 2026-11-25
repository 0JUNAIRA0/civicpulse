import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { route, parseJson } from "@/server/api";
import { createSessionCookie, hashPassword } from "@/server/auth";
import { AppError, conflict, forbidden } from "@/server/errors";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { logActivity } from "@/server/services/activity";
import { notify } from "@/server/services/notifications";
import { getSettings } from "@/server/services/settings";
import { registerSchema } from "@/lib/validation";

/** POST /api/auth/register — citizen self-registration. */
export const POST = route(async (req) => {
  const rl = rateLimit(`register:${clientIp(req)}`, 10, 60 * 60_000);
  if (!rl.ok) throw new AppError(429, "Too many sign-ups from this network. Try again later.", "RATE_LIMITED");
  const settings = await getSettings();
  if (!settings.allowCitizenRegistration) throw forbidden("Registration is currently closed");
  const input = await parseJson(req, registerSchema);
  const existing = await db.query.users.findFirst({ where: sql`lower(${users.email}) = ${input.email}` });
  if (existing) throw conflict("An account with this email already exists");
  const [user] = await db
    .insert(users)
    .values({ name: input.name, email: input.email, phone: input.phone, role: "CITIZEN", passwordHash: await hashPassword(input.password), lastLoginAt: new Date() })
    .returning();
  await logActivity({ actorId: user.id, action: "user.register", entityType: "user", entityId: user.id, summary: `${user.name} registered` });
  await notify([user.id], { type: "SYSTEM", title: "Welcome to CivicPulse", message: "Report your first issue to help improve the city.", link: "/citizen/report/new" });
  await createSessionCookie(user);
  return Response.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } }, { status: 201 });
});
