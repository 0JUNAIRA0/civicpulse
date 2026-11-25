import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type Role } from "@/db/schema";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession } from "@/lib/session";
import { hasPermission, permissionsFor, type Permission } from "@/lib/permissions";
import { forbidden, unauthorized } from "./errors";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId: string | null;
  permissions: string[];
  avatarUrl: string | null;
  phone: string | null;
  address: string | null;
  jobTitle: string | null;
};

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSessionCookie(u: { id: string; role: Role; name: string; departmentId: string | null; sessionVersion: number }) {
  const token = await signSession({ sub: u.id, role: u.role, name: u.name, departmentId: u.departmentId, ver: u.sessionVersion });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/**
 * Resolve the signed-in user. The JWT is only trusted for identity; role, department,
 * permissions and active state always come from the database so changes apply immediately.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const row = await db.query.users.findFirst({ where: eq(users.id, session.sub) });
  if (!row || !row.isActive || row.sessionVersion !== session.ver) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    departmentId: row.departmentId,
    permissions: row.permissions,
    avatarUrl: row.avatarUrl,
    phone: row.phone,
    address: row.address,
    jobTitle: row.jobTitle,
  };
});

/** For API routes: throws 401/403 instead of redirecting. */
export async function requireApiUser(roles?: Role[]) {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  if (roles && !roles.includes(user.role)) throw forbidden();
  return user;
}

export function assertPermission(user: CurrentUser, perm: Permission) {
  if (!hasPermission(user, perm)) throw forbidden();
}

export function can(user: CurrentUser, perm: Permission) {
  return hasPermission(user, perm);
}

export function userPermissions(user: CurrentUser) {
  return [...permissionsFor(user.role, user.permissions)];
}

/** For pages: redirects to login or to the user's own dashboard. */
export async function requirePageUser(roles?: Role[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/dashboard");
  return user;
}
