import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import { issueAttachments, issues, tasks, taskUpdates, users, type TaskStatus } from "@/db/schema";
import { ACTIVE_TASK_STATUSES } from "@/lib/constants";
import { hasPermission } from "@/lib/permissions";
import type { taskReviewSchema, taskStatusSchema, taskUpdateSchema } from "@/lib/validation";
import type { CurrentUser } from "../auth";
import { badRequest, forbidden, notFound } from "../errors";
import { logActivity } from "./activity";
import { applyTransition } from "./issues";
import { notify, notifyDepartmentManagers } from "./notifications";
import { attachUploads } from "./uploads";

function taskScope(user: CurrentUser): SQL | undefined {
  if (user.role === "ADMIN") return undefined;
  if (user.role === "DEPT_MANAGER") return user.departmentId ? eq(issues.departmentId, user.departmentId) : sql`false`;
  if (user.role === "STAFF") return eq(tasks.assigneeId, user.id);
  return sql`false`;
}

export async function listTasks(
  user: CurrentUser,
  q: { status?: string; group?: "active" | "done" | "review"; q?: string; assigneeId?: string; page?: number; pageSize?: number },
) {
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, q.pageSize ?? 10));
  const where: (SQL | undefined)[] = [taskScope(user)];
  if (q.group === "active") where.push(inArray(tasks.status, ACTIVE_TASK_STATUSES));
  if (q.group === "review") where.push(eq(tasks.status, "COMPLETED"));
  if (q.group === "done") where.push(inArray(tasks.status, ["APPROVED", "CANCELLED"]));
  if (q.status) where.push(eq(tasks.status, q.status as TaskStatus));
  if (q.assigneeId) where.push(eq(tasks.assigneeId, q.assigneeId));
  if (q.q) {
    const term = `%${q.q.replace(/[%_\\]/g, (m) => "\\" + m)}%`;
    where.push(or(ilike(issues.title, term), ilike(issues.referenceCode, term), ilike(issues.address, term)));
  }
  const cond = and(...where.filter(Boolean));
  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        id: tasks.id,
        status: tasks.status,
        progress: tasks.progress,
        dueDate: tasks.dueDate,
        createdAt: tasks.createdAt,
        completedAt: tasks.completedAt,
        instructions: tasks.instructions,
        issueId: issues.id,
        referenceCode: issues.referenceCode,
        title: issues.title,
        category: issues.category,
        priority: issues.priority,
        address: issues.address,
        latitude: issues.latitude,
        longitude: issues.longitude,
        assigneeName: users.name,
        assigneeId: users.id,
      })
      .from(tasks)
      .innerJoin(issues, eq(issues.id, tasks.issueId))
      .innerJoin(users, eq(users.id, tasks.assigneeId))
      .where(cond)
      .orderBy(
        sql`CASE ${tasks.status} WHEN 'REWORK' THEN 0 WHEN 'IN_PROGRESS' THEN 1 WHEN 'ASSIGNED' THEN 2 WHEN 'COMPLETED' THEN 3 ELSE 4 END`,
        asc(tasks.dueDate),
        desc(tasks.createdAt),
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(tasks)
      .innerJoin(issues, eq(issues.id, tasks.issueId))
      .where(cond),
  ]);
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

async function loadTask(taskId: string) {
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId), with: { issue: true } });
  if (!task) throw notFound("Task not found");
  return task;
}

function assertAssignee(user: CurrentUser, task: { assigneeId: string }) {
  if (user.role !== "STAFF" || task.assigneeId !== user.id || !hasPermission(user, "tasks:update_own")) {
    throw forbidden("Only the assigned maintenance staff can update this task");
  }
}

export async function updateTaskStatus(user: CurrentUser, taskId: string, input: z.infer<typeof taskStatusSchema>) {
  const task = await loadTask(taskId);
  assertAssignee(user, task);
  return db.transaction(async (tx) => {
    const [issue] = await tx.select().from(issues).where(eq(issues.id, task.issueId)).for("update");
    const now = new Date();
    if (input.status === "IN_PROGRESS") {
      if (!["ASSIGNED", "REWORK"].includes(task.status)) throw badRequest("This task has already started");
      await tx.update(tasks).set({ status: "IN_PROGRESS", startedAt: task.startedAt ?? now }).where(eq(tasks.id, taskId));
      await tx.insert(taskUpdates).values({ taskId, authorId: user.id, type: "STATUS", message: input.note || "Work started" });
      if (issue.status === "ASSIGNED") await applyTransition(tx, issue, "IN_PROGRESS", user, input.note || "Maintenance work started");
    } else {
      if (task.status !== "IN_PROGRESS") throw badRequest("Start the task before marking it complete");
      if (input.completionImageIds?.length) {
        await attachUploads(tx, { issueId: issue.id, uploadIds: input.completionImageIds, kind: "COMPLETION", actorId: user.id, taskId });
      }
      const [{ n }] = await tx
        .select({ n: count() })
        .from(issueAttachments)
        .where(and(eq(issueAttachments.taskId, taskId), eq(issueAttachments.kind, "COMPLETION")));
      if (n === 0) throw badRequest("Upload at least one completion photo before marking the task complete");
      await tx.update(tasks).set({ status: "COMPLETED", progress: 100, completedAt: now }).where(eq(tasks.id, taskId));
      await tx.insert(taskUpdates).values({ taskId, authorId: user.id, type: "STATUS", message: input.note || "Work completed", progress: 100 });
      await applyTransition(tx, issue, "RESOLVED", user, input.note || "Maintenance work completed");
      await notifyDepartmentManagers(
        issue.departmentId,
        { type: "TASK_UPDATE", title: `${issue.referenceCode} ready for review`, message: `${user.name} completed the work.`, link: `/issues/${issue.id}` },
        tx,
      );
    }
    await logActivity(
      { actorId: user.id, action: "task.status", entityType: "issue", entityId: issue.id, summary: `${user.name} set task to ${input.status === "IN_PROGRESS" ? "in progress" : "completed"}` },
      tx,
    );
    return { ok: true };
  });
}

export async function addTaskUpdate(user: CurrentUser, taskId: string, input: z.infer<typeof taskUpdateSchema>) {
  const task = await loadTask(taskId);
  const isAssignee = task.assigneeId === user.id && user.role === "STAFF";
  const isManager =
    user.role === "ADMIN" || (user.role === "DEPT_MANAGER" && !!user.departmentId && task.issue.departmentId === user.departmentId);
  if (!isAssignee && !isManager) throw forbidden("You cannot add updates to this task");
  if (input.type === "PROGRESS" && !isAssignee) throw forbidden("Only the assigned staff can report progress");
  if (!["ASSIGNED", "IN_PROGRESS", "REWORK", "COMPLETED"].includes(task.status)) throw badRequest("This task is closed");

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(taskUpdates)
      .values({ taskId, authorId: user.id, type: input.type, message: input.message, progress: input.progress ?? null })
      .returning();
    if (input.type === "PROGRESS" && input.progress != null) {
      await tx.update(tasks).set({ progress: Math.min(input.progress, 99) }).where(eq(tasks.id, taskId));
    }
    if (input.imageIds?.length) {
      await attachUploads(tx, { issueId: task.issueId, uploadIds: input.imageIds, kind: "PROGRESS", actorId: user.id, taskId });
    }
    await logActivity(
      {
        actorId: user.id,
        action: input.type === "PROGRESS" ? "task.progress" : "task.note",
        entityType: "issue",
        entityId: task.issueId,
        summary: `${user.name} added a ${input.type === "PROGRESS" ? `progress report (${input.progress ?? "—"}%)` : "maintenance note"}`,
      },
      tx,
    );
    if (isAssignee) {
      await notifyDepartmentManagers(
        task.issue.departmentId,
        { type: "TASK_UPDATE", title: `Update on ${task.issue.referenceCode}`, message: input.message.slice(0, 140), link: `/issues/${task.issueId}` },
        tx,
      );
    } else {
      await notify([task.assigneeId], { type: "TASK_UPDATE", title: `Note from ${user.name}`, message: input.message.slice(0, 140), link: `/issues/${task.issueId}` }, tx);
    }
    return row;
  });
}

export async function reviewTask(user: CurrentUser, taskId: string, input: z.infer<typeof taskReviewSchema>) {
  const task = await loadTask(taskId);
  const manages =
    user.role === "ADMIN" || (user.role === "DEPT_MANAGER" && !!user.departmentId && task.issue.departmentId === user.departmentId);
  if (!manages || !hasPermission(user, "tasks:review")) throw forbidden("You cannot review this task");
  if (task.status !== "COMPLETED") throw badRequest("Only completed tasks can be reviewed");
  if (input.decision === "approve" && !hasPermission(user, "issues:close")) throw forbidden("You are not allowed to close issues");

  return db.transaction(async (tx) => {
    const [issue] = await tx.select().from(issues).where(eq(issues.id, task.issueId)).for("update");
    const now = new Date();
    if (input.decision === "approve") {
      await tx.update(tasks).set({ status: "APPROVED", reviewedAt: now, reviewedById: user.id, reviewNote: input.note }).where(eq(tasks.id, taskId));
      await applyTransition(tx, issue, "CLOSED", user, input.note || "Work reviewed and approved");
    } else {
      if (!input.note) throw badRequest("Explain what needs to be redone");
      await tx
        .update(tasks)
        .set({ status: "REWORK", reviewedAt: now, reviewedById: user.id, reviewNote: input.note, progress: 50, completedAt: null })
        .where(eq(tasks.id, taskId));
      await applyTransition(tx, issue, "IN_PROGRESS", user, `Rework requested: ${input.note}`);
    }
    await tx.insert(taskUpdates).values({
      taskId,
      authorId: user.id,
      type: "REVIEW",
      message: input.decision === "approve" ? `Approved${input.note ? `: ${input.note}` : ""}` : `Rework requested: ${input.note}`,
    });
    await notify(
      [task.assigneeId],
      {
        type: "TASK_REVIEW",
        title: input.decision === "approve" ? `${issue.referenceCode} approved` : `Rework needed on ${issue.referenceCode}`,
        message: input.note || issue.title,
        link: `/issues/${issue.id}`,
      },
      tx,
    );
    return { ok: true };
  });
}

/** Automated maintenance reminders: nudges staff about overdue or stale tasks. Idempotent per interval. */
export async function sendMaintenanceReminders(intervalHours: number) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - intervalHours * 3600000);
  const due = await db
    .select({ id: tasks.id, assigneeId: tasks.assigneeId, dueDate: tasks.dueDate, issueId: issues.id, ref: issues.referenceCode, title: issues.title, departmentId: issues.departmentId })
    .from(tasks)
    .innerJoin(issues, eq(issues.id, tasks.issueId))
    .where(
      and(
        inArray(tasks.status, ACTIVE_TASK_STATUSES),
        lt(tasks.dueDate, new Date(now.getTime() + 24 * 3600000)),
        or(sql`${tasks.lastReminderAt} IS NULL`, lt(tasks.lastReminderAt, cutoff)),
      ),
    )
    .limit(500);
  for (const t of due) {
    const overdue = t.dueDate && t.dueDate < now;
    await notify([t.assigneeId], {
      type: "REMINDER",
      title: overdue ? `Overdue: ${t.ref}` : `Due soon: ${t.ref}`,
      message: `${t.title} is ${overdue ? "past its due date" : "due within 24 hours"}.`,
      link: `/issues/${t.issueId}`,
    });
    if (overdue) {
      await notifyDepartmentManagers(t.departmentId, {
        type: "REMINDER",
        title: `Overdue task ${t.ref}`,
        message: t.title,
        link: `/issues/${t.issueId}`,
      });
    }
    await db.update(tasks).set({ lastReminderAt: now }).where(eq(tasks.id, t.id));
  }
  return { reminded: due.length };
}
