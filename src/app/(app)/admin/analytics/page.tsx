import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckCircle2, Clock, FileText, Smile, Star, Timer } from "lucide-react";
import { requirePageUser } from "@/server/auth";
import { flatParams } from "@/server/page-utils";
import { fullAnalytics, heatPoints } from "@/server/services/analytics";
import { listDepartments } from "@/server/services/departments";
import { getSettings } from "@/server/services/settings";
import { hoursToHuman } from "@/lib/utils";
import { PRIORITY_LABELS } from "@/lib/constants";
import { Card, CardHeader, PageHeader, StatCard } from "@/components/ui";
import { CategoryDonut, SimpleBar, StackedDeptBar, StatusBars, TrendChart } from "@/components/charts/charts";
import { DateRangeFilter } from "@/components/date-range";
import { DepartmentSelect } from "@/components/admin/department-select";
import { RankingTable } from "@/components/admin/ranking-table";
import { IssueMap } from "@/components/map";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageUser(["ADMIN"]);
  const p = flatParams(await searchParams);
  const f = { from: p.from, to: p.to, departmentId: p.departmentId };
  const [a, heat, depts, settings] = await Promise.all([fullAnalytics(f), heatPoints(f), listDepartments(), getSettings()]);
  const k = a.kpis;
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Interactive charts across issues, departments, locations and citizen satisfaction."
        actions={
          <Suspense>
            <DateRangeFilter extra={<DepartmentSelect departments={depts.map((d) => ({ id: d.id, name: d.name }))} />} />
          </Suspense>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total issues" value={k.total} icon={<FileText className="size-5" />} />
        <StatCard label="Pending" value={k.pending} icon={<Clock className="size-5" />} tone="amber" />
        <StatCard label="Resolved" value={k.resolved} icon={<CheckCircle2 className="size-5" />} tone="accent" />
        <StatCard label="Avg. resolution" value={hoursToHuman(k.avgResolutionHours)} icon={<Timer className="size-5" />} />
        <StatCard label="Avg. rating" value={k.avgRating ? k.avgRating.toFixed(2) : "—"} icon={<Star className="size-5" />} tone="amber" />
        <StatCard label="Satisfied citizens" value={a.satisfaction.satisfiedRate != null ? `${Math.round(a.satisfaction.satisfiedRate * 100)}%` : "—"} icon={<Smile className="size-5" />} tone="emerald" hint="Rated 4★ or 5★" />
      </div>

      <Card className="mt-6">
        <CardHeader title="Monthly issue trends" description="Issues reported and resolved per month" />
        <div className="p-4"><TrendChart data={a.monthly} height={320} /></div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Category-wise distribution" />
          <div className="p-4"><CategoryDonut data={a.categories} /></div>
        </Card>
        <Card>
          <CardHeader title="Issues by status" />
          <div className="p-4"><StatusBars data={a.statuses} /></div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Department-wise reports" />
          <div className="p-4"><StackedDeptBar data={a.departments.map((d) => ({ name: d.name, open: d.open, resolved: d.resolved }))} /></div>
        </Card>
        <Card>
          <CardHeader title="Average resolution time by department" description="Days from report to resolution" />
          <div className="p-4">
            <SimpleBar data={a.departments.map((d) => ({ name: d.code, days: d.avgHours != null ? +(d.avgHours / 24).toFixed(1) : 0 }))} dataKey="days" nameKey="name" color="#123B5D" name="Days" suffix=" d" />
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Department performance ranking" description="Score = 45% resolution rate + 30% on-time rate + 25% citizen rating" />
        <RankingTable rows={a.departments} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader title="Open issue heatmap" description="Weighted by priority" />
          <div className="p-3">
            <IssueMap points={[]} heat={heat} showMarkers={false} center={[settings.mapCenter.lat, settings.mapCenter.lng]} zoom={settings.mapCenter.zoom} height={420} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Area-wise distribution" description="Top areas by reports" />
          <div className="p-4">
            <ul className="space-y-2.5">
              {a.areas.map((ar) => {
                const max = a.areas[0]?.total || 1;
                return (
                  <li key={ar.id}>
                    <div className="flex justify-between text-sm"><span className="truncate">{ar.name}</span><span className="tabular-nums text-muted">{ar.total} · {ar.open} open</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent-500" style={{ width: `${(ar.total / max) * 100}%` }} /></div>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Zones" />
          <div className="p-4"><SimpleBar data={a.zones} dataKey="total" nameKey="zone" name="Issues" /></div>
        </Card>
        <Card>
          <CardHeader title="Citizen satisfaction" description={`${a.satisfaction.responses} ratings`} />
          <div className="p-4"><SimpleBar data={a.satisfaction.ratings} dataKey="total" nameKey="label" color="#E8A400" name="Ratings" /></div>
        </Card>
        <Card>
          <CardHeader title="Priority mix" />
          <div className="p-4">
            <SimpleBar data={a.priorities.map((x) => ({ name: x.priority === "UNSET" ? "Not set" : PRIORITY_LABELS[x.priority as keyof typeof PRIORITY_LABELS], total: x.total }))} dataKey="total" nameKey="name" color="#123B5D" name="Issues" />
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Satisfaction by department" />
        <div className="p-4"><SimpleBar data={a.satisfaction.byDepartment} dataKey="avg" nameKey="name" name="Avg rating" suffix="★" /></div>
      </Card>
    </>
  );
}
