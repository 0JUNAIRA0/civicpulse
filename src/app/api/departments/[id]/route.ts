import { z } from "zod";
import { route, parseJson } from "@/server/api";
import { requireApiUser } from "@/server/auth";
import { updateDepartment } from "@/server/services/departments";
import { departmentSchema } from "@/lib/validation";

/** PATCH /api/departments/:id — update, assign manager, activate / deactivate. */
export const PATCH = route<{ id: string }>(async (req, ctx) => {
  const user = await requireApiUser();
  const input = await parseJson(req, departmentSchema.partial());
  return { department: await updateDepartment(user, z.uuid().parse((await ctx.params).id), input) };
});
