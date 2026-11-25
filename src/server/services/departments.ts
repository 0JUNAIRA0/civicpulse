import "server-only";
import { and, asc, count, eq, inArray, ne, sql } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import { departments, issues, tasks, users } from "@/db/schema";
import { OPEN_STATUSES } from "@/lib/constants";
import type { departmentSchema } from "@/lib/validation";
import type { CurrentUser } from "../auth";
import { assertPermission } from "../auth";
import { badRequest, conflict, forbidden, notFound } from "../errors";
import { logActivity } from "./activity";

export async function listDepartments(opts: { includeInactive?: boolean } = {}) {
  const rows = await db
    .select({
      id: departments.id,
      name: departments.name,
      code: departments.code,
      description: departments.description,
      categories: departments.categories,
      email: departments.email,
      phone: departments.phone,
      isActive: departments.isActive,
      managerId: departments.managerId,
      managerName: users.name,
      createdAt: departments.createdAt,
      staffCount: sql<number>`(select count(*)::int from ${users} u where u.department_id = ${departments.id} and u.role = 'STAFF' and u.is_active)`,
      openIssues: sql<number>`(select count(*)::int from ${issues} i where i.department_id = ${departments.id} and i.status in ('SUBMITTED','UNDER_REVIEW','ASSIGNED','IN_PROGRESS'))`,
      totalIssues: sql<number>`(select count(*)::int from ${issues} i where i.department_id = ${departments.id})`,
    })
    .from(departments)
    .leftJoin(users, eq(users.id, departments.managerId))
    .where(opts.includeInactive ? undefined : eq(departments.isActive, true))
    .orderBy(asc(departments.name));
  return rows;
}

async function validateManager(managerId: string | null | undefined, deptId?: string) {
  if (!managerId) return;
  const m = await db.query.users.findFirst({ where: eq(users.id, managerId) });
  if (!m || !m.isActive) throw badRequest("Manager not found");
  if (m.role !== "DEPT_MANAGER") throw badRequest("The selected user must have the Department Manager role");
  if (deptId && m.departmentId && m.departmentId !== deptId) {
    // Moving a manager between departments is allowed; it re-homes them below.
  }
}

export async function createDepartment(user: CurrentUser, input: z.infer<typeof departmentSchema>) {
  assertPermission(user, "departments:manage");
  await validateManager(input.managerId);
  const clash = await db.query.departments.findFirst({
    where: (d, { or, eq }) => or(eq(d.code, input.code), sql`lower(${d.name}) = lower(${input.name})`),
  });
  if (clash) throw conflict("A department with that name or code already exists");
  const [row] = await db
    .insert(departments)
    .values({ ...input, managerId: input.managerId ?? null, isActive: input.isActive ?? true })
    .returning();
  if (input.managerId) await db.update(users).set({ departmentId: row.id }).where(eq(users.id, input.managerId));
  await logActivity({ actorId: user.id, action: "department.create", entityType: "department", entityId: row.id, summary: `${user.name} created ${row.name}` });
  return row;
}

export async function updateDepartment(user: CurrentUser, id: string, input: Partial<z.infer<typeof departmentSchema>>) {
  assertPermission(user, "departments:manage");
  const dept = await db.query.departments.findFirst({ where: eq(departments.id, id) });
  if (!dept) throw notFound("Department not found");
  await validateManager(input.managerId, id);
  if (input.code || input.name) {
    const clash = await db.query.departments.findFirst({
      where: (d, { or, eq, and }) =>
        and(ne(d.id, id), or(input.code ? eq(d.code, input.code) : sql`false`, input.name ? sql`lower(${d.name}) = lower(${input.name})` : sql`false`)),
    });
    if (clash) throw conflict("Another department already uses that name or code");
  }
  if (input.isActive === false && dept.isActive) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(issues)
      .where(and(eq(issues.departmentId, id), inArray(issues.status, OPEN_STATUSES)));
    if (n > 0) throw badRequest(`Move or resolve the ${n} open issues before deactivating this department`);
  }
  const [row] = await db.update(departments).set(input).where(eq(departments.id, id)).returning();
  if (input.managerId) await db.update(users).set({ departmentId: id }).where(eq(users.id, input.managerId));
  const what = input.isActive === false ? "deactivated" : input.isActive === true && !dept.isActive ? "reactivated" : "updated";
  await logActivity({ actorId: user.id, action: `department.${what}`, entityType: "department", entityId: id, summary: `${user.name} ${what} ${row.name}` });
  return row;
}

/** Team roster with workload for a department. Managers see their own; admins any. */
export async function departmentTeam(user: CurrentUser, departmentId: string) {
  if (user.role !== "ADMIN" && !(user.role === "DEPT_MANAGER" && user.departmentId === departmentId)) {
    throw forbidden("You can only view your own department's team");
  }
  const since = new Date(Date.now() - 30 * 86400000);
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      jobTitle: users.jobTitle,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      activeTasks: sql<number>`count(${tasks.id}) filter (where ${tasks.status} in ('ASSIGNED','IN_PROGRESS','REWORK'))::int`,
      awaitingReview: sql<number>`count(${tasks.id}) filter (where ${tasks.status} = 'COMPLETED')::int`,
      completed30d: sql<number>`count(${tasks.id}) filter (where ${tasks.status} = 'APPROVED' and ${tasks.completedAt} >= ${since.toISOString()})::int`,
      completedTotal: sql<number>`count(${tasks.id}) filter (where ${tasks.status} = 'APPROVED')::int`,
      overdue: sql<number>`count(${tasks.id}) filter (where ${tasks.status} in ('ASSIGNED','IN_PROGRESS','REWORK') and ${tasks.dueDate} < now())::int`,
      avgHours: sql<number | null>`avg(extract(epoch from (${tasks.completedAt} - ${tasks.createdAt})) / 3600) filter (where ${tasks.completedAt} is not null)`,
    })
    .from(users)
    .leftJoin(tasks, eq(tasks.assigneeId, users.id))
    .where(and(eq(users.departmentId, departmentId), inArray(users.role, ["STAFF", "DEPT_MANAGER"])))
    .groupBy(users.id)
    .orderBy(asc(users.role), asc(users.name));
  return rows.map((r) => ({ ...r, avgHours: r.avgHours == null ? null : Number(r.avgHours) }));
}

export async function staffOptions(departmentId: string) {
  return db
    .select({
      id: users.id,
      name: users.name,
      jobTitle: users.jobTitle,
      activeTasks: sql<number>`(select count(*)::int from ${tasks} t where t.assignee_id = ${users.id} and t.status in ('ASSIGNED','IN_PROGRESS','REWORK'))`,
    })
    .from(users)
    .where(and(eq(users.departmentId, departmentId), eq(users.role, "STAFF"), eq(users.isActive, true)))
    .orderBy(asc(users.name));
}

