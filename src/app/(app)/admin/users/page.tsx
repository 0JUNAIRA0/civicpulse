import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePageUser } from "@/server/auth";
import { flatParams } from "@/server/page-utils";
import { listDepartments } from "@/server/services/departments";
import { listUsers } from "@/server/services/users";
import { ROLE_LABELS } from "@/lib/constants";
import { cn, formatDate, timeAgo } from "@/lib/utils";
import { Avatar, Card, EmptyState, PageHeader } from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { UserFilters } from "@/components/admin/user-filters";
import { EditUserButton } from "@/components/admin/edit-user";
import { AddUserButton, ToggleActiveButton } from "@/components/team/team-actions";
import type { Role } from "@/db/schema";

export const metadata: Metadata = { title: "User management" };

const ROLE_STYLE: Record<Role, string> = {
  ADMIN: "bg-brand-700 text-white dark:bg-brand-500",
  DEPT_MANAGER: "bg-accent-100 text-accent-800 dark:bg-accent-900 dark:text-accent-200",
  STAFF: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  CITIZEN: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requirePageUser(["ADMIN"]);
  const p = flatParams(await searchParams);
  const roles = ["ADMIN", "DEPT_MANAGER", "STAFF", "CITIZEN"];
  const [data, depts] = await Promise.all([
    listUsers(me, {
      q: p.q,
      role: roles.includes(p.role ?? "") ? (p.role as Role) : undefined,
      departmentId: p.departmentId,
      status: p.status === "active" || p.status === "inactive" ? p.status : undefined,
      sort: p.sort,
      order: p.order,
      page: Number(p.page) || 1,
      pageSize: 15,
    }),
    listDepartments({ includeInactive: true }),
  ]);
  const deptOpts = depts.map((d) => ({ id: d.id, name: d.name }));
  return (
    <>
      <PageHeader title="User management" description="Manage accounts, roles, departments and administrative permissions." actions={<AddUserButton roles={["CITIZEN", "STAFF", "DEPT_MANAGER", "ADMIN"]} defaultRole="STAFF" departments={deptOpts} />} />
      <Card>
        <Suspense>
          <UserFilters departments={deptOpts} />
        </Suspense>
        {data.items.length === 0 ? (
          <EmptyState title="No users match" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs font-semibold tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Extra permissions</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Last active</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((u) => (
                  <tr key={u.id} className={u.isActive ? "" : "opacity-60"}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} size={32} />
                        <div className="min-w-0">
                          <p className="font-medium">{u.name}{u.id === me.id && <span className="ml-1 text-xs text-muted">(you)</span>}</p>
                          <p className="truncate text-xs text-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", ROLE_STYLE[u.role])}>{ROLE_LABELS[u.role]}</span></td>
                    <td className="px-4 py-3 text-muted">{u.departmentName ?? "—"}</td>
                    <td className="px-4 py-3">{u.permissions.length ? <span className="font-mono text-[11px] text-muted">{u.permissions.join(", ")}</span> : <span className="text-muted">—</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "Never"}</td>
                    <td className="px-4 py-3">{u.isActive ? <span className="text-xs font-medium text-emerald-600">Active</span> : <span className="text-xs font-medium text-muted">Inactive</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <EditUserButton user={u} departments={deptOpts} isSelf={u.id === me.id} />
                        {u.id !== me.id && <ToggleActiveButton userId={u.id} isActive={u.isActive} name={u.name} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination base="/admin/users" params={p} page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} />
      </Card>
    </>
  );
}
