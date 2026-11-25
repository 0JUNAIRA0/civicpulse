import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock, Inbox, Star, Timer, Trophy } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { departments } from "@/db/schema";
import { requirePageUser } from "@/server/auth";
import { flatParams } from "@/server/page-utils";
import { byStatus, departmentPerformance, monthlyTrends, overview, satisfaction } from "@/server/services/analytics";
import { departmentTeam } from "@/server/services/departments";
import { listIssues } from "@/server/services/issues";
import { listTasks } from "@/server/services/tasks";
import { issueQuerySchema } from "@/lib/validation";
import { hoursToHuman, timeAgo } from "@/lib/utils";
import { Card, CardHeader, EmptyState, PageHeader, PriorityBadge, ProgressBar, StatCard, StatusBadge } from "@/components/ui";
import { ScoreGauge, StatusBars, TrendChart } from "@/components/charts/charts";
import { DateRangeFilter } from "@/components/date-range";

export const metadata: Metadata = { title: "Department dashboard" };

export default async function DepartmentDashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageUser(["DEPT_MANAGER"]);
  if (!user.departmentId) return <EmptyState title="You are not assigned to a department yet" description="Ask an administrator to assign you." />;
  const p = flatParams(await searchParams);
  const f = { from: p.from, to: p.to, departmentId: user.departmentId };
  const [dept, kpis, trend, statuses, perf, sat, toVerify, toReview, team] = await Promise.all([
    db.query.departments.findFirst({ where: eq(departments.id, user.departmentId) }),
    overview(f),
    monthlyTrends(f),
    byStatus(f),
    departmentPerformance({ from: p.from, to: p.to }),
    satisfaction(f),
    listIssues(user, issueQuerySchema.parse({ status: "SUBMITTED", pageSize: 6, sort: "createdAt", order: "asc" })),
    listTasks(user, { group: "review", pageSize: 6 }),
    departmentTeam(user, user.departmentId),
  ]);
  const mine = perf.find((d) => d.id === user.departmentId);
  const staff = team.filter((t) => t.role === "STAFF");
  const maxLoad = Math.max(1, ...staff.map((s) => s.activeTasks));

  return (
    <>
      <PageHeader title={dept?.name ?? "Department"} description="Department performance, verification queue and team workload." actions={<Suspense><DateRangeFilter /></Suspense>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Awaiting verification" value={kpis.awaitingReview} icon={<Inbox className="size-5" />} tone="amber" href="/department/issues?status=SUBMITTED" />
        <StatCard label="Open issues" value={kpis.pending} icon={<Clock className="size-5" />} href="/department/issues?statusGroup=open" hint={`${kpis.criticalOpen} critical`} />
        <StatCard label="Resolved" value={kpis.resolved} icon={<CheckCircle2 className="size-5" />} tone="accent" href="/department/issues?statusGroup=done" />
        <StatCard label="Overdue" value={kpis.overdue} icon={<AlertTriangle className="size-5" />} tone="rose" />
        <StatCard label="Active tasks" value={kpis.activeTasks} icon={<ClipboardCheck className="size-5" />} tone="indigo" href="/department/team" hint={`${kpis.tasksAwaitingReview} awaiting review`} />
        <StatCard label="Avg. resolution time" value={hoursToHuman(kpis.avgResolutionHours)} icon={<Timer className="size-5" />} tone="brand" hint={kpis.onTimeRate != null ? `${Math.round(kpis.onTimeRate * 100)}% within target` : undefined} />
        <StatCard label="Citizen rating" value={kpis.avgRating ? `${kpis.avgRating.toFixed(2)} / 5` : "—"} icon={<Star className="size-5" />} tone="amber" hint={`${kpis.feedbackCount} responses`} />
        <StatCard label="Performance rank" value={mine ? `#${mine.rank} of ${perf.length}` : "—"} icon={<Trophy className="size-5" />} tone="emerald" hint={mine ? `Score ${mine.score}/100` : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Needs verification" description="Oldest first" action={<Link href="/department/issues?status=SUBMITTED" className="text-sm font-medium text-accent-600 hover:underline">All</Link>} />
          {toVerify.items.length === 0 ? (
            <EmptyState title="Queue is clear" description="No new reports waiting for verification." />
          ) : (
            <ul className="divide-y divide-line">
              {toVerify.items.map((i) => (
                <li key={i.id}>
                  <Link href={`/issues/${i.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{i.title}</p>
                      <p className="text-xs text-muted">{i.referenceCode} · {i.areaName} · {timeAgo(i.createdAt)}</p>
                    </div>
                    {i.suspectedDuplicateOfId && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">Possible duplicate</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Completed work to review" action={<Link href="/department/issues?status=RESOLVED" className="text-sm font-medium text-accent-600 hover:underline">All</Link>} />
          {toReview.items.length === 0 ? (
            <EmptyState title="Nothing to review" />
          ) : (
            <ul className="divide-y divide-line">
              {toReview.items.map((t) => (
                <li key={t.id}>
                  <Link href={`/issues/${t.issueId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted">{t.referenceCode} · by {t.assigneeName} · {t.completedAt ? timeAgo(t.completedAt) : ""}</p>
                    </div>
                    <PriorityBadge priority={t.priority} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Monthly trend" description="Reported vs resolved, last 12 months" />
          <div className="p-4"><TrendChart data={trend} /></div>
        </Card>
        <Card>
          <CardHeader title="Department score" description="Resolution rate, on-time rate and citizen rating" />
          <div className="p-4">
            <ScoreGauge value={mine?.score ?? 0} label="out of 100" />
            <dl className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
              <div><dt className="text-muted">Resolved</dt><dd className="text-sm font-semibold">{mine ? Math.round(mine.resolutionRate * 100) : 0}%</dd></div>
              <div><dt className="text-muted">On time</dt><dd className="text-sm font-semibold">{mine ? Math.round(mine.onTimeRate * 100) : 0}%</dd></div>
              <div><dt className="text-muted">Satisfied</dt><dd className="text-sm font-semibold">{sat.satisfiedRate != null ? Math.round(sat.satisfiedRate * 100) : 0}%</dd></div>
            </dl>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Issues by status" />
          <div className="p-4"><StatusBars data={statuses} /></div>
        </Card>
        <Card>
          <CardHeader title="Team workload" action={<Link href="/department/team" className="text-sm font-medium text-accent-600 hover:underline">Manage team</Link>} />
          <ul className="divide-y divide-line">
            {staff.map((s) => (
              <li key={s.id} className="px-5 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{s.name}{!s.isActive && <span className="ml-2 text-xs text-muted">(inactive)</span>}</span>
                  <span className="text-xs text-muted">{s.activeTasks} active · {s.overdue} overdue · {s.completedTotal} done</span>
                </div>
                <ProgressBar value={(s.activeTasks / maxLoad) * 100} className="mt-2" />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Latest status" />
        <div className="flex flex-wrap gap-3 p-4">
          {(["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "REJECTED"] as const).map((s) => (
            <Link key={s} href={`/department/issues?status=${s}`} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 hover:bg-surface-2">
              <StatusBadge status={s} />
              <span className="font-semibold tabular-nums">{statuses.find((x) => x.status === s)?.total ?? 0}</span>
            </Link>
          ))}
        </div>
      </Card>
    </>
  );
}
