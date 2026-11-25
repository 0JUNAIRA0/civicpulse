import { eq } from "drizzle-orm";
import { db } from "@/db";
import { uploads, users } from "@/db/schema";
import { route, parseJson } from "@/server/api";
import { requireApiUser } from "@/server/auth";
import { badRequest } from "@/server/errors";
import { profileSchema } from "@/lib/validation";

/** GET /api/profile */
export const GET = route(async () => ({ user: await requireApiUser() }));

/** PATCH /api/profile — update own name, phone, address and avatar. */
export const PATCH = route(async (req) => {
  const me = await requireApiUser();
  const input = await parseJson(req, profileSchema);
  let avatarUrl: string | null | undefined;
  if (input.avatarUploadId) {
    const up = await db.query.uploads.findFirst({ where: eq(uploads.id, input.avatarUploadId) });
    if (!up || up.ownerId !== me.id) throw badRequest("Invalid avatar image");
    avatarUrl = `/api/uploads/${up.id}`;
  } else if (input.avatarUploadId === null) avatarUrl = null;
  const [row] = await db
    .update(users)
    .set({ name: input.name, phone: input.phone ?? null, address: input.address ?? null, ...(avatarUrl !== undefined ? { avatarUrl } : {}) })
    .where(eq(users.id, me.id))
    .returning({ id: users.id, name: users.name, phone: users.phone, address: users.address, avatarUrl: users.avatarUrl });
  return { user: row };
});
