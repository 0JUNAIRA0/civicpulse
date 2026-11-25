import "server-only";
import { and, desc, eq, gt, inArray, count } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { notifications, users } from "@/db/schema";

type NotificationType = (typeof notifications.$inferInsert)["type"];

export async function notify(
  userIds: (string | null | undefined)[],
  n: { type: NotificationType; title: string; message: string; link?: string },
  tx: Tx | typeof db = db,
) {
  const ids = [...new Set(userIds.filter((x): x is string => !!x))];
  if (!ids.length) return;
  await tx.insert(notifications).values(ids.map((userId) => ({ userId, ...n })));
}

export async function notifyDepartmentManagers(
  departmentId: string | null,
  n: { type: NotificationType; title: string; message: string; link?: string },
  tx: Tx | typeof db = db,
) {
  if (!departmentId) return;
  const managers = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.departmentId, departmentId), eq(users.role, "DEPT_MANAGER"), eq(users.isActive, true)));
  await notify(
    managers.map((m) => m.id),
    n,
    tx,
  );
}

export async function listNotifications(userId: string, opts: { limit?: number; unreadOnly?: boolean; after?: Date } = {}) {
  const where = [eq(notifications.userId, userId)];
  if (opts.unreadOnly) where.push(eq(notifications.isRead, false));
  if (opts.after) where.push(gt(notifications.createdAt, opts.after));
  const items = await db
    .select()
    .from(notifications)
    .where(and(...where))
    .orderBy(desc(notifications.createdAt))
    .limit(Math.min(opts.limit ?? 20, 100));
  const [{ unread }] = await db
    .select({ unread: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return { items, unread };
}

export async function markRead(userId: string, ids: string[] | "all") {
  if (ids !== "all" && ids.length === 0) return;
  const where =
    ids === "all"
      ? and(eq(notifications.userId, userId), eq(notifications.isRead, false))
      : and(eq(notifications.userId, userId), inArray(notifications.id, ids));
  await db.update(notifications).set({ isRead: true }).where(where);
}
