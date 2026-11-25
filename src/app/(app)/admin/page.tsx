import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Clock, FileText, Star, Timer, Users } from "lucide-react";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requirePageUser } from "@/server/auth";
import { flatParams } from "@/server/page-utils";
import { byCategory, departmentPerformance, monthlyTrends, overview, recentActivity } from "@/server/services/analytics";
import { hoursToHuman, timeAgo } from "@/lib/utils";
import { Card, CardHeader, PageHeader, StatCard } from "@/components/ui";
import { CategoryDonut, StackedDeptBar, TrendChart } from "@/components/charts/charts";
import { DateRangeFilter } from "@/components/date-range";
import { RankingTable } from "@/components/admin/ranking-table";

export const metadata: Metadata = { title: "Admin dashboard" };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageUser(["ADMIN"]);
  const p = flatParams(await searchParams);
  const f = { from: p.from, to: p.to };
  const [kpis, trend, cats, perf, activity, [{ staff }], [{ citizens }]] = await Promise.all([
    overview(f),
    monthlyTrends(f),
    byCategory(f),
    departmentPerformance(f),
    recentActivity(10),
    db.select({ staff: count() }).from(users).where(eq(users.role, "STAFF")),
    db.select({ citizens: count() }).from(users).where(eq(users.role, "CITIZEN")),
  ]);
  return (
    <>
      <PageHeader title="System overview" description="City-wide infrastructure issues, teams and performance." actions={<Suspense><DateRangeFilter /></Suspense>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total reported issues" value={kpis.total} icon={<FileText className="size-5" />} href="/admin/issues" />
        <StatCard label="Pending issues" value={kpis.pending} icon={<Clock className="size-5" />} tone="amber" hint={`${kpis.awaitingReview} awaiting verification`} href="/admin/issues?statusGroup=open" />
        <StatCard label="Resolved issues" value={kpis.resolved} icon={<CheckCircle2 className="size-5" />} tone="accent" hint={kpis.total ? `${Math.round((kpis.resolved / kpis.total) * 100)}% of all reports` : undefined} href="/admin/issues?statusGroup=done" />
        <StatCard label="Active maintenance tasks" value={kpis.activeTasks} icon={<ClipboardList className="size-5" />} tone="indigo" hint={`${kpis.tasksAwaitingReview} awaiting review`} />
        <StatCard label="Average resolution time" value={hoursToHuman(kpis.avgResolutionHours)} icon={<Timer className="size-5" />} hint={kpis.onTimeRate != null ? `${Math.round(kpis.onTimeRate * 100)}% within target` : undefined} />
        <StatCard label="Overdue" value={kpis.overdue} icon={<AlertTriangle className="size-5" />} tone="rose" hint={`${kpis.criticalOpen} critical open`} />
        <StatCard label="Citizen satisfaction" value={kpis.avgRating ? `${kpis.avgRating.toFixed(2)} / 5` : "—"} icon={<Star className="size-5" />} tone="amber" hint={`${kpis.feedbackCount} ratings`} />
        <StatCard label="People" value={`${staff} staff`} icon={<Users className="size-5" />} tone="emerald" hint={`${citizens} registered citizens`} href="/admin/users" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Monthly issue trends" description="Reported vs resolved" action={<Link href="/admin/analytics" className="text-sm font-medium text-accent-600 hover:underline">Full analytics</Link>} />
          <div className="p-4"><TrendChart data={trend} /></div>
        </Card>
        <Card>
          <CardHeader title="By category" />
          <div className="p-4"><CategoryDonut data={cats} height={200} stacked /></div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Department-wise reports" />
          <div className="p-4"><StackedDeptBar data={perf.map((d) => ({ name: d.name, open: d.open, resolved: d.resolved }))} /></div>
        </Card>
        <Card>
          <CardHeader title="Recent activity" />
          <ul className="divide-y divide-line">
            {activity.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 px-5 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{a.actor && !a.summary.startsWith(a.actor) ? <span className="font-medium">{a.actor}: </span> : null}{a.summary}</p>
                  {a.reference_code && a.entity_id && <Link href={`/issues/${a.entity_id}`} className="font-mono text-xs text-accent-600 hover:underline">{a.reference_code}</Link>}
                </div>
                <span className="shrink-0 text-xs text-muted">{timeAgo(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Department performance ranking" description="Score = 45% resolution rate + 30% on-time rate + 25% citizen rating" action={<Link href="/admin/departments" className="text-sm font-medium text-accent-600 hover:underline">Manage departments</Link>} />
        <RankingTable rows={perf} />
      </Card>
    </>
  );
}
