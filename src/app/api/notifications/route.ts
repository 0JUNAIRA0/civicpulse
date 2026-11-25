import { z } from "zod";
import { route, parseJson, searchParamsObject } from "@/server/api";
import { requireApiUser } from "@/server/auth";
import { listNotifications, markRead } from "@/server/services/notifications";

/** GET /api/notifications?unread=1&limit=20 */
export const GET = route(async (req) => {
  const user = await requireApiUser();
  const p = searchParamsObject(req);
  return listNotifications(user.id, { unreadOnly: p.unread === "1", limit: Number(p.limit) || 20 });
});

const body = z.object({ ids: z.union([z.array(z.uuid()).max(200), z.literal("all")]) });

/** PATCH /api/notifications — mark some or all as read. */
export const PATCH = route(async (req) => {
  const user = await requireApiUser();
  const { ids } = await parseJson(req, body);
  await markRead(user.id, ids);
  return { ok: true };
});
