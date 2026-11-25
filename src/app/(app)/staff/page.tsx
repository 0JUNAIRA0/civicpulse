import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ClipboardList, RotateCcw } from "lucide-react";
import { and, count, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { requirePageUser } from "@/server/auth";
import { listTasks } from "@/server/services/tasks";
import { getSettings } from "@/server/services/settings";
import { formatDate, isOverdue } from "@/lib/utils";
import { CategoryBadge, Card, CardHeader, EmptyState, PageHeader, PriorityBadge, ProgressBar, StatCard, TaskStatusBadge } from "@/components/ui";
import { IssueMap } from "@/components/map";

export const metadata: Metadata = { title: "Staff dashboard" };

export default async function StaffDashboard() {
  const user = await requirePageUser(["STAFF"]);
  const [active, settings, [c]] = await Promise.all([
    listTasks(user, { group: "active", pageSize: 20 }),
    getSettings(),
    db
      .select({
        active: sql<number>`count(*) filter (where ${tasks.status} in ('ASSIGNED','IN_PROGRESS','REWORK'))::int`,
        rework: sql<number>`count(*) filter (where ${tasks.status} = 'REWORK')::int`,
        review: sql<number>`count(*) filter (where ${tasks.status} = 'COMPLETED')::int`,
        done: sql<number>`count(*) filter (where ${tasks.status} = 'APPROVED')::int`,
      })
      .from(tasks)
      .where(eq(tasks.assigneeId, user.id)),
  ]);
  const [{ overdue }] = await db
    .select({ overdue: count() })
    .from(tasks)
    .where(and(eq(tasks.assigneeId, user.id), inArray(tasks.status, ["ASSIGNED", "IN_PROGRESS", "REWORK"]), lt(tasks.dueDate, new Date())));
  return (
    <>
      <PageHeader title={`Good day, ${user.name.split(" ")[0]}`} description="Your maintenance assignments at a glance." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active tasks" value={c.active} icon={<ClipboardList className="size-5" />} href="/staff/tasks" />
        <StatCard label="Overdue" value={overdue} icon={<AlertTriangle className="size-5" />} tone="rose" />
        <StatCard label="Rework requested" value={c.rework} icon={<RotateCcw className="size-5" />} tone="amber" />
        <StatCard label="Completed" value={c.done} icon={<CheckCircle2 className="size-5" />} tone="accent" hint={`${c.review} awaiting review`} href="/staff/tasks?group=done" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Today's work queue" action={<Link href="/staff/tasks" className="text-sm font-medium text-accent-600 hover:underline">All tasks</Link>} />
          {active.items.length === 0 ? (
            <EmptyState title="No active tasks" description="New assignments will appear here and you'll get a notification." />
          ) : (
            <ul className="divide-y divide-line">
              {active.items.map((t) => {
                const late = isOverdue(t.dueDate);
                return (
                  <li key={t.id}>
                    <Link href={`/issues/${t.issueId}`} className="block px-5 py-3.5 hover:bg-surface-2">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium">{t.title}</p>
                        <TaskStatusBadge status={t.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted">{t.referenceCode} · {t.address}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <CategoryBadge category={t.category} />
                        <PriorityBadge priority={t.priority} />
                        <span className={late ? "text-xs font-semibold text-rose-600" : "text-xs text-muted"}>Due {formatDate(t.dueDate)}</span>
                      </div>
                      <ProgressBar value={t.progress} className="mt-2" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Task locations" />
          <div className="p-3">
            <IssueMap
              points={active.items.map((t) => ({ id: t.issueId, title: t.title, category: t.category, status: "ASSIGNED" as const, latitude: t.latitude, longitude: t.longitude, referenceCode: t.referenceCode }))}
              center={[settings.mapCenter.lat, settings.mapCenter.lng]}
              zoom={settings.mapCenter.zoom}
              height={460}
              fit={active.items.length > 0}
            />
          </div>
        </Card>
      </div>
    </>
  );
}
