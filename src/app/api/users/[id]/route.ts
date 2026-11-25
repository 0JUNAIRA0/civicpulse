import { z } from "zod";
import { route, parseJson } from "@/server/api";
import { requireApiUser } from "@/server/auth";
import { updateUser } from "@/server/services/users";
import { userUpdateSchema } from "@/lib/validation";

/** PATCH /api/users/:id — role, department, permissions, activation. */
export const PATCH = route<{ id: string }>(async (req, ctx) => {
  const user = await requireApiUser(["ADMIN", "DEPT_MANAGER"]);
  const input = await parseJson(req, userUpdateSchema);
  return { user: await updateUser(user, z.uuid().parse((await ctx.params).id), input) };
});
