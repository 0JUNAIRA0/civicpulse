import type { Metadata } from "next";
import Link from "next/link";
import { requirePageUser } from "@/server/auth";
import { flatParams } from "@/server/page-utils";
import { listTasks } from "@/server/services/tasks";
import { formatDate, isOverdue } from "@/lib/utils";
import { Card, CategoryBadge, EmptyState, PageHeader, PriorityBadge, ProgressBar, TaskStatusBadge } from "@/components/ui";
import { Pagination, hrefWith } from "@/components/pagination";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My tasks" };

const TABS = [
  { key: "active", label: "Active" },
  { key: "review", label: "Awaiting review" },
  { key: "done", label: "Done" },
  { key: "all", label: "All" },
] as const;

export default async function StaffTasks({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageUser(["STAFF"]);
  const p = flatParams(await searchParams);
  const g = p.group ?? "active";
  const effective = (["active", "review", "done"].includes(g) ? g : undefined) as "active" | "review" | "done" | undefined;
  const data = await listTasks(user, { group: effective, q: p.q, page: Number(p.page) || 1, pageSize: 10 });
  return (
    <>
      <PageHeader title="My tasks" description="Maintenance work assigned to you." />
      <Card>
        <div className="flex gap-1 overflow-x-auto border-b border-line px-3">
          {TABS.map((t) => {
            const active = (p.group ?? "active") === t.key;
            return (
              <Link key={t.label} href={hrefWith("/staff/tasks", {}, { group: t.key })} className={cn("-mb-px border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap", active ? "border-accent-500 text-accent-700 dark:text-accent-300" : "border-transparent text-muted hover:text-ink")}>
                {t.label}
              </Link>
            );
          })}
        </div>
        {data.items.length === 0 ? (
          <EmptyState title="No tasks here" />
        ) : (
          <ul className="divide-y divide-line">
            {data.items.map((t) => {
              const late = isOverdue(t.dueDate, t.status);
              return (
                <li key={t.id}>
                  <Link href={`/issues/${t.issueId}`} className="grid gap-3 px-5 py-4 hover:bg-surface-2 md:grid-cols-[1fr_10rem_8rem]">
                    <div className="min-w-0">
                      <p className="font-medium">{t.title}</p>
                      <p className="mt-0.5 text-xs text-muted">{t.referenceCode} · {t.address}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <CategoryBadge category={t.category} />
                        <PriorityBadge priority={t.priority} />
                      </div>
                    </div>
                    <div className="self-center">
                      <p className="mb-1 text-xs text-muted">{t.progress}% complete</p>
                      <ProgressBar value={t.progress} />
                    </div>
                    <div className="self-center md:text-right">
                      <TaskStatusBadge status={t.status} />
                      <p className={cn("mt-1 text-xs", late ? "font-semibold text-rose-600" : "text-muted")}>Due {formatDate(t.dueDate)}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <Pagination base="/staff/tasks" params={{ group: p.group }} page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} />
      </Card>
    </>
  );
}
