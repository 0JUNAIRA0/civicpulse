import { z } from "zod";
import { route, parseJson, searchParamsObject } from "@/server/api";
import { requireApiUser } from "@/server/auth";
import { createUser, listUsers } from "@/server/services/users";
import { userCreateSchema } from "@/lib/validation";

const q = z.object({
  q: z.string().max(100).optional(),
  role: z.enum(["ADMIN", "DEPT_MANAGER", "STAFF", "CITIZEN"]).optional().catch(undefined),
  departmentId: z.uuid().optional().catch(undefined),
  status: z.enum(["active", "inactive"]).optional().catch(undefined),
  sort: z.enum(["name", "email", "role", "createdAt", "lastLoginAt"]).optional().catch(undefined),
  order: z.enum(["asc", "desc"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).default(1).catch(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(10).catch(10),
});

/** GET /api/users — admin: all users; manager: own department. */
export const GET = route(async (req) => {
  const user = await requireApiUser(["ADMIN", "DEPT_MANAGER"]);
  return listUsers(user, q.parse(searchParamsObject(req)));
});

/** POST /api/users — admin creates any user; manager adds staff to own department. */
export const POST = route(async (req) => {
  const user = await requireApiUser(["ADMIN", "DEPT_MANAGER"]);
  const input = await parseJson(req, userCreateSchema);
  return Response.json({ user: await createUser(user, input) }, { status: 201 });
});
