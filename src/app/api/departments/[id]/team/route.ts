import { z } from "zod";
import { route } from "@/server/api";
import { requireApiUser } from "@/server/auth";
import { departmentTeam } from "@/server/services/departments";

/** GET /api/departments/:id/team — members with workload (active, overdue, completed, avg hours). */
export const GET = route<{ id: string }>(async (_req, ctx) => {
  const user = await requireApiUser(["ADMIN", "DEPT_MANAGER"]);
  return { items: await departmentTeam(user, z.uuid().parse((await ctx.params).id)) };
});
