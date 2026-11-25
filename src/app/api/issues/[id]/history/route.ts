import { z } from "zod";
import { route } from "@/server/api";
import { requireApiUser } from "@/server/auth";
import { getIssueDetail } from "@/server/services/issues";

/** GET /api/issues/:id/history — status history and activity log. */
export const GET = route<{ id: string }>(async (_req, ctx) => {
  const user = await requireApiUser();
  const { issue, activity } = await getIssueDetail(user, z.uuid().parse((await ctx.params).id));
  return { history: issue.history, activity };
});
