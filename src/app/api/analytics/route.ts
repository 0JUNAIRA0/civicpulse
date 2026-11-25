import { z } from "zod";
import { route, searchParamsObject } from "@/server/api";
import { can, requireApiUser } from "@/server/auth";
import { forbidden } from "@/server/errors";
import { fullAnalytics, heatPoints } from "@/server/services/analytics";

const q = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  departmentId: z.uuid().optional().catch(undefined),
  heat: z.enum(["1"]).optional().catch(undefined),
});

/** GET /api/analytics — admins (or analytics:view) system-wide; managers get their department only. */
export const GET = route(async (req) => {
  const user = await requireApiUser(["ADMIN", "DEPT_MANAGER"]);
  const p = q.parse(searchParamsObject(req));
  let departmentId = p.departmentId;
  if (!can(user, "analytics:view")) {
    if (user.role !== "DEPT_MANAGER" || !user.departmentId) throw forbidden();
    departmentId = user.departmentId;
  }
  const f = { from: p.from, to: p.to, departmentId };
  const data = await fullAnalytics(f);
  return p.heat ? { ...data, heat: await heatPoints(f) } : data;
});
