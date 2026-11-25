import { z } from "zod";
import { route, parseJson } from "@/server/api";
import { requireApiUser } from "@/server/auth";
import { getIssueDetail, updateIssue, withdrawIssue } from "@/server/services/issues";
import { updateIssueSchema } from "@/lib/validation";

const id = z.uuid("Invalid issue id");

/** GET /api/issues/:id */
export const GET = route<{ id: string }>(async (_req, ctx) => {
  const user = await requireApiUser();
  return getIssueDetail(user, id.parse((await ctx.params).id));
});

/** PATCH /api/issues/:id — reporter edits text (before review); manager sets priority / department. */
export const PATCH = route<{ id: string }>(async (req, ctx) => {
  const user = await requireApiUser();
  const input = await parseJson(req, updateIssueSchema);
  return { issue: await updateIssue(user, id.parse((await ctx.params).id), input) };
});

/** DELETE /api/issues/:id — reporter withdraws a report that is not under review yet (history is kept). */
export const DELETE = route<{ id: string }>(async (_req, ctx) => {
  const user = await requireApiUser();
  return { issue: await withdrawIssue(user, id.parse((await ctx.params).id)) };
});
