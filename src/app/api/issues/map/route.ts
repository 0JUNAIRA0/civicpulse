import { z } from "zod";
import { route, searchParamsObject } from "@/server/api";
import { requireApiUser } from "@/server/auth";
import { mapIssues } from "@/server/services/issues";
import { issueQuerySchema } from "@/lib/validation";

/** GET /api/issues/map — lightweight markers for the map (filters as /api/issues, plus scope=mine). */
export const GET = route(async (req) => {
  const user = await requireApiUser();
  const params = searchParamsObject(req);
  const q = issueQuerySchema.parse(params);
  const scope = z.enum(["all", "mine"]).catch("all").parse(params.scope);
  return { items: await mapIssues(user, { ...q, scope }) };
});
