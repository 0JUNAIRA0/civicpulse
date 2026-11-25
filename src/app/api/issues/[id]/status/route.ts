import { z } from "zod";
import { route, parseJson } from "@/server/api";
import { requireApiUser } from "@/server/auth";
import { changeStatus } from "@/server/services/issues";
import { statusChangeSchema } from "@/lib/validation";

/** POST /api/issues/:id/status — department manager / admin moves an issue through the workflow. */
export const POST = route<{ id: string }>(async (req, ctx) => {
  const user = await requireApiUser(["ADMIN", "DEPT_MANAGER"]);
  const input = await parseJson(req, statusChangeSchema);
  return { issue: await changeStatus(user, z.uuid().parse((await ctx.params).id), input.status, input.note) };
});
