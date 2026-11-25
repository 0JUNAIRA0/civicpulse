import { z } from "zod";
import { route, parseJson } from "@/server/api";
import { requireApiUser } from "@/server/auth";
import { assignIssue } from "@/server/services/issues";
import { assignSchema } from "@/lib/validation";

/** POST /api/issues/:id/assign — create a maintenance task for a staff member of the issue's department. */
export const POST = route<{ id: string }>(async (req, ctx) => {
  const user = await requireApiUser(["ADMIN", "DEPT_MANAGER"]);
  const input = await parseJson(req, assignSchema);
  const task = await assignIssue(user, z.uuid().parse((await ctx.params).id), input);
  return Response.json({ task }, { status: 201 });
});
