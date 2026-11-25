import { route, parseJson, searchParamsObject } from "@/server/api";
import { requireApiUser } from "@/server/auth";
import { createDepartment, listDepartments } from "@/server/services/departments";
import { departmentSchema } from "@/lib/validation";

/** GET /api/departments?includeInactive=1 */
export const GET = route(async (req) => {
  const user = await requireApiUser();
  const includeInactive = searchParamsObject(req).includeInactive === "1" && user.role === "ADMIN";
  return { items: await listDepartments({ includeInactive }) };
});

/** POST /api/departments — admin creates a department. */
export const POST = route(async (req) => {
  const user = await requireApiUser();
  const input = await parseJson(req, departmentSchema);
  return Response.json({ department: await createDepartment(user, input) }, { status: 201 });
});
