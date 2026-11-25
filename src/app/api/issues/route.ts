import { route, parseJson, searchParamsObject } from "@/server/api";
import { requireApiUser } from "@/server/auth";
import { createIssue, listIssues } from "@/server/services/issues";
import { createIssueSchema, issueQuerySchema } from "@/lib/validation";

/** GET /api/issues — server-side filtered, sorted and paginated list scoped to the caller's role. */
export const GET = route(async (req) => {
  const user = await requireApiUser();
  const q = issueQuerySchema.parse(searchParamsObject(req));
  return listIssues(user, q);
});

/** POST /api/issues — citizen submits a new issue. */
export const POST = route(async (req) => {
  const user = await requireApiUser();
  const input = await parseJson(req, createIssueSchema);
  const result = await createIssue(user, input);
  return Response.json(result, { status: 201 });
});
