import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock, FileText, Plus, XCircle } from "lucide-react";
import { requirePageUser } from "@/server/auth";
import { issueStatsForReporter, listIssues, mapIssues } from "@/server/services/issues";
import { listNotifications } from "@/server/services/notifications";
import { getSettings } from "@/server/services/settings";
import { issueQuerySchema } from "@/lib/validation";
import { Card, CardHeader, CategoryBadge, EmptyState, LinkButton, PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { IssueMap } from "@/components/map";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Citizen dashboard" };

export default async function CitizenDashboard() {
  const user = await requirePageUser(["CITIZEN"]);
  const [stats, recent, notes, points, settings] = await Promise.all([
    issueStatsForReporter(user.id),
    listIssues(user, issueQuerySchema.parse({ pageSize: 5, sort: "updatedAt" })),
    listNotifications(user.id, { limit: 6 }),
    mapIssues(user, { scope: "mine" }),
    getSettings(),
  ]);
  return (
    <>
      <PageHeader
        title={`Hello, ${user.name.split(" ")[0]}`}
        description="Track your reports and see what's happening in your city."
        actions={
          <LinkButton href="/citizen/report/new" variant="accent">
            <Plus className="size-4" /> Report an issue
          </LinkButton>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="My reports" value={stats.total} icon={<FileText className="size-5" />} href="/citizen/reports" />
        <StatCard label="In progress" value={stats.open} icon={<Clock className="size-5" />} tone="amber" href="/citizen/reports?statusGroup=open" />
        <StatCard label="Resolved" value={stats.done} icon={<CheckCircle2 className="size-5" />} tone="accent" href="/citizen/reports?statusGroup=done" />
        <StatCard label="Rejected / duplicates" value={stats.rejected} icon={<XCircle className="size-5" />} tone="rose" href="/citizen/reports?status=REJECTED" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Recent activity on my reports" action={<Link href="/citizen/reports" className="text-sm font-medium text-accent-600 hover:underline">View all</Link>} />
          {recent.items.length === 0 ? (
            <EmptyState title="No reports yet" description="Spotted a pothole or a broken streetlight? Report it in under a minute." action={<LinkButton href="/citizen/report/new" variant="accent">Report your first issue</LinkButton>} />
          ) : (
            <ul className="divide-y divide-line">
              {recent.items.map((i) => (
                <li key={i.id}>
                  <Link href={`/issues/${i.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{i.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                        <span className="font-mono">{i.referenceCode}</span>
                        <CategoryBadge category={i.category} />
                        <span>Updated {timeAgo(i.updatedAt)}</span>
                      </div>
                    </div>
                    <StatusBadge status={i.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Updates" action={<Link href="/notifications" className="text-sm font-medium text-accent-600 hover:underline">All</Link>} />
          {notes.items.length === 0 ? (
            <EmptyState title="No updates yet" />
          ) : (
            <ul className="divide-y divide-line">
              {notes.items.map((n) => (
                <li key={n.id} className="px-5 py-3">
                  <Link href={n.link ?? "/notifications"} className="block hover:text-accent-600">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="line-clamp-1 text-xs text-muted">{n.message}</p>
                    <p className="mt-0.5 text-[11px] text-muted">{timeAgo(n.createdAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="My reports on the map" description="Faded markers are resolved." action={<Link href="/map" className="text-sm font-medium text-accent-600 hover:underline">Open city map</Link>} />
        <div className="p-3">
          <IssueMap points={points} center={[settings.mapCenter.lat, settings.mapCenter.lng]} zoom={settings.mapCenter.zoom} height={340} fit={points.length > 0} />
        </div>
      </Card>
    </>
  );
}
