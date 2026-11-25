import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { route, parseJson } from "@/server/api";
import { createSessionCookie, verifyPassword } from "@/server/auth";
import { AppError } from "@/server/errors";
import { clientIp, rateLimit } from "@/server/rate-limit";
import { loginSchema } from "@/lib/validation";
import { ROLE_HOME } from "@/lib/constants";

import bcrypt from "bcryptjs";

// Compared against when the email is unknown so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("civicpulse-timing-guard", 10);

/** POST /api/auth/login */
export const POST = route(async (req) => {
  const input = await parseJson(req, loginSchema);
  const rl = rateLimit(`login:${clientIp(req)}:${input.email}`, 8, 15 * 60_000);
  if (!rl.ok) throw new AppError(429, `Too many attempts. Try again in ${Math.ceil(rl.retryAfter / 60)} min.`, "RATE_LIMITED");
  const user = await db.query.users.findFirst({ where: sql`lower(${users.email}) = ${input.email}` });
  const ok = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, "Incorrect email or password", "INVALID_CREDENTIALS");
  if (!user.isActive) throw new AppError(403, "This account has been deactivated. Contact the administrator.", "ACCOUNT_DISABLED");
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await createSessionCookie(user);
  return { user: { id: user.id, name: user.name, email: user.email, role: user.role }, redirectTo: ROLE_HOME[user.role] };
});
