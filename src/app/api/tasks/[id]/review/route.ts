import { z } from "zod";
import { route, parseJson } from "@/server/api";
import { requireApiUser } from "@/server/auth";
import { reviewTask } from "@/server/services/tasks";
import { taskReviewSchema } from "@/lib/validation";

/** POST /api/tasks/:id/review — manager approves (closes the issue) or requests rework. */
export const POST = route<{ id: string }>(async (req, ctx) => {
  const user = await requireApiUser(["ADMIN", "DEPT_MANAGER"]);
  const input = await parseJson(req, taskReviewSchema);
  return reviewTask(user, z.uuid().parse((await ctx.params).id), input);
});
