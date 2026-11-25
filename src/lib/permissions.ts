import type { Role } from "@/db/schema";

/**
 * Permission catalogue. Each role has a default set; admins can grant extra permissions
 * to individual users (stored in users.permissions). All checks run on the server.
 */
export const PERMISSIONS = {
  "issues:create": "Submit new issues",
  "issues:view_all": "View issues of every department",
  "issues:view_department": "View issues of own department",
  "issues:verify": "Verify or reject submitted issues",
  "issues:prioritize": "Set issue priority",
  "issues:reassign_department": "Move an issue to another department",
  "issues:close": "Close resolved issues",
  "tasks:assign": "Assign maintenance tasks to staff",
  "tasks:review": "Approve or send back completed work",
  "tasks:update_own": "Update tasks assigned to me",
  "team:manage": "Manage department team members",
  "departments:manage": "Create, update and deactivate departments",
  "users:manage": "Manage users, roles and permissions",
  "analytics:view": "View system-wide analytics",
  "settings:manage": "Manage system configuration",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: ALL_PERMISSIONS,
  DEPT_MANAGER: [
    "issues:view_department",
    "issues:verify",
    "issues:prioritize",
    "issues:reassign_department",
    "issues:close",
    "tasks:assign",
    "tasks:review",
    "team:manage",
  ],
  STAFF: ["issues:view_department", "tasks:update_own"],
  CITIZEN: ["issues:create"],
};

/** Permissions that may be delegated to non-admins by an admin. */
export const GRANTABLE_PERMISSIONS: Permission[] = [
  "issues:view_all",
  "issues:verify",
  "issues:close",
  "analytics:view",
  "departments:manage",
  "users:manage",
  "settings:manage",
];

export function permissionsFor(role: Role, extra: string[] = []): Set<Permission> {
  const set = new Set<Permission>(ROLE_PERMISSIONS[role]);
  for (const p of extra) if (p in PERMISSIONS) set.add(p as Permission);
  return set;
}

export function hasPermission(user: { role: Role; permissions?: string[] | null }, perm: Permission) {
  return permissionsFor(user.role, user.permissions ?? []).has(perm);
}
