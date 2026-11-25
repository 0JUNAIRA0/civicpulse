import { z } from "zod";
import { route, parseJson } from "@/server/api";
import { requireApiUser } from "@/server/auth";
import { verifyIssue } from "@/server/services/issues";
import { verifySchema } from "@/lib/validation";

/** POST /api/issues/:id/verify — verify with priority, reject, or mark as duplicate. */
export const POST = route<{ id: string }>(async (req, ctx) => {
  const user = await requireApiUser();
  const input = await parseJson(req, verifySchema);
  return { issue: await verifyIssue(user, z.uuid().parse((await ctx.params).id), input) };
});
