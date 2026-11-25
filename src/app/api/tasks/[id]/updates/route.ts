import { z } from "zod";
import { route, parseJson } from "@/server/api";
import { requireApiUser } from "@/server/auth";
import { addTaskUpdate } from "@/server/services/tasks";
import { taskUpdateSchema } from "@/lib/validation";

/** POST /api/tasks/:id/updates — progress report (staff) or maintenance note (staff / manager). */
export const POST = route<{ id: string }>(async (req, ctx) => {
  const user = await requireApiUser(["ADMIN", "DEPT_MANAGER", "STAFF"]);
  const input = await parseJson(req, taskUpdateSchema);
  const update = await addTaskUpdate(user, z.uuid().parse((await ctx.params).id), input);
  return Response.json({ update }, { status: 201 });
});
