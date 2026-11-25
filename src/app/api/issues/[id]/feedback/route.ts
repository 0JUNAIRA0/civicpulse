import { z } from "zod";
import { route, parseJson } from "@/server/api";
import { requireApiUser } from "@/server/auth";
import { submitFeedback } from "@/server/services/issues";
import { feedbackSchema } from "@/lib/validation";

/** POST /api/issues/:id/feedback — reporter rates the resolution (once). */
export const POST = route<{ id: string }>(async (req, ctx) => {
  const user = await requireApiUser(["CITIZEN"]);
  const input = await parseJson(req, feedbackSchema);
  const feedback = await submitFeedback(user, z.uuid().parse((await ctx.params).id), input);
  return Response.json({ feedback }, { status: 201 });
});
