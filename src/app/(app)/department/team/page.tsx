import type { Metadata } from "next";
import Link from "next/link";
import { requirePageUser } from "@/server/auth";
import { departmentTeam } from "@/server/services/departments";
import { listTasks } from "@/server/services/tasks";
import { formatDate, hoursToHuman, timeAgo } from "@/lib/utils";
import { Avatar, Card, CardHeader, EmptyState, PageHeader, PriorityBadge, ProgressBar, StatCard, TaskStatusBadge } from "@/components/ui";
import { AddUserButton, ToggleActiveButton } from "@/components/team/team-actions";
import { SimpleBar } from "@/components/charts/charts";
import { ClipboardCheck, Clock, Users, AlertTriangle } from "lucide-react";

export const metadata: Metadata = { title: "Team management" };

export default async function TeamPage() {
  const user = await requirePageUser(["DEPT_MANAGER"]);
  if (!user.departmentId) return <EmptyState title="You are not assigned to a department" />;
  const [team, active] = await Promise.all([departmentTeam(user, user.departmentId), listTasks(user, { group: "active", pageSize: 50 })]);
  const staff = team.filter((t) => t.role === "STAFF");
  const totals = staff.reduce((a, s) => ({ active: a.active + s.activeTasks, overdue: a.overdue + s.overdue, done: a.done + s.completed30d }), { active: 0, overdue: 0, done: 0 });
  const maxLoad = Math.max(1, ...staff.map((s) => s.activeTasks));
  return (
    <>
      <PageHeader title="Team management" description="Your maintenance crew, their workload and open assignments." actions={<AddUserButton roles={["STAFF"]} defaultRole="STAFF" fixedDepartmentId={user.departmentId} label="Add maintenance staff" />} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active staff" value={staff.filter((s) => s.isActive).length} icon={<Users className="size-5" />} />
        <StatCard label="Open tasks" value={totals.active} icon={<Clock className="size-5" />} tone="indigo" />
        <StatCard label="Overdue tasks" value={totals.overdue} icon={<AlertTriangle className="size-5" />} tone="rose" />
        <StatCard label="Completed (30 days)" value={totals.done} icon={<ClipboardCheck className="size-5" />} tone="accent" />
      </div>

      <Card className="mt-6">
        <CardHeader title="Team members" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs font-semibold tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Workload</th>
                <th className="px-4 py-3 text-right">Overdue</th>
                <th className="px-4 py-3 text-right">Awaiting review</th>
                <th className="px-4 py-3 text-right">Completed</th>
                <th className="px-4 py-3">Avg. time</th>
                <th className="px-4 py-3">Last active</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {team.map((m) => (
                <tr key={m.id} className={m.isActive ? "" : "opacity-60"}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.name} size={32} />
                      <div>
                        <p className="font-medium">{m.name} {m.role === "DEPT_MANAGER" && <span className="ml-1 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-800 dark:text-brand-100">Manager</span>}</p>
                        <p className="text-xs text-muted">{m.jobTitle ?? "—"} · {m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="w-48 px-4 py-3">
                    {m.role === "STAFF" ? (
                      <div>
                        <p className="mb-1 text-xs text-muted">{m.activeTasks} active</p>
                        <ProgressBar value={(m.activeTasks / maxLoad) * 100} />
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{m.overdue ? <span className="font-semibold text-rose-600">{m.overdue}</span> : 0}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{m.awaitingReview}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{m.completedTotal}</td>
                  <td className="px-4 py-3 text-muted">{hoursToHuman(m.avgHours)}</td>
                  <td className="px-4 py-3 text-muted">{m.lastLoginAt ? timeAgo(m.lastLoginAt) : "Never"}</td>
                  <td className="px-4 py-3 text-right">{m.role === "STAFF" && <ToggleActiveButton userId={m.id} isActive={m.isActive} name={m.name} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_24rem]">
        <Card>
          <CardHeader title="Open assignments" description="Rework first, then in progress, then newly assigned" />
          {active.items.length === 0 ? (
            <EmptyState title="No open tasks" />
          ) : (
            <ul className="divide-y divide-line">
              {active.items.map((t) => (
                <li key={t.id}>
                  <Link href={`/issues/${t.issueId}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted">{t.referenceCode} · {t.assigneeName} · due {formatDate(t.dueDate)}</p>
                    </div>
                    <PriorityBadge priority={t.priority} />
                    <TaskStatusBadge status={t.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Completed per staff" description="All time, approved tasks" />
          <div className="p-4">
            <SimpleBar data={staff.map((s) => ({ name: s.name.split(" ")[0], done: s.completedTotal }))} dataKey="done" nameKey="name" name="Completed" />
          </div>
        </Card>
      </div>
    </>
  );
}
