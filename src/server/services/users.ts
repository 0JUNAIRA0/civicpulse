import "server-only";
import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import { departments, users, type Role } from "@/db/schema";
import { GRANTABLE_PERMISSIONS } from "@/lib/permissions";
import type { userCreateSchema, userUpdateSchema } from "@/lib/validation";
import { hashPassword, type CurrentUser } from "../auth";
import { badRequest, conflict, forbidden, notFound } from "../errors";
import { logActivity } from "./activity";
import { notify } from "./notifications";

const publicCols = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  phone: users.phone,
  jobTitle: users.jobTitle,
  departmentId: users.departmentId,
  departmentName: departments.name,
  permissions: users.permissions,
  isActive: users.isActive,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
};

export async function listUsers(
  actor: CurrentUser,
  q: { q?: string; role?: Role; departmentId?: string; status?: "active" | "inactive"; page?: number; pageSize?: number; sort?: string; order?: string },
) {
  // Managers may list their own team (for Team Management); admins everyone.
  const isAdmin = actor.role === "ADMIN" || actor.permissions.includes("users:manage");
  if (!isAdmin && actor.role !== "DEPT_MANAGER") throw forbidden();
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, q.pageSize ?? 10));
  const where: (SQL | undefined)[] = [];
  if (!isAdmin) where.push(eq(users.departmentId, actor.departmentId ?? "00000000-0000-0000-0000-000000000000"));
  if (q.q) {
    const term = `%${q.q.replace(/[%_\\]/g, (m) => "\\" + m)}%`;
    where.push(or(ilike(users.name, term), ilike(users.email, term)));
  }
  if (q.role) where.push(eq(users.role, q.role));
  if (q.departmentId) where.push(eq(users.departmentId, q.departmentId));
  if (q.status) where.push(eq(users.isActive, q.status === "active"));
  const cond = and(...where.filter(Boolean));
  const dir = q.order === "asc" ? asc : desc;
  const sortCol = q.sort === "name" ? users.name : q.sort === "email" ? users.email : q.sort === "role" ? users.role : q.sort === "lastLoginAt" ? users.lastLoginAt : users.createdAt;
  const [items, [{ total }]] = await Promise.all([
    db
      .select(publicCols)
      .from(users)
      .leftJoin(departments, eq(departments.id, users.departmentId))
      .where(cond)
      .orderBy(dir(sortCol), asc(users.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(users).where(cond),
  ]);
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

function validateRoleDept(role: Role, departmentId: string | null | undefined) {
  if ((role === "STAFF" || role === "DEPT_MANAGER") && !departmentId) throw badRequest("Staff and managers must belong to a department");
}

export async function createUser(actor: CurrentUser, input: z.infer<typeof userCreateSchema>) {
  // Admins can create anyone. Managers can add maintenance staff to their own department.
  const isAdmin = actor.role === "ADMIN" || actor.permissions.includes("users:manage");
  if (!isAdmin) {
    if (actor.role !== "DEPT_MANAGER" || input.role !== "STAFF") throw forbidden("Managers can only add maintenance staff");
    input = { ...input, departmentId: actor.departmentId };
  }
  if (input.role === "ADMIN" && actor.role !== "ADMIN") throw forbidden("Only admins can create admins");
  validateRoleDept(input.role, input.departmentId);
  const exists = await db.query.users.findFirst({ where: sql`lower(${users.email}) = ${input.email.toLowerCase()}` });
  if (exists) throw conflict("A user with that email already exists");
  const [row] = await db
    .insert(users)
    .values({
      name: input.name,
      email: input.email,
      role: input.role,
      departmentId: input.role === "CITIZEN" || input.role === "ADMIN" ? null : input.departmentId,
      phone: input.phone,
      jobTitle: input.jobTitle,
      passwordHash: await hashPassword(input.password),
    })
    .returning({ id: users.id, name: users.name, email: users.email, role: users.role });
  await logActivity({ actorId: actor.id, action: "user.create", entityType: "user", entityId: row.id, summary: `${actor.name} added ${row.name} as ${row.role}` });
  await notify([row.id], { type: "SYSTEM", title: "Welcome to CivicPulse", message: `Your ${row.role.replace("_", " ").toLowerCase()} account is ready.`, link: "/profile" });
  return row;
}

export async function updateUser(actor: CurrentUser, id: string, input: z.infer<typeof userUpdateSchema>) {
  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!target) throw notFound("User not found");
  const isAdmin = actor.role === "ADMIN";
  const canManageUsers = isAdmin || actor.permissions.includes("users:manage");

  if (!canManageUsers) {
    // Managers may activate/deactivate or retitle their own staff only.
    if (actor.role !== "DEPT_MANAGER" || target.role !== "STAFF" || target.departmentId !== actor.departmentId) throw forbidden();
    if (input.role || input.departmentId !== undefined || input.permissions) throw forbidden("Ask an admin to change roles or departments");
  }
  if (id === actor.id && (input.role || input.isActive === false || input.permissions)) {
    throw badRequest("You cannot change your own role, permissions or deactivate yourself");
  }
  if (input.permissions) {
    if (!isAdmin) throw forbidden("Only admins can assign administrative permissions");
    const bad = input.permissions.filter((p) => !GRANTABLE_PERMISSIONS.includes(p as never));
    if (bad.length) throw badRequest(`These permissions cannot be granted: ${bad.join(", ")}`);
  }
  if ((input.role === "ADMIN" || target.role === "ADMIN") && !isAdmin) throw forbidden("Only admins can change admin accounts");

  const role = input.role ?? target.role;
  const departmentId = input.departmentId !== undefined ? input.departmentId : target.departmentId;
  validateRoleDept(role, departmentId);

  const patch: Partial<typeof users.$inferInsert> = { ...input };
  if (role === "CITIZEN" || role === "ADMIN") patch.departmentId = null;
  if (input.isActive === false || (input.role && input.role !== target.role)) patch.sessionVersion = target.sessionVersion + 1;
  if (input.departmentId) {
    const d = await db.query.departments.findFirst({ where: eq(departments.id, input.departmentId) });
    if (!d) throw badRequest("Department not found");
  }
  const [row] = await db.update(users).set(patch).where(eq(users.id, id)).returning({ id: users.id, name: users.name, role: users.role, isActive: users.isActive });
  const changes = Object.keys(input).join(", ");
  await logActivity({ actorId: actor.id, action: "user.update", entityType: "user", entityId: id, summary: `${actor.name} updated ${row.name} (${changes})`, metadata: input });
  return row;
}
