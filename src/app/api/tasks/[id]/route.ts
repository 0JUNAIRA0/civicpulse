import { z } from "zod";
import { route, parseJson } from "@/server/api";
import { requireApiUser } from "@/server/auth";
import { updateTaskStatus } from "@/server/services/tasks";
import { taskStatusSchema } from "@/lib/validation";

/** PATCH /api/tasks/:id — assigned staff starts or completes the task (completion needs a photo). */
export const PATCH = route<{ id: string }>(async (req, ctx) => {
  const user = await requireApiUser(["STAFF"]);
  const input = await parseJson(req, taskStatusSchema);
  return updateTaskStatus(user, z.uuid().parse((await ctx.params).id), input);
});
