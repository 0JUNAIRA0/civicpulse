import Link from "next/link";
import { AlertTriangle, Copy } from "lucide-react";
import type { IssueListItem } from "@/server/services/issues";
import { CategoryBadge, EmptyState, PriorityBadge, StatusBadge } from "../ui";
import { Pagination } from "../pagination";
import { formatDate, isOverdue } from "@/lib/utils";

export function IssueTable({
  data,
  base,
  params,
  columns = {},
  emptyTitle = "No issues found",
  emptyDescription = "Try changing the filters or search terms.",
  emptyAction,
}: {
  data: { items: IssueListItem[]; page: number; pageSize: number; total: number; totalPages: number };
  base: string;
  params: Record<string, string | undefined>;
  columns?: { department?: boolean; reporter?: boolean; assignee?: boolean };
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}) {
  if (!data.items.length) return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs font-semibold tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3">Issue</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              {columns.department && <th className="px-4 py-3">Department</th>}
              {columns.assignee && <th className="px-4 py-3">Assignee</th>}
              {columns.reporter && <th className="px-4 py-3">Reporter</th>}
              <th className="px-4 py-3">Reported</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.items.map((i) => {
              const overdue = isOverdue(i.dueAt, i.status);
              return (
                <tr key={i.id} className="hover:bg-surface-2/60">
                  <td className="max-w-md px-4 py-3">
                    <Link href={`/issues/${i.id}`} className="font-medium text-ink hover:text-accent-600">
                      {i.title}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      <span className="font-mono">{i.referenceCode}</span>
                      <span className="truncate">· {i.areaName ?? i.address}</span>
                      {i.suspectedDuplicateOfId && (
                        <span className="inline-flex items-center gap-1 text-amber-600"><Copy className="size-3" /> Possible duplicate</span>
                      )}
                      {overdue && (
                        <span className="inline-flex items-center gap-1 text-rose-600"><AlertTriangle className="size-3" /> Overdue</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3"><CategoryBadge category={i.category} /></td>
                  <td className="px-4 py-3"><PriorityBadge priority={i.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                  {columns.department && <td className="px-4 py-3 text-muted">{i.departmentName ?? "Unrouted"}</td>}
                  {columns.assignee && <td className="px-4 py-3 text-muted">{i.assigneeName ?? "—"}</td>}
                  {columns.reporter && <td className="px-4 py-3 text-muted">{i.reporterName}</td>}
                  <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDate(i.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Mobile cards */}
      <ul className="divide-y divide-line md:hidden">
        {data.items.map((i) => (
          <li key={i.id}>
            <Link href={`/issues/${i.id}`} className="block px-4 py-3 hover:bg-surface-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{i.title}</p>
                <StatusBadge status={i.status} />
              </div>
              <p className="mt-1 text-xs text-muted">
                <span className="font-mono">{i.referenceCode}</span> · {formatDate(i.createdAt)} · {i.areaName ?? i.address}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <CategoryBadge category={i.category} />
                <PriorityBadge priority={i.priority} />
                {columns.assignee && i.assigneeName && <span className="text-xs text-muted">→ {i.assigneeName}</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Pagination base={base} params={params} page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} />
    </>
  );
}
