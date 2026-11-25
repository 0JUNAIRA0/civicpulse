import { z } from "zod";
import { route, searchParamsObject } from "@/server/api";
import { requireApiUser } from "@/server/auth";
import { listTasks } from "@/server/services/tasks";

const q = z.object({
  group: z.enum(["active", "done", "review"]).optional().catch(undefined),
  status: z.enum(["ASSIGNED", "IN_PROGRESS", "COMPLETED", "APPROVED", "REWORK", "CANCELLED"]).optional().catch(undefined),
  q: z.string().max(100).optional(),
  assigneeId: z.uuid().optional().catch(undefined),
  page: z.coerce.number().int().min(1).default(1).catch(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10).catch(10),
});

/** GET /api/tasks — staff: own tasks; managers: department tasks; admin: all. */
export const GET = route(async (req) => {
  const user = await requireApiUser(["ADMIN", "DEPT_MANAGER", "STAFF"]);
  return listTasks(user, q.parse(searchParamsObject(req)));
});
